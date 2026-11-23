// The reply tool and its text checks. Needs a SCRATCH database; mail goes to disk, never out.
//   DATABASE_URL=postgres://…/uplink_support_test node --import tsx --test scripts/test-agent-reply.mts
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!/_test(\?|$)/.test(url)) throw new Error("DATABASE_URL must name a database ending in _test");
delete process.env.POOL_DATABASE_URL; delete process.env.SMTP_HOST;
const sql = postgres(url, { max: 1, onnotice: () => {} });
const { replyProblems, postAgentReply } = await import("../src/lib/agent-reply.ts");
const dir = mkdtempSync(join(tmpdir(), "reply-"));
const GOOD = "Hi Tim,\n\nSorted. Payments are live now, so you can choose your plan and pay as normal.\n\nCheers,\nPaul";
// What was really pasted into a reply on 2026-11-23 (shortened): findings and options for Paul, then the draft.
const LEAK = "Tim can't pay because CourseKit's billing has never been switched from Stripe's test mode to live.\n\n**What I found**\n- CourseKit's running settings hold a Stripe test key.\n\nEither way, say \"go live\" with your choice.\n\n**Reply to Tim**\n\nWritten for: Tim, a new CourseKit customer.\n\n> Hi Tim,\n>\n> Thanks for flagging this.";

let ticketId = "", staffId = "";
beforeEach(async () => {
	await sql`truncate support_ticket, support_staff cascade`;
	[{ id: staffId }] = await sql`insert into support_staff (email, name, password_hash, role) values ('paul@test.example', 'Paul', 'x', 'admin') returning id`;
	[{ id: ticketId }] = await sql`insert into support_ticket (requester_email, requester_name, product_kind, status, priority, channel, subject, customer_token) values ('tim@customer.example', 'Tim', 'coursekit', 'open', 'normal', 'email', 'Cannot pay', ${"t".repeat(64)}) returning id`;
	await sql`insert into support_message (ticket_id, author_kind, body_text, email_message_id) values (${ticketId}, 'customer', 'help', '<their-last@mail.example>')`;
});
after(async () => { await sql.end({ timeout: 5 }); });

const run = (args: string[]) => spawnSync("node_modules/.bin/tsx", ["scripts/agent-reply.ts", ...args], { encoding: "utf8", env: { ...process.env } });
const file = (name: string, text: string) => { const p = join(dir, name); writeFileSync(p, text); return p; };
const agentMsgs = () => sql`select body_text, delivery_status, author_staff_id, is_internal_note from support_message where ticket_id = ${ticketId} and author_kind = 'agent'`;

test("⚠⚠ the message that really leaked on 23 Nov is refused, with reasons", () => {
	const p = replyProblems(LEAK);
	assert.ok(p.length >= 4, `only ${p.length} problem(s) found: ${p.join(" | ")}`);
	for (const expect of [/bold/, /Written for/, /addressed to Paul/, /greeting/, /quoted block/]) assert.ok(p.some((x) => expect.test(x)), `missing: ${expect}`);
});

test("an ordinary reply passes; each kind of stray text is caught on its own", () => {
	assert.deepEqual(replyProblems(GOOD), []);
	assert.deepEqual(replyProblems("G'day Tim,\n\nAll fixed.\n\nPaul"), []);
	const bad: [string, RegExp][] = [
		["Hi Tim,\n\nThe key is sk_live_abcdefghijklmnop1234.\n\nPaul", /key or token/],
		["Hi Tim,\n\nI restarted nginx and it is fine now.\n\nPaul", /server internals/],
		["Hi Tim,\n\nYour Counter store is ready.\n\nPaul", /Counter/],
		["Hi Tim,\n\nSay \"deploy and push\" and I'll run it.\n\nPaul", /addressed to Paul/],
		["Here is what I found.\n\nHi Tim,\n\nAll fixed.\n\nPaul", /greeting/],
		["", /empty/],
		[`Hi Tim,\n\n${"x".repeat(6100)}`, /characters long/],
	];
	for (const [text, why] of bad) assert.ok(replyProblems(text).some((x) => why.test(x)), `not caught: ${why}`);
});

test("the tool: a dry run shows the whole text and sends nothing", async () => {
	const r = run(["--ticket", ticketId, "--to", "tim@customer.example", "--file", file("good.txt", GOOD)]);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /DRY RUN: nothing sent/);
	assert.ok(r.stdout.includes(GOOD));
	assert.equal((await agentMsgs()).length, 0);
});

test("the tool: --send records the reply as the admin, marks it sent, and sets the ticket pending", async () => {
	const r = run(["--ticket", ticketId, "--to", "TIM@customer.example", "--file", file("good.txt", GOOD), "--send"]);
	assert.equal(r.status, 0, r.stdout + r.stderr);
	assert.match(r.stdout, /SENT to tim@customer.example/);
	const m = await agentMsgs();
	assert.deepEqual([m.length, m[0].body_text, m[0].delivery_status, m[0].author_staff_id, m[0].is_internal_note], [1, GOOD, "sent", staffId, false]);
	const [{ status }] = await sql`select status from support_ticket where id = ${ticketId}`;
	assert.equal(status, "pending");
});

test("the tool: the leaked message is NOT sent, even with --send", async () => {
	const r = run(["--ticket", ticketId, "--to", "tim@customer.example", "--file", file("leak.txt", LEAK), "--send"]);
	assert.equal(r.status, 1);
	assert.match(r.stdout, /Nothing sent/);
	assert.equal((await agentMsgs()).length, 0);
});

test("the tool: the wrong customer address stops it, and --force does not override that", async () => {
	const r = run(["--ticket", ticketId, "--to", "someone.else@customer.example", "--file", file("good.txt", GOOD), "--send", "--force"]);
	assert.equal(r.status, 1);
	assert.match(r.stderr, /REFUSED/);
	assert.equal((await agentMsgs()).length, 0);
});

test("the tool: a short reference finds the ticket; an unknown one sends nothing", async () => {
	const ref = `UWS-${ticketId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
	assert.equal(run(["--ticket", ref, "--to", "tim@customer.example", "--file", file("good.txt", GOOD)]).status, 0);
	assert.equal(run(["--ticket", "UWS-FFFFFFFFFF", "--to", "tim@customer.example", "--file", file("good.txt", GOOD), "--send"]).status, 1);
	assert.equal((await agentMsgs()).length, 0);
});

test("the shared function is what the console uses: same record, same status", async () => {
	const r = await postAgentReply({ ticketId, staffId, text: GOOD });
	assert.equal(r.ok && r.emailed, true);
	assert.equal(r.ok && r.to, "tim@customer.example");
});
