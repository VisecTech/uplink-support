/**
 * Cloudflare Turnstile — server-side verification. Graceful: if
 * TURNSTILE_SECRET_KEY is unset the verifier SKIPS (returns ok). Ported from Counter.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false; error: string };

const CHALLENGE_FAILED = "Couldn't verify you're human — please complete the check and try again.";

export async function verifyTurnstile(
	token: string | null | undefined,
	ip?: string | null,
): Promise<TurnstileResult> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return { ok: true, skipped: true };
	if (!token) return { ok: false, error: CHALLENGE_FAILED };
	try {
		const body = new URLSearchParams({ secret, response: token });
		if (ip) body.set("remoteip", ip);
		const res = await fetch(VERIFY_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body,
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success ? { ok: true } : { ok: false, error: CHALLENGE_FAILED };
	} catch {
		return { ok: true, skipped: true };
	}
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STRICT variant — added 2026-08-20 for the public support WIDGET.
 *
 * ⚠⚠ Do NOT replace `verifyTurnstile` above with this. That one is used by
 * /new and fails OPEN by design; this one fails CLOSED. Both are wanted.
 *
 * WHY A SECOND VERIFIER. The public-surface audit asked one question of every
 * anonymous endpoint: does a caller cause email to be sent to an address THEY
 * chose? That property — not "does it have a CAPTCHA" — is what turned
 * CourseKit's open signup into ~980 bot academies, each mailing a harvested
 * address, and an Abusix listing that blocked real customer mail for a week.
 * /api/support-widget in mode:"ticket" was the last surface with it.
 *
 * ⚠ Only the ticket path is gated. The chat branch sends no email, so KB
 * deflection stays frictionless — only escalation is challenged.
 *
 * FAIL-CLOSED, with a caveat that matters: support is not signup. The cost of
 * wrongly refusing is a customer who cannot reach us. So every not-ok result
 * carries SUPPORT_EMAIL and the widget surfaces it. A refusal is never a dead end.
 * ───────────────────────────────────────────────────────────────────────────── */

export const SUPPORT_EMAIL = "support@uplink.net.au";

const STRICT_CHALLENGE_FAILED =
	`Couldn't verify you're human — please complete the check and try again, or email ${SUPPORT_EMAIL} directly.`;
const STRICT_NOT_CONFIGURED =
	`We couldn't open a ticket just now. Please email ${SUPPORT_EMAIL} and we'll pick it up straight away.`;

export function turnstileSiteKey(): string | null {
	return process.env.TURNSTILE_SITE_KEY ?? null;
}

export async function verifyTurnstileStrict(
	token: string | null | undefined,
	ip?: string | null,
): Promise<TurnstileResult> {
	const secret = process.env.TURNSTILE_SECRET_KEY;

	if (!secret) {
		console.error("[turnstile] TURNSTILE_SECRET_KEY unset — widget tickets refused (fail-closed).");
		return { ok: false, error: STRICT_NOT_CONFIGURED };
	}
	if (!token) return { ok: false, error: STRICT_CHALLENGE_FAILED };

	try {
		const body = new URLSearchParams({ secret, response: token });
		if (ip) body.set("remoteip", ip);
		const res = await fetch(VERIFY_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body,
			signal: AbortSignal.timeout(10_000),
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success ? { ok: true } : { ok: false, error: STRICT_CHALLENGE_FAILED };
	} catch {
		console.error("[turnstile] siteverify unreachable — widget ticket refused (fail-closed)");
		return { ok: false, error: STRICT_NOT_CONFIGURED };
	}
}
