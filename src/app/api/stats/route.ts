/**
 * GET /api/stats — aggregate ticket counts for the admin dashboard card.
 * Token-gated (x-stats-token header == SUPPORT_SSO_SECRET) since it's consumed
 * server-to-server by admin.uplink.net.au. Returns small JSON, no PII.
 */
import { and, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { support_ticket } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function countWhere(cond: ReturnType<typeof and>): Promise<number> {
	const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(support_ticket).where(cond);
	return r?.n ?? 0;
}

export async function GET(req: NextRequest) {
	const secret = process.env.SUPPORT_SSO_SECRET;
	const token = req.headers.get("x-stats-token");
	if (!secret || !token || token !== secret) {
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
