/**
 * IMAP poller — reads new mail from the support@ Plesk mailbox and turns it into
 * tickets / threaded replies. Run on a 1-minute systemd timer.
 *   IMAP_HOST, IMAP_PORT(=993), IMAP_USER, IMAP_PASSWORD
 * Marks each processed message \Seen so it isn't re-ingested. Idempotent anyway
 * (dedupe on Message-ID in processInboundEmail).
 *
 * Two passes:
 *  1. INBOX — every unseen message becomes a ticket or a threaded reply.
 *  2. INBOX.Spam — the server's anti-spam moves mail here, and until 2026-09-15
 *     nothing ever looked: a real client misfiled as spam simply vanished. A Spam
 *     message is only RESCUED when it is clearly ours (a reply to an existing
 *     ticket, a sender with an earlier ticket, or a known customer — see
 *     spamRescueReason). Everything else stays in Spam, unread, tagged
 *     $UwsSpamChecked so it is judged once, not every minute.
 */
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { flushInboundMail, type InboundEmail, processInboundEmail, spamRescueReason } from "@/lib/inbound/process";

const host = process.env.IMAP_HOST;
const user = process.env.IMAP_USER;
const pass = process.env.IMAP_PASSWORD;
const port = Number(process.env.IMAP_PORT ?? 993);

const SPAM_FOLDER = "INBOX.Spam";
const SPAM_CHECKED = "$UwsSpamChecked";

if (!host || !user || !pass) {
	console.error("[poll-inbound] IMAP_HOST/USER/PASSWORD not set");
	process.exit(1);
}

function refsToArray(v: string | string[] | undefined): string[] {
	if (!v) return [];
	if (Array.isArray(v)) return v;
	return v.split(/\s+/).filter(Boolean);
}

function toInbound(parsed: ParsedMail): InboundEmail {
	const fromAddr = parsed.from?.value?.[0];
	return {
		messageId: parsed.messageId ?? null,
		fromEmail: (fromAddr?.address ?? "").toLowerCase(),
		fromName: fromAddr?.name || null,
		subject: parsed.subject ?? "",
		inReplyTo: (parsed.inReplyTo as string | undefined) ?? null,
		references: refsToArray(parsed.references),
		text: parsed.text ?? (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : ""),
		autoSubmitted: Boolean(parsed.headers.get("auto-submitted") && parsed.headers.get("auto-submitted") !== "no"),
		// Raw recipient header lines, most-specific first: X-Original-To carries the
		// support+<product>@ plus-address the client (or a product's Support link) used.
		recipients: ["x-original-to", "delivered-to", "to", "cc"].flatMap((key) =>
			(parsed.headerLines ?? []).filter((h) => h.key === key).map((h) => h.line),
		),
		attachments: (parsed.attachments ?? []).map((a) => ({
			filename: a.filename ?? "attachment",
			content: a.content,
			contentType: a.contentType ?? null,
			size: a.size ?? a.content.length,
		})),
	};
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
	let processed = 0;
	let skipped = 0;
	let rescued = 0;
	let held = 0;
	try {
		// ---- Pass 1: INBOX ----
		const lock = await client.getMailboxLock("INBOX");
		try {
			// UNSEEN only — \Seen marks our processed boundary.
			const uids = (await client.search({ seen: false }, { uid: true })) || [];
			for (const uid of uids) {
				try {
					const { content } = await client.download(String(uid), undefined, { uid: true });
					const result = await processInboundEmail(toInbound(await simpleParser(content)));
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
		}

		// ---- Pass 2: INBOX.Spam — rescue only what is clearly ours ----
		let spamLock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null;
		try {
			spamLock = await client.getMailboxLock(SPAM_FOLDER);
		} catch (e) {
			// A missing Spam folder is not an error worth failing the run over.
			console.log(`[poll-inbound] no ${SPAM_FOLDER} folder (${e instanceof Error ? e.message : e})`);
		}
		if (spamLock) {
			try {
				const uids = (await client.search({ seen: false, unKeyword: SPAM_CHECKED }, { uid: true })) || [];
				for (const uid of uids) {
					try {
						const { content } = await client.download(String(uid), undefined, { uid: true });
						const email = toInbound(await simpleParser(content));
						const reason = await spamRescueReason(email);
						if (!reason) {
							held++;
							console.log(`[poll-inbound] spam held (not ours) uid ${uid}`);
							await client.messageFlagsAdd(String(uid), [SPAM_CHECKED], { uid: true });
							continue;
						}
						const result = await processInboundEmail(email);
						if (result.ok) {
							rescued++;
							console.log(`[poll-inbound] rescued from Spam (${reason}): ${result.action} ticket ${result.ticketId} (uid ${uid})`);
						} else {
							console.log(`[poll-inbound] spam rescue skipped (${result.skipped}) uid ${uid}`);
						}
						await client.messageFlagsAdd(String(uid), ["\\Seen", SPAM_CHECKED], { uid: true });
					} catch (e) {
						console.error(`[poll-inbound] spam check failed uid ${uid}:`, e instanceof Error ? e.message : e);
					}
				}
			} finally {
				spamLock.release();
			}
		}
	} finally {
		// Wait for the alerts/confirmations processInboundEmail started. Exiting first
		// kills their SMTP connections mid-send — every alert from the 2026-09-15 test
		// run was lost that way.
		await flushInboundMail();
		await client.logout();
	}
	console.log(
		processed || skipped || rescued || held
			? `[poll-inbound] done — ${processed} processed, ${skipped} skipped, ${rescued} rescued from Spam, ${held} spam held`
			: "[poll-inbound] no new mail",
	);
	process.exit(0);
}

main().catch((e) => {
	console.error("[poll-inbound] fatal:", e instanceof Error ? e.message : e);
	process.exit(1);
});
