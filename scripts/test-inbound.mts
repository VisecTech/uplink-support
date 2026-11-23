// Inbound email threading and the "who sent it" mark. Needs a SCRATCH database:
//   DATABASE_URL=postgres://…/uplink_support_test node --import tsx --test scripts/test-inbound.mts
// Refuses to run against anything whose name does not end in _test.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!/_test(\?|$)/.test(url)) throw new Error("DATABASE_URL must name a database ending in _test");
delete process.env.POOL_DATABASE_URL; // the app's pool would prefer it over DATABASE_URL
delete process.env.SMTP_HOST; // mail goes to disk, never out
const sql = postgres(url, { max: 1, onnotice: () => {} });
const { processInboundEmail, refFromSubject, sameSender, flushInboundMail } = await import("../src/lib/inbound/process.ts");
const { supportRef } = await import("../src/lib/email/support-emails.ts");

before(async () => {
	const [{ db }] = await sql`select current_database() as db`;
	assert.match(db, /_test$/);
});
beforeEach(async () => { await sql`truncate support_ticket cascade`; });
after(async () => { await flushInboundMail(5000); await sql.end({ timeout: 5 }); });

const mail = (o: Record<string, unknown>) => ({
	messageId: `<${randomUUID()}@test>`, fromEmail: "customer@shop.example", fromName: "Customer", subject: "Help",
	inReplyTo: null, references: [], text: "hello", autoSubmitted: false, attachments: [], recipients: ["support@uplink.net.au"], ...o,
});
async function open(o: Record<string, unknown> = {}) {
	const r = await processInboundEmail(mail(o) as never);
	assert.equal(r.ok && r.action, "created");
	return (r as { ticketId: string }).ticketId;
}
const msgs = (id: string) => sql`select sender_email, sender_mismatch, body_text from support_message where ticket_id = ${id} order by created_at`;

test("pure: reference and sender helpers", () => {
	assert.equal(refFromSubject("Re: Help [UWS-3f9a2c]"), "3F9A2C");
	assert.equal(refFromSubject("Re: Help [UWS-3F9A2C1B7D] extra"), "3F9A2C1B7D");
	assert.equal(refFromSubject("[UWS-XYZ123]"), null, "not hex");
	assert.equal(refFromSubject("[UWS-3F9A]"), null, "too short to mean anything");
	assert.equal(sameSender(" Customer@Shop.Example ", "customer@shop.example"), true);
	assert.equal(sameSender("other@shop.example", "customer@shop.example"), false);
	assert.equal(sameSender("", ""), false);
	assert.equal(supportRef("3f9a2c1b-7d44-4e0a-9c11-000000000000"), "UWS-3F9A2C1B7D");
});

test("⚠⚠ a stranger quoting the reference is filed, but MARKED as a different sender", async () => {
	const id = await open();
	const r = await processInboundEmail(mail({ fromEmail: "stranger@elsewhere.example", subject: `Re: Help [${supportRef(id)}]`, text: "please change the bank details" }) as never);
	assert.deepEqual([r.ok, r.ok && r.action, r.ok && r.ticketId], [true, "appended", id]);
	const m = await msgs(id);
	assert.equal(m.length, 2);
	assert.deepEqual([m[1].sender_email, m[1].sender_mismatch], ["stranger@elsewhere.example", true]);
});

test("control: the requester's own reply is not marked, whatever the letter case", async () => {
	const id = await open();
	await processInboundEmail(mail({ fromEmail: "CUSTOMER@Shop.Example", subject: `RE: Help [${supportRef(id)}]` }) as never);
	const m = await msgs(id);
	assert.deepEqual([m[1].sender_email, m[1].sender_mismatch], ["CUSTOMER@Shop.Example", false]);
	assert.equal(m[0].sender_email, "customer@shop.example", "the opening message records its sender too");
});

test("an old six-character reference from a customer's inbox still reaches its ticket", async () => {
	const id = await open();
	const six = id.replace(/-/g, "").slice(0, 6).toUpperCase();
	const r = await processInboundEmail(mail({ subject: `Re: Help [UWS-${six}]` }) as never);
	assert.equal(r.ok && r.ticketId, id);
});

test("a reply header beats the subject: it lands on the ticket it actually answers", async () => {
	const a = await open({ messageId: "<first-of-a@test>" });
	const b = await open({ subject: "Other" });
	// Answers ticket A (In-Reply-To) but someone pasted ticket B's reference into the subject.
	const r = await processInboundEmail(mail({ inReplyTo: "<first-of-a@test>", subject: `Re: [${supportRef(b)}]` }) as never);
	assert.equal(r.ok && r.ticketId, a);
});

test("two tickets cannot hold the same reference", async () => {
	const a = await open();
	const b = await open({ subject: "Other" });
	const [{ k }] = await sql`select email_thread_key as k from support_ticket where id = ${a}`;
	assert.equal(k, supportRef(a));
	await assert.rejects(() => sql`update support_ticket set email_thread_key = ${k} where id = ${b}`, /support_ticket_thread_key_unique/);
});

test("a reference that matches nothing opens a new ticket; it never attaches to a random one", async () => {
	const a = await open();
	const r = await processInboundEmail(mail({ fromEmail: "new@person.example", subject: "Re: [UWS-FFFFFFFFFF]" }) as never);
	assert.equal(r.ok && r.action, "created");
	assert.notEqual(r.ok && r.ticketId, a);
});
