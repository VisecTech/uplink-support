import { createHash, timingSafeEqual } from "node:crypto";

// Compare a presented secret with the real one without leaking, through how long the
// comparison takes, how much of it was right. `a === b` stops at the first wrong character.
// Both sides are hashed first so the two buffers are always the same length (timingSafeEqual
// throws on different lengths, and a length check is itself a leak). Audit low #68, 2026-11-24.
export function sameSecret(presented: string | null | undefined, real: string | null | undefined): boolean {
	if (!presented || !real) return false;
	const h = (s: string) => createHash("sha256").update(s).digest();
	return timingSafeEqual(h(presented), h(real));
}
