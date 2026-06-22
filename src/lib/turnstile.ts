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
