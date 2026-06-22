/**
 * IMAP poller — reads new mail from the support@ Plesk mailbox and turns it into
 * tickets / threaded replies. Run on a 1-minute systemd timer.
 *   IMAP_HOST, IMAP_PORT(=993), IMAP_USER, IMAP_PASSWORD
 * Marks each processed message \Seen so it isn't re-ingested. Idempotent anyway
 * (dedupe on Message-ID in processInboundEmail).
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { processInboundEmail } from "@/lib/inbound/process";

const host = process.env.IMAP_HOST;
const user = process.env.IMAP_USER;
const pass = process.env.IMAP_PASSWORD;
const port = Number(process.env.IMAP_PORT ?? 993);

if (!host || !user || !pass) {
	console.error("[poll-inbound] IMAP_HOST/USER/PASSWORD not set");
	process.exit(1);
}

function refsToArray(v: string | string[] | undefined): string[] {
	if (!v) return [];
	if (Array.isArray(v)) return v;
	return v.split(/\s+/).filter(Boolean);
}

async function main() {
	const client = new ImapFlow({
		host: host as string,
		port,
		secure: true,
		auth: { user: user as string, pass: pass as string },
		logger: false,
	});
	await client.connect();
	const lock = await client.getMailboxLock("INBOX");
	let processed = 0;
	let skipped = 0;
	try {
		// UNSEEN only — \Seen marks our processed boundary.
		const uids = await client.search({ seen: false }, { uid: true });
		if (!uids || uids.length === 0) {
			console.log("[poll-inbound] no new mail");
			return;
		}
		for (const uid of uids) {
			try {
				const { content } = await client.download(String(uid), undefined, { uid: true });
				const parsed = await simpleParser(content);
				const fromAddr = parsed.from?.value?.[0];
				const result = await processInboundEmail({
					messageId: parsed.messageId ?? null,
					fromEmail: (fromAddr?.address ?? "").toLowerCase(),
					fromName: fromAddr?.name || null,
					subject: parsed.subject ?? "",
					inReplyTo: (parsed.inReplyTo as string | undefined) ?? null,
					references: refsToArray(parsed.references),
					text: parsed.text ?? (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : ""),
					autoSubmitted: Boolean(parsed.headers.get("auto-submitted") && parsed.headers.get("auto-submitted") !== "no"),
					attachments: (parsed.attachments ?? []).map((a) => ({
						filename: a.filename ?? "attachment",
						content: a.content,
						contentType: a.contentType ?? null,
						size: a.size ?? a.content.length,
					})),
				});
				if (result.ok) {
					processed++;
					console.log(`[poll-inbound] ${result.action} ticket ${result.ticketId} (uid ${uid})`);
				} else {
					skipped++;
					console.log(`[poll-inbound] skipped (${result.skipped}) uid ${uid}`);
				}
				// Mark seen regardless (skips are intentional, dups already handled).
				await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
			} catch (e) {
				console.error(`[poll-inbound] failed uid ${uid}:`, e instanceof Error ? e.message : e);
			}
		}
	} finally {
		lock.release();
		await client.logout();
	}
	console.log(`[poll-inbound] done — ${processed} processed, ${skipped} skipped`);
	process.exit(0);
}

main().catch((e) => {
	console.error("[poll-inbound] fatal:", e instanceof Error ? e.message : e);
	process.exit(1);
});
