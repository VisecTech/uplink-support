/**
 * Send an agent reply to a customer from the command line, exactly as the
 * console's reply box does. This is what "send to support" runs.
 *
 *   agent-reply.ts --ticket <id or UWS-ref> --to <customer email> --file <reply.txt>           # dry run
 *   agent-reply.ts --ticket <id or UWS-ref> --to <customer email> --file <reply.txt> --send
 *
 * Safeguards, all of which stop the send:
 *   --to must equal the ticket's requester (the ticket and the person are named separately on purpose);
 *   the text must pass replyProblems (no markdown, notes to Paul, keys, server internals; opens with a greeting);
 *   the dry run prints the WHOLE text that would be sent, so what is checked is what goes.
 * --force skips the text checks only (never the --to check); use it when a flagged phrase is intended.
 * Run with the service's env (see scripts/agent-reply.sh).
 */
import { readFileSync } from "node:fs";
import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { support_message, support_staff, support_ticket } from "@/db/schema";
import { postAgentReply, replyProblems } from "@/lib/agent-reply";
import { supportRef } from "@/lib/email/support-emails";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const has = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<number> {
	const ticketArg = arg("ticket"), to = arg("to")?.trim().toLowerCase(), file = arg("file");
	if (!ticketArg || !to || !file) { console.error("usage: --ticket <id|UWS-ref> --to <customer email> --file <reply.txt> [--send] [--force]"); return 2; }
	const text = readFileSync(file, "utf8").trim();

	const ref = ticketArg.replace(/^\[?UWS-/i, "").replace(/\]$/, "");
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketArg);
	if (!isUuid && !/^[0-9a-f]{6,32}$/i.test(ref)) { console.error(`"${ticketArg}" is neither a ticket id nor a UWS reference`); return 2; }
	const found = await db.select().from(support_ticket)
		.where(isUuid ? eq(support_ticket.id, ticketArg) : or(eq(support_ticket.email_thread_key, `UWS-${ref.toUpperCase()}`), sql`replace(${support_ticket.id}::text, '-', '') LIKE ${`${ref.toLowerCase()}%`}`))
		.limit(2);
	if (found.length !== 1) { console.error(found.length === 0 ? "no ticket matches" : "more than one ticket matches that reference; use the full id"); return 1; }
	const ticket = found[0]!;
	if (ticket.requester_email.trim().toLowerCase() !== to) {
		console.error(`REFUSED: ticket ${supportRef(ticket.id)} belongs to a different address than --to. Nothing sent.`);
		return 1;
	}

	// Who it is recorded as: the agent who last replied on this ticket, else the only active admin.
	const [last] = await db.select({ id: support_message.author_staff_id }).from(support_message)
		.where(sql`${support_message.ticket_id} = ${ticket.id} AND ${support_message.author_kind} = 'agent' AND ${support_message.author_staff_id} IS NOT NULL`)
		.orderBy(desc(support_message.created_at)).limit(1);
	let staffId = last?.id ?? null;
	if (!staffId) {
		const admins = await db.select({ id: support_staff.id }).from(support_staff).where(sql`${support_staff.active} AND ${support_staff.role} = 'admin'`);
		if (admins.length === 1) staffId = admins[0]!.id;
	}
	const [staff] = staffId ? await db.select({ name: support_staff.name }).from(support_staff).where(eq(support_staff.id, staffId)).limit(1) : [];

	const problems = replyProblems(text);
	console.log(`ticket:   ${supportRef(ticket.id)}  "${ticket.subject}"  (status ${ticket.status}, product ${ticket.product_kind})`);
	console.log(`to:       ${ticket.requester_email}${ticket.requester_name ? `  (${ticket.requester_name})` : ""}`);
	console.log(`as:       ${staff?.name ?? "no staff member (recorded without an author)"}`);
	console.log(`length:   ${text.length} characters, ${text.split("\n").length} lines`);
	console.log("----- text that will be sent -----");
	console.log(text);
	console.log("----- end -----");
	if (problems.length) {
		console.log(`CHECKS: ${problems.length} problem(s):`);
		for (const p of problems) console.log(`  - ${p}`);
		if (!has("force")) { console.log("Nothing sent. Fix the text, or add --force if every flagged item is intended."); return 1; }
		console.log("(--force given: continuing despite the above)");
	} else console.log("CHECKS: passed");

	if (!has("send")) { console.log("DRY RUN: nothing sent. Add --send to send it."); return 0; }
	const r = await postAgentReply({ ticketId: ticket.id, staffId, text });
	if (!r.ok) { console.error(`FAILED: ${r.error}`); return 1; }
	if (!r.emailed) { console.error("RECORDED on the ticket but the EMAIL WAS NOT SENT. Check mail settings, then send again."); return 1; }
	console.log(`SENT to ${r.to} and recorded on the ticket (message ${r.messageId}).`);
	return 0;
}

main().then((c) => process.exit(c)).catch((e) => {
	const cause = (e as { cause?: { message?: string } })?.cause;
	console.error("FAILED:", cause?.message ?? String(e instanceof Error ? e.message : e).split("\n")[0]!.split("params:")[0]!.slice(0, 200));
	process.exit(1);
});
