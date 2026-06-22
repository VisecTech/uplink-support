"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { support_attachment, support_message, support_ticket } from "@/db/schema";
import { sendSupportCustomerConfirm, sendSupportStaffAlert, supportRef } from "@/lib/email/support-emails";
import { matchSubscription, resolveCustomerByEmail } from "@/lib/identity";
import { privateUploadRoot, sanitiseFilename } from "@/lib/private-uploads";
import { publicRateLimitCheck } from "@/lib/public-rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

type R = { ok: true; redirect: string } | { ok: false; error: string; field?: string };

const PRODUCTS = new Set(["general", "hosting", "shopkit", "sites", "clubkit", "webdev_project"]);
const BLOCKED_EXTS = new Set([
	".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".sh", ".ps1", ".jar", ".app", ".dll", ".vbs", ".pif",
]);
const PER_FILE_MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 8;

export async function submitSupportTicketAction(formData: FormData): Promise<R> {
	// Honeypot — bots fill every field; real users skip the hidden one.
	const honeypot = String(formData.get("website") ?? "").trim();
	if (honeypot) return { ok: true, redirect: "/thanks?ref=000000" };

	const email = String(formData.get("email") ?? "").trim().toLowerCase();
	const name = String(formData.get("name") ?? "").trim() || null;
	const subject = String(formData.get("subject") ?? "").trim();
	const body = String(formData.get("message") ?? "").trim();
	let product_kind = String(formData.get("product_kind") ?? "general").trim();
	if (!PRODUCTS.has(product_kind)) product_kind = "general";

	if (!email.includes("@")) return { ok: false, error: "valid email required", field: "email" };
	if (!subject) return { ok: false, error: "a subject is required", field: "subject" };
	if (!body) return { ok: false, error: "please describe your issue", field: "message" };

	const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
	if (files.length > MAX_FILES)
		return { ok: false, error: `up to ${MAX_FILES} files per ticket`, field: "files" };
	for (const file of files) {
		const ext = extname(file.name).toLowerCase();
		if (BLOCKED_EXTS.has(ext))
			return { ok: false, error: `file type "${ext}" is not allowed`, field: "files" };
		if (file.size > PER_FILE_MAX_BYTES)
			return {
				ok: false,
				error: `"${file.name}" is too large (max ${PER_FILE_MAX_BYTES / 1024 / 1024} MB per file)`,
				field: "files",
			};
	}

	const h = await headers();
	const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
	const user_agent = h.get("user-agent") ?? null;

	const ts = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
	if (!ts.ok) return { ok: false, error: ts.error };

	if (ip) {
		const rl = publicRateLimitCheck(`support-new:${ip}`);
		if (!rl.ok)
			return {
				ok: false,
				error: `Too many submissions from your network. Try again in ${Math.ceil(
					rl.retryAfterSeconds / 60,
				)} min, or email us directly.`,
			};
	}

	// Differentiator: resolve identity from the email over the READ-ONLY Counter
	// conn — stamps the ticket with the real customer + subscription context at
	// creation. Best-effort; degrades to an anonymous ticket on no match.
	const customer = await resolveCustomerByEmail(email);
	let subscription_id: string | null = null;
	let resource_ref: string | null = null;
	if (customer && product_kind !== "general") {
		const sub = await matchSubscription(customer.id, product_kind);
		if (sub) {
			subscription_id = sub.id;
			resource_ref = sub.resourceRef;
		}
	}

	const customer_token = randomBytes(32).toString("hex");
	const ticketId = randomUUID();

	const [ticket] = await db
		.insert(support_ticket)
		.values({
			id: ticketId,
			uplink_customer_id: customer?.id ?? null,
			requester_email: email,
			requester_name: name ?? customer?.name ?? null,
			product_kind,
			subscription_id,
			resource_ref,
			status: "open",
			priority: "normal",
			channel: "web",
			subject: subject.slice(0, 300),
			customer_token,
			email_thread_key: supportRef(ticketId),
			ip,
			user_agent,
		})
		.returning();

	const [msg] = await db
		.insert(support_message)
		.values({ ticket_id: ticket.id, author_kind: "customer", body_text: body })
		.returning();

	if (files.length > 0) {
		const baseDir = resolve(privateUploadRoot(), "support", ticket.id);
		const writtenPaths: string[] = [];
		const fileRows: (typeof support_attachment.$inferInsert)[] = [];
		try {
			await mkdir(baseDir, { recursive: true, mode: 0o750 });
			for (const file of files) {
				const ext = extname(file.name).toLowerCase();
				const sanitized = sanitiseFilename(file.name);
				const diskPath = resolve(baseDir, sanitized);
				if (!diskPath.startsWith(`${baseDir}/`) && diskPath !== baseDir) {
					throw new Error("path traversal blocked");
				}
				const buf = Buffer.from(await file.arrayBuffer());
				await writeFile(diskPath, buf, { mode: 0o640 });
				writtenPaths.push(diskPath);
				fileRows.push({
					message_id: msg.id,
					ticket_id: ticket.id,
					original_filename: file.name.slice(0, 500),
					sanitized_filename: sanitized,
					disk_path: diskPath,
					size_bytes: file.size,
					mime_type: file.type || null,
					ext: ext || null,
				});
			}
			if (fileRows.length > 0) await db.insert(support_attachment).values(fileRows);
		} catch (e) {
			for (const p of writtenPaths) await unlink(p).catch(() => {});
			await db.delete(support_ticket).where(eq(support_ticket.id, ticket.id));
			return { ok: false, error: e instanceof Error ? e.message : "file write failed" };
		}
	}

	sendSupportCustomerConfirm({ to: email, requesterName: name, ticketId: ticket.id, subject }).catch((e) =>
		console.error("[support] customer confirm email failed", e),
	);
	sendSupportStaffAlert({
		ticketId: ticket.id,
		subject,
		productKind: product_kind,
		channel: "web",
		requesterEmail: email,
		requesterName: name,
		bodyPreview: body,
	}).catch((e) => console.error("[support] staff alert email failed", e));

	return { ok: true, redirect: `/thanks?ref=${supportRef(ticket.id).replace("UWS-", "")}` };
}
