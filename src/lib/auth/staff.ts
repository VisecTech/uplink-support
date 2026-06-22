/**
 * Staff auth for the support console — OWN auth, independent of Counter.
 * Mirrors Counter's uplink-customer session pattern (SHA-256 token hash + cookie),
 * but against our own support_staff / support_staff_session tables.
 */
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { type SupportStaff, support_staff, support_staff_session } from "@/db/schema";

export const COOKIE_NAME = "support_session";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30d

function tokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export type StaffPublic = Pick<SupportStaff, "id" | "email" | "name" | "role">;

/** Verify credentials; returns the staff row or null. */
export async function verifyStaffCredentials(
	email: string,
	password: string,
): Promise<SupportStaff | null> {
	const [s] = await db
		.select()
		.from(support_staff)
		.where(eq(support_staff.email, email.trim().toLowerCase()))
		.limit(1);
	if (!s || !s.active || s.deleted_at) return null;
	const ok = await bcrypt.compare(password, s.password_hash);
	return ok ? s : null;
}

/** Insert a session row and return the raw token (no cookie set). Lets callers
 *  that can't use next/headers cookies() — e.g. a Route Handler issuing a
 *  redirect — set the cookie on their own response. */
export async function issueStaffSessionToken(staffId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE_S * 1000);
	await db.insert(support_staff_session).values({
		staff_id: staffId,
		token_hash: tokenHash(token),
		expires_at: expiresAt,
	});
	await db.update(support_staff).set({ last_login_at: new Date() }).where(eq(support_staff.id, staffId));
	return { token, expiresAt };
}

export const SESSION_COOKIE_OPTS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
	maxAge: COOKIE_MAX_AGE_S,
};

export async function createStaffSession(staffId: string): Promise<void> {
	const { token, expiresAt } = await issueStaffSessionToken(staffId);
	const jar = await cookies();
	jar.set(COOKIE_NAME, token, { ...SESSION_COOKIE_OPTS, expires: expiresAt });
}

export async function destroyStaffSession(): Promise<void> {
	const jar = await cookies();
	const token = jar.get(COOKIE_NAME)?.value;
	if (token) {
		await db
			.delete(support_staff_session)
			.where(eq(support_staff_session.token_hash, tokenHash(token)));
	}
	jar.delete(COOKIE_NAME);
}

export async function getCurrentStaff(): Promise<StaffPublic | null> {
	const jar = await cookies();
	const token = jar.get(COOKIE_NAME)?.value;
	if (!token) return null;
	const rows = await db
		.select({
			id: support_staff.id,
			email: support_staff.email,
			name: support_staff.name,
			role: support_staff.role,
			active: support_staff.active,
			deleted_at: support_staff.deleted_at,
			expiresAt: support_staff_session.expires_at,
		})
		.from(support_staff_session)
		.innerJoin(support_staff, eq(support_staff_session.staff_id, support_staff.id))
		.where(eq(support_staff_session.token_hash, tokenHash(token)))
		.limit(1);
	const r = rows[0];
	if (!r) return null;
	if (r.expiresAt < new Date() || !r.active || r.deleted_at) {
		await db
			.delete(support_staff_session)
			.where(eq(support_staff_session.token_hash, tokenHash(token)));
		return null;
	}
	return { id: r.id, email: r.email, name: r.name, role: r.role };
}

export async function requireStaff(): Promise<StaffPublic> {
	const s = await getCurrentStaff();
	if (!s) redirect("/login");
	return s;
}
