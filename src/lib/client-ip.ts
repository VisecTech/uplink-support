/**
 * The caller's address, from the one header a caller cannot choose.
 *
 * nginx sets X-Real-IP from $remote_addr on every request it forwards.
 * X-Forwarded-For is NOT safe to key anything on: nginx APPENDS to whatever the
 * caller sent, so its first hop is the caller's own text. Until 2026-11-22 the
 * widget's rate limit read that first hop, so a new header value per request
 * meant no limit at all on an anonymous endpoint that spends AI money
 * (fleet audit). Returns null when the header is absent (not behind nginx).
 */
export function clientIpFromHeaders(h: { get(name: string): string | null }): string | null {
	const v = h.get("x-real-ip")?.trim();
	return v || null;
}
