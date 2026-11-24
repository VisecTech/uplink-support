/**
 * GET /api/stats — aggregate ticket counts for the admin dashboard card.
 * Token-gated (x-stats-token header == SUPPORT_STATS_TOKEN) since it's consumed
 * server-to-server by admin.uplink.net.au. Returns small JSON, no PII.
 *
 * ⚠ Its OWN token (audit low #68, 2026-11-24). This used to accept SUPPORT_SSO_SECRET, the
 * key that signs staff sign-in links, so a low-value counts endpoint was a place to guess the
 * high-value key. The sign-in key is not accepted here any more.
 */
import { and, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { support_ticket } from "@/db/schema";
import { sameSecret } from "@/lib/auth/shared-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function countWhere(cond: ReturnType<typeof and>): Promise<number> {
	const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(support_ticket).where(cond);
	return r?.n ?? 0;
}

export async function GET(req: NextRequest) {
	if (!sameSecret(req.headers.get("x-stats-token"), process.env.SUPPORT_STATS_TOKEN)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const notDeleted = isNull(support_ticket.deleted_at);
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	const [open, pending, onHold, unassigned, solvedToday] = await Promise.all([
		countWhere(and(notDeleted, eq(support_ticket.status, "open"))),
		countWhere(and(notDeleted, eq(support_ticket.status, "pending"))),
		countWhere(and(notDeleted, eq(support_ticket.status, "on_hold"))),
		countWhere(
			and(
				notDeleted,
				isNull(support_ticket.assignee_staff_id),
				ne(support_ticket.status, "solved"),
				ne(support_ticket.status, "closed"),
			),
		),
		countWhere(and(notDeleted, eq(support_ticket.status, "solved"), gte(support_ticket.solved_at, startOfToday))),
	]);

	return NextResponse.json({
		open,
		pending,
		on_hold: onHold,
		unassigned,
		active: open + pending + onHold,
		solved_today: solvedToday,
		ts: new Date().toISOString(),
	});
}
