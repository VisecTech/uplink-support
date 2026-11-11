/**
 * GET /api/ext/open-tickets — read-only list of tickets still needing a reply,
 * for Flyleaf's Inbox (2026-11-11). Flyleaf matches each to a client by the
 * requester's email domain and links back here; replies still happen in the desk.
 *
 * ⚠ Loopback + key, both: answers only a request addressed to the loopback
 *   (Host 127.0.0.1/localhost, not https-forwarded, no X-Real-IP) — through
 *   nginx the Host is support.uplink.net.au — and the Bearer key's sha256 must
 *   equal FLYLEAF_FEED_TOKEN_SHA256. (Not an X-Forwarded-For check: Next.js
 *   adds that header to every request, loopback included.)
 *   Unset = 404 for everyone. Read-only; returns no message bodies.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { and, desc, inArray, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { support_ticket } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nope = (status: number) => new Response(status === 404 ? "Not found" : "Forbidden", { status });

export async function GET(req: NextRequest) {
	const want = process.env.FLYLEAF_FEED_TOKEN_SHA256 ?? "";
	if (!/^[0-9a-f]{64}$/.test(want)) return nope(404);
	const host = (req.headers.get("host") ?? "").toLowerCase();
	const local = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host);
	if (!local || req.headers.get("x-forwarded-proto") === "https" || req.headers.get("x-real-ip")) return nope(404);
	const tok = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
	if (!tok) return nope(403);
	const got = createHash("sha256").update(tok).digest("hex");
	if (!timingSafeEqual(Buffer.from(got), Buffer.from(want))) return nope(403);

	const rows = await db
		.select({
			id: support_ticket.id,
			subject: support_ticket.subject,
			requester_email: support_ticket.requester_email,
			requester_name: support_ticket.requester_name,
			status: support_ticket.status,
			priority: support_ticket.priority,
			channel: support_ticket.channel,
			product_kind: support_ticket.product_kind,
			created_at: support_ticket.created_at,
		})
		.from(support_ticket)
		.where(and(isNull(support_ticket.deleted_at), inArray(support_ticket.status, ["open", "pending", "on_hold"])))
		.orderBy(desc(support_ticket.created_at))
		.limit(200);
	return Response.json({ tickets: rows }, { headers: { "Cache-Control": "no-store" } });
}
