import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { canonicalConfigured } from "@/db/canonical-readonly";

export const dynamic = "force-dynamic";

export async function GET() {
	let ownDb = false;
	try {
		await db.execute(sql`select 1`);
		ownDb = true;
	} catch {
		ownDb = false;
	}
	return NextResponse.json({
		app: "uplink-support",
		ok: ownDb,
		ownDb,
		canonicalConfigured: canonicalConfigured(),
		ts: new Date().toISOString(),
	});
}
