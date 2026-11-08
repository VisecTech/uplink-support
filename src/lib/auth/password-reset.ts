/**
 * Staff "forgot password" — request a link by email, then set a new password.
 *
 * ⚠ The request step answers the SAME way whether or not the address belongs to
 * a staff member, so the form cannot be used to discover who has a login.
 * Rate-limited per IP and per address (3/h each, the public-form limiter).
 *
 * Tokens: 32 random bytes, emailed raw, stored only as SHA-256 (same scheme as
 * sessions). 30-minute life, single use. A new request voids older unused links.
 * Consuming is ONE conditional UPDATE, so a double-click or a replay cannot set
 * the password twice. A successful reset deletes every session for that staff
 * member — whoever was locked out should not stay locked in elsewhere.
 */
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { support_staff, support_staff_password_reset, support_staff_session } from "@/db/schema";
import { emailRole } from "@/lib/email/roles";
import { sendEmail } from "@/lib/email/transport";
import { publicRateLimitCheck } from "@/lib/public-rate-limit";

export const RESET_TTL_MS = 30 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;

function tokenHash(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function siteUrl(): string {
	return (process.env.SUPPORT_SITE_URL ?? "https://support.uplink.net.au").replace(/\/$/, "");
}

export type RequestResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordReset(rawEmail: string, ip: string | null): Promise<RequestResult> {
	const email = rawEmail.trim().toLowerCase();
	if (!email || !email.includes("@")) return { ok: false, error: "Enter your email address." };

	const byIp = publicRateLimitCheck(`pwreset:ip:${ip ?? "unknown"}`);
	const byEmail = publicRateLimitCheck(`pwreset:email:${email}`);
	if (!byIp.ok || !byEmail.ok) {
		return { ok: false, error: "Too many requests. Please try again in an hour." };
	}

	const [staff] = await db
		.select({ id: support_staff.id, name: support_staff.name, active: support_staff.active, deleted_at: support_staff.deleted_at })
		.from(support_staff)
		.where(eq(support_staff.email, email))
		.limit(1);

	// Unknown or disabled: say nothing different, send nothing.
	if (!staff || !staff.active || staff.deleted_at) return { ok: true };

	const token = randomBytes(32).toString("base64url");
	await db.transaction(async (tx) => {
		// Void any older unused link, so only the newest email works.
		await tx
			.update(support_staff_password_reset)
			.set({ used_at: new Date() })
			.where(and(eq(support_staff_password_reset.staff_id, staff.id), isNull(support_staff_password_reset.used_at)));
		await tx.insert(support_staff_password_reset).values({
			staff_id: staff.id,
			token_hash: tokenHash(token),
			expires_at: new Date(Date.now() + RESET_TTL_MS),
			requested_ip: ip?.slice(0, 64) ?? null,
		});
	});

	const link = `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
	const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f0f0f;max-width:560px;margin:0 auto;line-height:1.55">
<p>Hi ${staff.name.replace(/[<>&"]/g, "")},</p>
<p>Someone asked to reset the password for your Uplink Support staff login. If that was you, choose a new password here:</p>
<p><a href="${link}" style="display:inline-block;background:#991b1b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">Set a new password</a></p>
<p style="font-size:13px;color:#555">The link works once and expires in 30 minutes. If you didn't ask for this, ignore this email — your password has not changed.</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/><p style="font-size:12px;color:#888">Uplink Web Services — support.uplink.net.au</p></div>`;
	const text = `Someone asked to reset the password for your Uplink Support staff login.\n\nSet a new password (works once, expires in 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email — your password has not changed.`;

	// ⚠ Awaited: a fire-and-forget send can be cut off before it leaves.
	const sent = await sendEmail({
		to: email,
		from: emailRole("support"),
		subject: "Reset your Uplink Support password",
		html,
		text,
	});
	if (!sent.ok) console.error(`[password-reset] email to staff ${staff.id} failed: ${sent.error ?? "unknown"}`);
	else console.log(`[password-reset] link sent to staff ${staff.id} via ${sent.via}`);
	return { ok: true };
}

/** True when the token is live (unused, unexpired, staff still active). Read-only. */
export async function isResetTokenValid(token: string): Promise<boolean> {
	if (!token) return false;
	const [r] = await db
		.select({ active: support_staff.active, deleted_at: support_staff.deleted_at })
		.from(support_staff_password_reset)
		.innerJoin(support_staff, eq(support_staff.id, support_staff_password_reset.staff_id))
		.where(
			and(
				eq(support_staff_password_reset.token_hash, tokenHash(token)),
				isNull(support_staff_password_reset.used_at),
				gt(support_staff_password_reset.expires_at, new Date()),
			),
		)
		.limit(1);
	return Boolean(r?.active && !r.deleted_at);
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(token: string, password: string, confirm: string): Promise<ResetResult> {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
	}
	if (password !== confirm) return { ok: false, error: "The two passwords don't match." };
	if (!token) return { ok: false, error: "This reset link is invalid or has expired." };

	// Hash before the transaction: bcrypt is slow and must not hold a row lock.
	const password_hash = await bcrypt.hash(password, 12);

	const done = await db.transaction(async (tx) => {
		// ⚠ The single-use guarantee: claim the token in ONE conditional UPDATE.
		const [claimed] = await tx
			.update(support_staff_password_reset)
			.set({ used_at: new Date() })
			.where(
				and(
					eq(support_staff_password_reset.token_hash, tokenHash(token)),
					isNull(support_staff_password_reset.used_at),
					gt(support_staff_password_reset.expires_at, new Date()),
				),
			)
			.returning({ staffId: support_staff_password_reset.staff_id });
		if (!claimed) return false;

		const updated = await tx
			.update(support_staff)
			.set({ password_hash, updated_at: new Date() })
			.where(and(eq(support_staff.id, claimed.staffId), eq(support_staff.active, true), isNull(support_staff.deleted_at)))
			.returning({ id: support_staff.id });
		if (updated.length !== 1) throw new Error("staff not active"); // rolls the claim back too

		await tx.delete(support_staff_session).where(eq(support_staff_session.staff_id, claimed.staffId));
		return true;
	}).catch((e) => {
		console.error("[password-reset] reset failed:", e instanceof Error ? e.message : String(e));
		return false;
	});

	return done ? { ok: true } : { ok: false, error: "This reset link is invalid or has expired." };
}
