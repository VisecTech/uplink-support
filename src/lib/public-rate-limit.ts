/**
 * Per-IP sliding-window rate limiter for public anonymous forms. In-process
 * (single Node instance). Window 1h, default 3/h, override SUPPORT_PUBLIC_RATE_LIMIT.
 * Ported from Counter.
 */
export const WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_LIMIT = 3;

const LIMIT: number = (() => {
	const raw = Number(process.env.SUPPORT_PUBLIC_RATE_LIMIT);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LIMIT;
})();

const CLEANUP_AFTER_MS = 6 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type Bucket = { timestamps: number[]; lastSeen: number };
const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

export type PublicRateLimitResult = {
	ok: boolean;
	limit: number;
	remaining: number;
	retryAfterSeconds: number;
};

export function publicRateLimitCheck(keyId: string, now: number = Date.now()): PublicRateLimitResult {
	maybeCleanup(now);
	const bucket = buckets.get(keyId) ?? { timestamps: [], lastSeen: now };
	const cutoff = now - WINDOW_MS;
	bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
	bucket.lastSeen = now;

	if (bucket.timestamps.length >= LIMIT) {
		const resetAtMs = bucket.timestamps[0] + WINDOW_MS;
		buckets.set(keyId, bucket);
		return {
			ok: false,
			limit: LIMIT,
			remaining: 0,
			retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
		};
	}
	bucket.timestamps.push(now);
	buckets.set(keyId, bucket);
	return { ok: true, limit: LIMIT, remaining: LIMIT - bucket.timestamps.length, retryAfterSeconds: 0 };
}

function maybeCleanup(now: number): void {
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	for (const [k, b] of buckets) {
		if (now - b.lastSeen > CLEANUP_AFTER_MS) buckets.delete(k);
	}
}
