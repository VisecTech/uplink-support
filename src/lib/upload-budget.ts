/**
 * A daily ceiling on files accepted from people we cannot identify.
 *
 * The contact form takes up to 8 files of 25 MB each from anyone, and writes
 * them to this server's disk. Each submission is small; a script submitting all
 * day is not. Known customers (an Uplink account or a store login) are exempt:
 * they are who the attachments feature is for.
 *
 * The count comes from the database (attachments on web tickets from unverified
 * requesters in the last 24 hours), so it survives restarts, which the
 * in-memory per-address limiter does not.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const ANON_UPLOAD_DAILY_BYTES = 300 * 1024 * 1024;

/** Bytes already accepted from unidentified senders through the web form in the last 24 hours. */
export async function anonymousUploadBytesLastDay(): Promise<number> {
	const rows = (await db.execute(sql`
		SELECT coalesce(sum(a.size_bytes), 0)::bigint AS n
		FROM support_attachment a JOIN support_ticket t ON t.id = a.ticket_id
		WHERE t.channel = 'web' AND t.requester_verified IS NOT TRUE
		  AND a.created_at > now() - interval '24 hours'`)) as unknown as { n: string | number }[];
	return Number(rows[0]?.n ?? 0);
}

/** Why these files cannot be taken right now, or null. Pure. */
export function uploadRefusal(o: { known: boolean; incomingBytes: number; usedBytes: number; supportEmail: string }): string | null {
	if (o.known || o.incomingBytes <= 0) return null;
	if (o.usedBytes + o.incomingBytes <= ANON_UPLOAD_DAILY_BYTES) return null;
	return `We can't take attachments through this form right now. Please send your message without them, or email the files to ${o.supportEmail}.`;
}
