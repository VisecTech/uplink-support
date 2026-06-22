import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { support_attachment } from "@/db/schema";
import { getCurrentStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string; attId: string }> },
) {
	const staff = await getCurrentStaff();
	if (!staff) return new NextResponse("unauthorised", { status: 401 });

	const { id, attId } = await params;
	const [att] = await db
		.select()
		.from(support_attachment)
		.where(and(eq(support_attachment.id, attId), eq(support_attachment.ticket_id, id)))
		.limit(1);
	if (!att) return new NextResponse("not found", { status: 404 });

	try {
		const buf = await readFile(att.disk_path);
		return new NextResponse(new Uint8Array(buf), {
			headers: {
				"Content-Type": att.mime_type || "application/octet-stream",
				"Content-Disposition": `attachment; filename="${att.sanitized_filename}"`,
				"Content-Length": String(att.size_bytes),
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch {
		return new NextResponse("file unavailable", { status: 410 });
	}
}
