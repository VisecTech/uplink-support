/**
 * A ceiling on anonymous widget chats across ALL callers, per rolling 24 hours.
 *
 * The per-address limit stops one address. This stops many addresses (a botnet,
 * a proxy pool) running the AI key dry: past the ceiling the chat answers
 * "busy" and points at the ticket form, which is Turnstile-gated and costs
 * nothing. In-process, like public-rate-limit (single Node instance).
 * Override with SUPPORT_CHAT_DAILY_CAP.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_DAILY_CAP = 300;

const CAP: number = (() => {
	const raw = Number(process.env.SUPPORT_CHAT_DAILY_CAP);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_CAP;
})();

let stamps: number[] = [];
let lastWarned = 0;

export function chatBudgetTake(now: number = Date.now(), cap: number = CAP): { ok: boolean; used: number; cap: number } {
	const cutoff = now - DAY_MS;
	if (stamps.length && stamps[0] <= cutoff) stamps = stamps.filter((t) => t > cutoff);
	if (stamps.length >= cap) {
		if (now - lastWarned > 60 * 60 * 1000) {
			lastWarned = now;
			console.error(`[support-widget] daily chat ceiling reached (${cap} in 24h); chat is refusing until it drains`);
		}
		return { ok: false, used: stamps.length, cap };
	}
	stamps.push(now);
	return { ok: true, used: stamps.length, cap };
}

/** Tests only. */
export function _chatBudgetReset(): void {
	stamps = [];
	lastWarned = 0;
}
