/**
 * POST /t/[id]/draft — AI draft-reply for the console. Staff-only. Returns
 * { ok, draft } for the agent to review/edit/send; it never sends.
 */
import { getCurrentStaff } from "@/lib/auth/staff";
import { draftReply } from "@/lib/support/agent/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const staff = await getCurrentStaff();
	if (!staff) return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
	const { id } = await ctx.params;
	const r = await draftReply(id);
	return Response.json(r, { status: r.ok ? 200 : 400 });
}
