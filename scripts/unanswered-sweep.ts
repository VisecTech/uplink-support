/**
 * Unanswered-ticket sweep — the safety net under the staff alerts.
 *
 * WHY THIS EXISTS
 * A new ticket already emails STAFF_ALERT_EMAIL from all four channels. But
 * every one of those calls is fire-and-forget —
 * `sendSupportStaffAlert(...).catch(e => console.error(...))`. If the relay is
 * down, the mailbox rejects, or the process dies mid-send, the alert is gone: the
 * ticket sits in the database, nobody is told, and the customer hears nothing
 * back. Nothing in the system notices.
 *
 * The alert is the happy path. This is the unhappy one, and it catches EVERY way
 * a ticket can be missed — including ways we haven't thought of — because it asks
 * the only question that matters: is anyone waiting on us right now?
 *
 * Same shape as the storefront watchdog, which is what eventually caught the
 * forms that had been silently rejecting submissions for 46 days.
 *
 * ⚠ SILENT WHEN CLEAN. No mail unless somebody is actually waiting, so the one
 * time it does land in the inbox it means something.
 *
 * Env: SWEEP_WAITING_HOURS (default 4), STAFF_ALERT_EMAIL.
 */
import { and, isNull, ne, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { support_message, support_ticket } from "@/db/schema";
import { sendEmail } from "@/lib/email/transport";
import { supportRef } from "@/lib/email/support-emails";

/** How long a customer may wait before it counts as a miss. */
const WAITING_HOURS = Number(process.env.SWEEP_WAITING_HOURS ?? 4);
/** Statuses that mean the conversation is over. */
const CLOSED_STATUSES = ["solved", "closed"];

const siteUrl = () => (process.env.SUPPORT_SITE_URL ?? "https://support.uplink.net.au").replace(/\/$/, "");

type Waiting = {
	id: string;
	subject: string;
	requester: string;
	status: string;
	channel: string;
	waitingSince: Date;
	everAnswered: boolean;
};

async function findWaiting(): Promise<Waiting[]> {
	const tickets = await db
		.select({
			id: support_ticket.id,
			subject: support_ticket.subject,
			requester: support_ticket.requester_email,
			status: support_ticket.status,
			channel: support_ticket.channel,
			created_at: support_ticket.created_at,
		})
		.from(support_ticket)
		.where(and(isNull(support_ticket.deleted_at), notInArray(support_ticket.status, CLOSED_STATUSES)));

	if (tickets.length === 0) return [];

	const messages = await db
		.select({
			ticket_id: support_message.ticket_id,
			author_kind: support_message.author_kind,
			is_internal_note: support_message.is_internal_note,
			created_at: support_message.created_at,
		})
		.from(support_message)
		.where(ne(support_message.author_kind, ""));

	const byTicket = new Map<string, { lastCustomer?: Date; lastAgent?: Date }>();
	for (const m of messages) {
		const slot = byTicket.get(m.ticket_id) ?? {};
		if (m.author_kind === "customer") {
			if (!slot.lastCustomer || m.created_at > slot.lastCustomer) slot.lastCustomer = m.created_at;
		} else if (!m.is_internal_note) {
			// ⚠ Internal notes are NOT an answer. Staff talking to each other about a
			// ticket looks like activity but the customer has still heard nothing.
			if (!slot.lastAgent || m.created_at > slot.lastAgent) slot.lastAgent = m.created_at;
		}
		byTicket.set(m.ticket_id, slot);
	}

	const cutoff = new Date(Date.now() - WAITING_HOURS * 3600_000);
	const waiting: Waiting[] = [];

	for (const t of tickets) {
		const slot = byTicket.get(t.id) ?? {};
		// No customer message recorded (shouldn't happen, but a ticket with no
		// inbound message is still ours to answer) — fall back to when it arrived.
		const lastCustomer = slot.lastCustomer ?? t.created_at;
		const answered = slot.lastAgent ? slot.lastAgent > lastCustomer : false;
		if (answered) continue;
		if (lastCustomer > cutoff) continue; // still inside the grace window
		waiting.push({
			id: t.id,
			subject: t.subject,
			requester: t.requester,
			status: t.status,
			channel: t.channel,
			waitingSince: lastCustomer,
			everAnswered: Boolean(slot.lastAgent),
		});
	}

	// Longest wait first — that is the one most likely to have given up on us.
	waiting.sort((a, b) => a.waitingSince.getTime() - b.waitingSince.getTime());
	return waiting;
}

function hoursAgo(d: Date): string {
	const h = Math.floor((Date.now() - d.getTime()) / 3600_000);
	if (h < 48) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function main() {
	const waiting = await findWaiting();

	if (waiting.length === 0) {
		console.log(`[sweep] clean — nobody waiting longer than ${WAITING_HOURS}h`);
		return;
	}

	const to = process.env.STAFF_ALERT_EMAIL;
	if (!to) {
		// Loud: the sweep found something and cannot tell anyone.
		console.error(`[sweep] ${waiting.length} waiting but STAFF_ALERT_EMAIL is unset`);
		process.exitCode = 1;
		return;
	}

	const rows = waiting
		.map(
			(w) =>
				`<tr>
           <td style="padding:8px 10px;border-top:1px solid #eee"><a href="${siteUrl()}/t/${w.id}" style="color:#991b1b;font-weight:600;text-decoration:none">${supportRef(w.id)}</a></td>
           <td style="padding:8px 10px;border-top:1px solid #eee">${esc(w.subject)}<br/><span style="color:#777;font-size:12px">${esc(w.requester)} · ${esc(w.channel)}</span></td>
           <td style="padding:8px 10px;border-top:1px solid #eee;white-space:nowrap;text-align:right"><strong>${hoursAgo(w.waitingSince)}</strong><br/><span style="color:#777;font-size:12px">${w.everAnswered ? "since our reply" : "never answered"}</span></td>
         </tr>`,
		)
		.join("");

	const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;color:#222">
    <p style="font-size:15px"><strong>${waiting.length} support ${waiting.length === 1 ? "ticket is" : "tickets are"} waiting on a reply.</strong></p>
    <p style="color:#555;font-size:13px">Nobody has answered these for more than ${WAITING_HOURS} hours. If you never saw an alert for one, the alert email is what failed — the ticket is real.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
    <p style="margin-top:18px"><a href="${siteUrl()}/inbox" style="display:inline-block;background:#991b1b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px">Open the inbox</a></p>
  </div>`;

	const text =
		`${waiting.length} support ticket(s) waiting on a reply (>${WAITING_HOURS}h)\n\n` +
		waiting
			.map(
				(w) =>
					`${supportRef(w.id)}  ${hoursAgo(w.waitingSince)}  ${w.everAnswered ? "since our reply" : "NEVER ANSWERED"}\n  ${w.subject}\n  ${w.requester} (${w.channel})\n  ${siteUrl()}/t/${w.id}`,
			)
			.join("\n\n");

	const res = await sendEmail({
		to,
		subject: `${waiting.length} support ticket${waiting.length === 1 ? "" : "s"} waiting on a reply`,
		html,
		text,
	});

	console.log(`[sweep] ${waiting.length} waiting — alert ${res.ok ? "sent" : `FAILED: ${res.error}`}`);
	// ⚠ Exit non-zero if we could not deliver. A sweep that silently fails to
	// send is precisely the failure it was written to catch.
	if (!res.ok) process.exitCode = 1;
}

main()
	.then(() => process.exit(process.exitCode ?? 0))
	.catch((e) => {
		console.error("[sweep] failed", e);
		process.exit(1);
	});
