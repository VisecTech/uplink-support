/**
 * Support draft-reply runner. Gathers ticket context, makes a single Claude call,
 * returns the draft for the agent to review/edit/send. Key: SUPPORT_AI_API_KEY →
 * IVY_API_KEY → ANTHROPIC_API_KEY (no per-org key path — standalone). Usage
 * metered as uplink-support-agent.
 */
import Anthropic from "@anthropic-ai/sdk";
import { reportFleetUsage } from "@/lib/ai/usage-report";
import { gatherTicketContext } from "@/lib/support/agent/context";
import { SUPPORT_AGENT_MODEL, SUPPORT_AGENT_SYSTEM } from "@/lib/support/agent/system";

function supportAiKey(): string | null {
	return (
		process.env.SUPPORT_AI_API_KEY ?? process.env.IVY_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? null
	);
}

export async function draftReply(
	ticketId: string,
): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
	const ctx = await gatherTicketContext(ticketId);
	if (!ctx) return { ok: false, error: "ticket not found" };

	const apiKey = supportAiKey();
	if (!apiKey) return { ok: false, error: "AI is not configured" };

	try {
		const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
		const stream = client.messages.stream({
			model: SUPPORT_AGENT_MODEL,
			max_tokens: 1200,
			// Prompt caching: the system prompt (persona + KB) is a large stable
			// prefix reused across every draft within the 5-min TTL — cache it.
			system: [{ type: "text", text: SUPPORT_AGENT_SYSTEM, cache_control: { type: "ephemeral" } }],
			messages: [{ role: "user", content: ctx.prompt }],
		});
		const final = await stream.finalMessage();
		reportFleetUsage("uplink-support-agent", SUPPORT_AGENT_MODEL, final.usage);
		const draft = final.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("")
			.trim();
		if (!draft) return { ok: false, error: "empty draft" };
		return { ok: true, draft };
	} catch (e) {
		console.error("[support-agent] draft failed:", e instanceof Error ? e.message : String(e));
		return { ok: false, error: "draft generation failed" };
	}
}
