/**
 * Best-effort fleet usage report to the Uplink admin dashboard's self-metering
 * ingest. Fire-and-forget; dormant unless DASHBOARD_USAGE_URL + USAGE_INGEST_TOKEN
 * are set. Ported from Counter. Tags sources as uplink-support-*.
 */
type AnthropicUsage =
	| {
			input_tokens?: number;
			output_tokens?: number;
			cache_read_input_tokens?: number | null;
			cache_creation_input_tokens?: number | null;
	  }
	| null
	| undefined;

export function reportFleetUsage(source: string, model: string, usage: AnthropicUsage): void {
	const url = process.env.DASHBOARD_USAGE_URL;
	const token = process.env.USAGE_INGEST_TOKEN;
	if (!url || !token || !usage) return;
	void fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", "x-usage-token": token },
		body: JSON.stringify({
			source,
			model,
			input: usage.input_tokens ?? 0,
			output: usage.output_tokens ?? 0,
			cache_read: usage.cache_read_input_tokens ?? 0,
			cache_write: usage.cache_creation_input_tokens ?? 0,
			requests: 1,
		}),
		signal: AbortSignal.timeout(3000),
	}).catch(() => {});
}
