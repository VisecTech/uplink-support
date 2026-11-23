/**
 * One way to send an agent's reply to a customer: record it on the ticket,
 * email it (threaded onto the customer's last message), move the ticket to
 * "pending". Used by the console's reply box AND by scripts/agent-reply.ts, so a
 * reply sent by a script is indistinguishable from one typed in the console.
 *
 * Also records whether the email was actually accepted (delivery_status), which
 * the console action never did: a failed send used to look the same as a sent one.
 *
 * No `server-only` import: the script loads this outside Next.
 */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { support_message, support_ticket } from "@/db/schema";
import { sendSupportAgentReply } from "@/lib/email/support-emails";

export const REPLY_MAX_CHARS = 6000;

/**
 * Reasons this text should NOT be sent to a customer, or [] if it looks like a
 * reply. For text that arrives from a script, where nobody is looking at a
 * reply box. Written after 2026-11-23, when a whole internal working message
 * (findings, options, then the draft) was pasted in and emailed to a customer.
 * Deliberately blunt: a false alarm costs a re-read, a miss costs an apology.
 */
export function replyProblems(text: string): string[] {
	const t = text.trim();
	const problems: string[] = [];
	if (!t) problems.push("it is empty");
	if (t.length > REPLY_MAX_CHARS) problems.push(`it is ${t.length} characters long (limit ${REPLY_MAX_CHARS})`);
	const checks: [RegExp, string][] = [
		[/\*\*[^*\n]+\*\*/, "it contains **bold** markdown, which customers see as asterisks"],
		[/^\s*#{1,6}\s/m, "it contains a markdown heading"],
		[/`[^`\n]+`/, "it contains `code` formatting"],
		[/^\s*>\s/m, "it contains a quoted block (\">\"), as if copied with its wrapper"],
		[/^written for:/im, "it contains the line \"Written for:\", which is a note to Paul, not to the customer"],
		[/\b(deploy and push|your lead|send to support|say "[^"]+")/i, "it contains an instruction addressed to Paul"],
		[/\b(sk|rk|pk)_(live|test)_|whsec_|\bBearer\s+[A-Za-z0-9._-]{20,}/, "it contains something that looks like a key or token"],
		[/\/opt\/|\/etc\/|\/root\/|\bsystemd\b|\bnginx\b|\bPostgres\b|\bStripe test key\b/i, "it mentions server internals (a path, a service or a database)"],
		[/\bCounter\b/, "it uses the internal product name \"Counter\""],
	];
	for (const [re, why] of checks) if (re.test(t)) problems.push(why);
	const paras = t.split(/\n\s*\n/);
	if (!/^(hi|hello|g'day|dear|thanks|thank you|good (morning|afternoon|evening))\b/i.test(paras[0] ?? "")) {
		problems.push("it does not open with a greeting, so it may have text above the actual reply");
	}
	return problems;
}

export type AgentReplyResult =
	| { ok: true; messageId: string; to: string; subject: string; emailed: boolean }
	| { ok: false; error: string };

export async function postAgentReply(opts: { ticketId: string; staffId: string | null; text: string }): Promise<AgentReplyResult> {
	const text = opts.text.trim();
	if (!text) return { ok: false, error: "message is empty" };
	const [ticket] = await db.select().from(support_ticket).where(eq(support_ticket.id, opts.ticketId)).limit(1);
	if (!ticket) return { ok: false, error: "ticket not found" };

	const [msg] = await db
		.insert(support_message)
		.values({
			ticket_id: ticket.id,
			author_kind: "agent",
			author_staff_id: opts.staffId,
			body_text: text,
			is_internal_note: false,
			delivery_status: "queued",
		})
		.returning({ id: support_message.id });

	const [lastInbound] = await db
		.select({ mid: support_message.email_message_id })
		.from(support_message)
		.where(
			and(
				eq(support_message.ticket_id, ticket.id),
				eq(support_message.author_kind, "customer"),
				isNotNull(support_message.email_message_id),
			),
		)
		.orderBy(desc(support_message.created_at))
		.limit(1);

	const sent = await sendSupportAgentReply({
		to: ticket.requester_email,
		requesterName: ticket.requester_name,
		ticketId: ticket.id,
		subject: ticket.subject,
		bodyText: text,
		inReplyTo: lastInbound?.mid ?? null,
	}).catch((e) => {
		console.error("[support] agent reply email failed", e);
		return { ok: false };
	});
	await db.update(support_message).set({ delivery_status: sent.ok ? "sent" : "failed" }).where(eq(support_message.id, msg.id));

	await db
		.update(support_ticket)
		.set({
			status: ticket.status === "solved" || ticket.status === "closed" ? "open" : "pending",
			first_responded_at: ticket.first_responded_at ?? new Date(),
			updated_at: new Date(),
		})
		.where(eq(support_ticket.id, ticket.id));

	return { ok: true, messageId: msg.id, to: ticket.requester_email, subject: ticket.subject, emailed: sent.ok };
}
