/**
 * GET /sso?email=&ts=&sig= — SSO entry from the Uplink admin dashboard.
 *
 * The admin app (admin.uplink.net.au) mints a short-lived HMAC-signed token for
 * a logged-in operator and redirects here. We verify the signature + freshness
 * against the shared SUPPORT_SSO_SECRET, match an active support_staff by email,
 * start a staff session, and drop them in the console. Disabled if the secret
 * isn't set.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { support_staff } from "@/db/schema";
import { COOKIE_NAME, issueStaffSessionToken, SESSION_COOKIE_OPTS } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE_S = 120; // token validity window

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	// Redirect against the PUBLIC origin — behind nginx, req.url resolves to the
	// internal bind (127.0.0.1:3081), so url.origin would send the browser there.
	const base = (process.env.SUPPORT_SITE_URL ?? url.origin).replace(/\/$/, "");
	const fail = (reason: string) => {
		const u = new URL("/login", base);
		u.searchParams.set("error", reason);
		return NextResponse.redirect(u);
	};

	const secret = process.env.SUPPORT_SSO_SECRET;
	if (!secret) return fail("sso_disabled");

	const email = (url.searchParams.get("email") || "").trim().toLowerCase();
	const ts = url.searchParams.get("ts") || "";
	const sig = url.searchParams.get("sig") || "";
	if (!email || !ts || !sig) return fail("sso");

	const tsNum = Number(ts);
	if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > MAX_AGE_S) {
		return fail("sso_expired");
	}

	const expected = createHmac("sha256", secret).update(`${email}|${ts}`).digest("hex");
	const a = Buffer.from(expected);
	const b = Buffer.from(sig);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("sso");

	const [staff] = await db
		.select()
		.from(support_staff)
		.where(and(eq(support_staff.email, email), eq(support_staff.active, true), isNull(support_staff.deleted_at)))
		.limit(1);
	if (!staff) return fail("sso_nostaff");

	const { token, expiresAt } = await issueStaffSessionToken(staff.id);
	const res = NextResponse.redirect(new URL("/inbox", base));
	res.cookies.set(COOKIE_NAME, token, { ...SESSION_COOKIE_OPTS, expires: expiresAt });
	return res;
}
