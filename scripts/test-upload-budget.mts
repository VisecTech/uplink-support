// The daily ceiling on files from unidentified senders. Needs a SCRATCH database.
//   DATABASE_URL=postgres://…/uplink_support_test node --import tsx --test --test-concurrency=1 scripts/test-upload-budget.mts
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!/_test(\?|$)/.test(url)) throw new Error("DATABASE_URL must name a database ending in _test");
delete process.env.POOL_DATABASE_URL;
const sql = postgres(url, { max: 1, onnotice: () => {} });
const { ANON_UPLOAD_DAILY_BYTES, anonymousUploadBytesLastDay, uploadRefusal } = await import("../src/lib/upload-budget.ts");
const MB = 1024 * 1024;

beforeEach(async () => { await sql`truncate support_ticket cascade`; });
after(async () => { await sql.end({ timeout: 5 }); });

async function ticketWithFile(o: { channel: string; verified: boolean | null; bytes: number; ageHours?: number }) {
	const [{ id }] = await sql`insert into support_ticket (requester_email, product_kind, status, priority, channel, subject, customer_token, requester_verified)
		values ('x@y.example', 'general', 'open', 'normal', ${o.channel}, 's', ${Math.random().toString(36).repeat(4)}, ${o.verified}) returning id`;
	const [{ id: mid }] = await sql`insert into support_message (ticket_id, author_kind, body_text) values (${id}, 'customer', 'b') returning id`;
	await sql`insert into support_attachment (message_id, ticket_id, original_filename, sanitized_filename, disk_path, size_bytes, created_at)
		values (${mid}, ${id}, 'f', 'f', '/nowhere/f', ${o.bytes}, now() - make_interval(hours => ${o.ageHours ?? 0}))`;
}

test("pure: under the ceiling passes, over it is refused, and a known customer is never refused", () => {
	const base = { supportEmail: "support@uplink.net.au" };
	assert.equal(uploadRefusal({ ...base, known: false, incomingBytes: 50 * MB, usedBytes: 0 }), null);
	assert.equal(uploadRefusal({ ...base, known: false, incomingBytes: 50 * MB, usedBytes: ANON_UPLOAD_DAILY_BYTES - 50 * MB }), null, "exactly at the ceiling");
	assert.match(uploadRefusal({ ...base, known: false, incomingBytes: 50 * MB, usedBytes: ANON_UPLOAD_DAILY_BYTES - 50 * MB + 1 }) ?? "", /support@uplink\.net\.au/);
	assert.equal(uploadRefusal({ ...base, known: true, incomingBytes: 200 * MB, usedBytes: 10 * ANON_UPLOAD_DAILY_BYTES }), null);
	assert.equal(uploadRefusal({ ...base, known: false, incomingBytes: 0, usedBytes: 10 * ANON_UPLOAD_DAILY_BYTES }), null, "a message with no files is always fine");
});

test("the count is only unidentified senders, only the web form, only the last 24 hours", async () => {
	await ticketWithFile({ channel: "web", verified: false, bytes: 10 * MB });
	await ticketWithFile({ channel: "web", verified: null, bytes: 5 * MB });           // counted: not known to be verified
	await ticketWithFile({ channel: "web", verified: true, bytes: 100 * MB });         // a known customer
	await ticketWithFile({ channel: "email", verified: false, bytes: 100 * MB });      // came by email, not the form
	await ticketWithFile({ channel: "web", verified: false, bytes: 100 * MB, ageHours: 25 }); // yesterday
	assert.equal(await anonymousUploadBytesLastDay(), 15 * MB);
});

test("an empty table counts as zero, not null", async () => {
	assert.equal(await anonymousUploadBytesLastDay(), 0);
});

test("a script filling the form all day is stopped at the ceiling", async () => {
	let accepted = 0;
	for (let i = 0; i < 20; i++) {
		const refusal = uploadRefusal({ known: false, incomingBytes: 25 * MB, usedBytes: await anonymousUploadBytesLastDay(), supportEmail: "s@x" });
		if (refusal) break;
		await ticketWithFile({ channel: "web", verified: false, bytes: 25 * MB });
		accepted++;
	}
	assert.equal(accepted, 12, "12 × 25 MB = 300 MB, then no more");
});
