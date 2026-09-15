/**
 * Shared inbound-email → ticket processing. Called by the IMAP poller
 * (scripts/poll-inbound.ts). Threads onto an existing ticket via the
 * [UWS-xxxxxx] subject token or In-Reply-To/References, else opens a new
 * email-channel ticket. Dedupes on Message-ID. Best-effort; never throws fatally.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { support_attachment, support_message, support_ticket } from "@/db/schema";
import { sendSupportCustomerConfirm, sendSupportStaffAlert, supportRef } from "@/lib/email/support-emails";
import { matchSubscription, resolveCustomerByEmail } from "@/lib/identity";
import { privateUploadRoot, sanitiseFilename } from "@/lib/private-uploads";
import { productFromRecipients } from "@/lib/products";

const BLOCKED_EXTS = new Set([
	".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".sh", ".ps1", ".jar", ".app", ".dll", ".vbs", ".pif",
]);
const PER_FILE_MAX_BYTES = 25 * 1024 * 1024;

export type InboundEmail = {
	messageId: string | null;
	fromEmail: string;
	fromName: string | null;
	subject: string;
	inReplyTo: string | null;
	references: string[]; // message-ids
	text: string;
	autoSubmitted: boolean;
	attachments: { filename: string; content: Buffer; contentType: string | null; size: number }[];
	/** Raw recipient header lines (X-Original-To, Delivered-To, To, Cc) — the product tag lives here. */
	recipients?: string[];
};

export type InboundResult =
	| { ok: true; action: "created" | "appended"; ticketId: string }
	| { ok: false; skipped: string };

function isAutomated(from: string): boolean {
	return /(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce)@/i.test(from);
}

function cleanSubject(s: string): string {
	return s.replace(/^\s*(re|fwd?):\s*/i, "").replace(/\s*\[UWS-[A-Z0-9]+\]\s*/i, " ").trim() || "Support request";
}

async function findTicketId(email: InboundEmail): Promise<string | null> {
	// 1) [UWS-xxxxxx] token in the subject → email_thread_key
	const m = email.subject.match(/\[(UWS-[A-Z0-9]+)\]/i);
	if (m) {
		const token = m[1].toUpperCase();
		const [t] = await db
			.select({ id: support_ticket.id })
			.from(support_ticket)
			.where(eq(support_ticket.email_thread_key, token))
			.limit(1);
		if (t) return t.id;
	}
	// 2) In-Reply-To / References → a prior message's Message-ID
	const refs = [email.inReplyTo, ...email.references].filter((x): x is string => !!x);
	if (refs.length) {
		const [msg] = await db
			.select({ ticket_id: support_message.ticket_id })
			.from(support_message)
			.where(
				or(...refs.map((r) => eq(support_message.email_message_id, r))),
			)
			.orderBy(desc(support_message.created_at))
			.limit(1);
		if (msg) return msg.ticket_id;
	}
	return null;
}

/**
 * Should a message the anti-spam filed in Spam become a ticket anyway?
 * Only when it is clearly ours — otherwise every piece of junk would open a
 * ticket and email a "we got your request" confirmation to whoever sent it.
 *  - "thread":   it replies to an existing ticket ([UWS-] token / In-Reply-To / References)
 *  - "requester": staff have replied on one of this sender's earlier tickets
 *  - "customer": the sender is a known Uplink customer
 * Returns null for everything else (left in Spam).
 *
 * ⚠ "Has opened a ticket before" is NOT enough. Most historical email tickets are
 * cold pitches that reached INBOX, so that rule rescued repeat senders straight
 * back out of Spam on its first live run (2026-09-15) and emailed them a
 * confirmation. A staff reply is the signal that a sender is a real conversation.
 */
export async function spamRescueReason(email: InboundEmail): Promise<"thread" | "requester" | "customer" | null> {
	if (email.autoSubmitted || isAutomated(email.fromEmail) || !email.fromEmail.includes("@")) return null;
	if (await findTicketId(email)) return "thread";
	const [answered] = await db
		.select({ id: support_ticket.id })
		.from(support_ticket)
		.innerJoin(support_message, eq(support_message.ticket_id, support_ticket.id))
		.where(and(eq(support_ticket.requester_email, email.fromEmail), eq(support_message.author_kind, "agent")))
		.limit(1);
	if (answered) return "requester";
	if (await resolveCustomerByEmail(email.fromEmail)) return "customer";
	return null;
}

async function saveAttachments(ticketId: string, messageId: string, email: InboundEmail): Promise<void> {
	const usable = email.attachments.filter(
		(a) => a.size > 0 && a.size <= PER_FILE_MAX_BYTES && !BLOCKED_EXTS.has(extname(a.filename || "").toLowerCase()),
	);
	if (!usable.length) return;
	const baseDir = resolve(privateUploadRoot(), "support", ticketId);
	await mkdir(baseDir, { recursive: true, mode: 0o750 });
	const rows: (typeof support_attachment.$inferInsert)[] = [];
	for (const a of usable) {
		const sanitized = sanitiseFilename(a.filename || "attachment");
		const diskPath = resolve(baseDir, `${randomBytes(4).toString("hex")}-${sanitized}`);
		if (!diskPath.startsWith(`${baseDir}/`)) continue;
		await writeFile(diskPath, a.content, { mode: 0o640 });
		rows.push({
			message_id: messageId,
			ticket_id: ticketId,
			original_filename: (a.filename || "attachment").slice(0, 500),
			sanitized_filename: sanitized,
			disk_path: diskPath,
			size_bytes: a.size,
			mime_type: a.contentType,
			ext: extname(a.filename || "").toLowerCase() || null,
		});
	}
	if (rows.length) await db.insert(support_attachment).values(rows);
}

export async function processInboundEmail(email: InboundEmail): Promise<InboundResult> {
	if (email.autoSubmitted || isAutomated(email.fromEmail)) return { ok: false, skipped: "automated" };
	if (!email.fromEmail.includes("@")) return { ok: false, skipped: "no-from" };

	// Dedupe on Message-ID
	if (email.messageId) {
		const [dup] = await db
			.select({ id: support_message.id })
			.from(support_message)
			.where(eq(support_message.email_message_id, email.messageId))
			.limit(1);
		if (dup) return { ok: false, skipped: "duplicate" };
	}

	const body = (email.text || "").trim() || "(no text content)";
	const existingTicketId = await findTicketId(email);

	// ---- Append to an existing ticket ----
	if (existingTicketId) {
		const [ticket] = await db.select().from(support_ticket).where(eq(support_ticket.id, existingTicketId)).limit(1);
		if (ticket) {
			const [msg] = await db
				.insert(support_message)
				.values({
					ticket_id: ticket.id,
					author_kind: "customer",
					body_text: body,
					email_message_id: email.messageId,
					email_in_reply_to: email.inReplyTo,
				})
				.returning();
			await saveAttachments(ticket.id, msg.id, email);
			await db
				.update(support_ticket)
				.set({
					status: ticket.status === "solved" || ticket.status === "closed" ? "open" : ticket.status,
					updated_at: new Date(),
				})
				.where(eq(support_ticket.id, ticket.id));

			sendSupportStaffAlert({
				ticketId: ticket.id,
				subject: ticket.subject,
				productKind: ticket.product_kind,
				channel: "email",
				requesterEmail: ticket.requester_email,
				requesterName: ticket.requester_name,
				bodyPreview: `↩ customer reply:\n${body}`,
			}).catch((e) => console.error("[inbound] staff alert failed", e));

			return { ok: true, action: "appended", ticketId: ticket.id };
		}
	}

	// ---- New email-channel ticket ----
	const subject = cleanSubject(email.subject).slice(0, 300);
	const customer = await resolveCustomerByEmail(email.fromEmail);
	let subscription_id: string | null = null;
	let resource_ref: string | null = null;
	// The product the client pointed at: support+<product>@uplink.net.au, or a
	// forwarded product address (see lib/products.ts). Anything else → 'general'.
	const product_kind = productFromRecipients(email.recipients ?? []);
	if (customer) {
		const sub = await matchSubscription(customer.id, product_kind);
		if (sub) {
			subscription_id = sub.id;
			resource_ref = sub.resourceRef;
		}
	}

	const ticketId = randomUUID();
	await db.insert(support_ticket).values({
		id: ticketId,
		uplink_customer_id: customer?.id ?? null,
		requester_email: email.fromEmail,
		requester_name: email.fromName ?? customer?.name ?? null,
		product_kind,
		subscription_id,
		resource_ref,
		status: "open",
		priority: "normal",
		channel: "email",
		subject,
		customer_token: randomBytes(32).toString("hex"),
		email_thread_key: supportRef(ticketId),
		email_message_id: email.messageId,
	});
	const [msg] = await db
		.insert(support_message)
		.values({
			ticket_id: ticketId,
			author_kind: "customer",
			body_text: body,
			email_message_id: email.messageId,
			email_in_reply_to: email.inReplyTo,
		})
		.returning();
	await saveAttachments(ticketId, msg.id, email);

	sendSupportCustomerConfirm({ to: email.fromEmail, requesterName: email.fromName, ticketId, subject }).catch((e) =>
		console.error("[inbound] confirm failed", e),
	);
	sendSupportStaffAlert({
		ticketId,
		subject,
		productKind: product_kind,
		channel: "email",
		requesterEmail: email.fromEmail,
		requesterName: email.fromName,
		bodyPreview: body,
	}).catch((e) => console.error("[inbound] staff alert failed", e));

	return { ok: true, action: "created", ticketId };
}
