// The single-sign-on link from the admin dashboard, used ONCE and only while fresh.
//
// The link is a GET with the signature in the address, so it lands in the web server's
// access log and the browser's history. Until 24 Nov 2026 it stayed valid for two minutes
// and could be used any number of times in that window: whoever read it there could open a
// staff session (audit low #68). It is now good for 30 seconds and for one use.
//
// The used-signatures list lives in this process's memory. The support app is ONE process
// (uplink-support.service, no cluster), so that is enough; a restart forgets the list, and
// the 30-second window is what bounds a replay across a restart. If this app is ever run as
// several workers, move this to the database.

export const SSO_MAX_AGE_S = 30;
const MAX_REMEMBERED = 5000;

const used = new Map<string, number>(); // signature -> when it stops mattering (ms)

/** Is this timestamp inside the window? A link from the future is refused like a stale one. */
export function ssoFresh(tsSeconds: number, nowMs: number = Date.now()): boolean {
	return Number.isFinite(tsSeconds) && Math.abs(nowMs / 1000 - tsSeconds) <= SSO_MAX_AGE_S;
}

/**
 * Claim a VERIFIED signature. True exactly once per signature; false on any repeat.
 * Call it only after the signature has been checked, so junk cannot fill the list.
 * ⚠ Fails CLOSED: if the list is somehow full of live entries, the sign-in is refused.
 */
export function claimSsoOnce(sig: string, tsSeconds: number, nowMs: number = Date.now()): boolean {
	for (const [k, until] of used) if (until <= nowMs) used.delete(k);
	if (used.has(sig)) return false;
	if (used.size >= MAX_REMEMBERED) return false;
	// Remember it until the link could no longer pass the freshness check anyway.
	used.set(sig, (tsSeconds + SSO_MAX_AGE_S) * 1000 + 1000);
	return true;
}

/** Tests only. */
export function _resetSsoOnce(): void {
	used.clear();
}
