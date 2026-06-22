/**
 * Support widget endpoint — embeddable on every product site (cross-origin).
 *  - mode:"chat"   → KB-grounded deflection bot (streams text).
 *  - mode:"ticket" → opens a support_ticket (channel=widget); returns { ok, ref }.
 * Anonymous (no cookies) → Allow-Origin:* is safe. Identity is resolved
 * best-effort from the email at ticket time (read-only Counter conn).
 */
import { randomBytes, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { support_message, support_ticket } from "@/db/schema";
import { reportFleetUsage } from "@/lib/ai/usage-report";
import { sendSupportCustomerConfirm, sendSupportStaffAlert, supportRef } from "@/lib/email/support-emails";
import { matchSubscription, resolveCustomerByEmail } from "@/lib/identity";
import { publicRateLimitCheck } from "@/lib/public-rate-limit";
import { buildSupportSystem, SUPPORT_WIDGET_MODEL } from "@/lib/support/support-knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = new Set(["general", "hosting", "shopkit", "sites", "clubkit", "webdev_project"]);
const MAX_TURNS = 12;
const MAX_CHARS = 2_000;
const MAX_TOKENS = 500;

const CORS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "content-type",
	"Access-Control-Max-Age": "86400",
};

type InMsg = { role: "user" | "assistant"; content: string };

function clientIp(req: Request): string {
	return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}
function product(v: unknown): string {
	return typeof v === "string" && PRODUCTS.has(v) ? v : "general";
}
function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS });
}

function sanitize(raw: unknown): InMsg[] | null {
	if (!Array.isArray(raw)) return null;
	const out: InMsg[] = [];
	for (const m of raw) {
		const role = (m as { role?: unknown })?.role;
		const content = (m as { content?: unknown })?.content;
		if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
		const t = content.trim();
		if (t) out.push({ role, content: t.slice(0, MAX_CHARS) });
	}
	const tail = out.slice(-MAX_TURNS);
	while (tail.length && tail[tail.length - 1].role !== "user") tail.pop();
	return tail.length ? tail : null;
}

export async function OPTIONS(): Promise<Response> {
	return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request): Promise<Response> {
	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: "bad_request" }, 400);
	}
	const mode = body.mode === "ticket" ? "ticket" : "chat";

	// ---- Escalation: open a ticket ----
	if (mode === "ticket") {
		const rl = publicRateLimitCheck(`support-widget-ticket:${clientIp(req)}`);
		if (!rl.ok) return json({ ok: false, error: "rate_limited" }, 429);

		const email = String(body.email ?? "").trim().toLowerCase();
		const message = String(body.message ?? "").trim();
		const name = String(body.name ?? "").trim() || null;
		const pk = product(body.productKind);
		const subject = (String(body.subject ?? "").trim() || message.split("\n")[0] || "Support request").slice(0, 300);
		if (!email.includes("@")) return json({ ok: false, error: "valid email required" }, 400);
		if (!message) return json({ ok: false, error: "message required" }, 400);

		const customer = await resolveCustomerByEmail(email);
		let subscription_id: string | null = null;
		let resource_ref: string | null = null;
		if (customer && pk !== "general") {
			const sub = await matchSubscription(customer.id, pk);
			if (sub) {
				subscription_id = sub.id;
				resource_ref = sub.resourceRef;
			}
		}

		const ticketId = randomUUID();
		await db.insert(support_ticket).values({
			id: ticketId,
			uplink_customer_id: customer?.id ?? null,
			requester_email: email,
			requester_name: name ?? customer?.name ?? null,
			product_kind: pk,
			subscription_id,
			resource_ref,
			status: "open",
			priority: "normal",
			channel: "widget",
			subject,
			customer_token: randomBytes(32).toString("hex"),
			email_thread_key: supportRef(ticketId),
			ip: clientIp(req),
		});
		await db.insert(support_message).values({
			ticket_id: ticketId,
			author_kind: "customer",
			body_text: message,
		});

		sendSupportCustomerConfirm({ to: email, requesterName: name, ticketId, subject }).catch((e) =>
			console.error("[support-widget] confirm failed", e),
		);
		sendSupportStaffAlert({
			ticketId,
			subject,
			productKind: pk,
			channel: "widget",
			requesterEmail: email,
			requesterName: name,
			bodyPreview: message,
		}).catch((e) => console.error("[support-widget] staff alert failed", e));

		return json({ ok: true, ref: supportRef(ticketId) });
	}

	// ---- Chat: KB-grounded deflection ----
	const apiKey = process.env.SUPPORT_AI_API_KEY ?? process.env.IVY_API_KEY ?? process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return json({ ok: false, error: "unavailable" }, 503);

	const rl = publicRateLimitCheck(`support-widget-chat:${clientIp(req)}`);
	if (!rl.ok) return json({ ok: false, error: "rate_limited" }, 429);

	const messages = sanitize(body.messages);
	if (!messages) return json({ ok: false, error: "bad_request" }, 400);
	const pk = product(body.productKind);
	const system = await buildSupportSystem(pk);

	const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const push = (s: string) => controller.enqueue(encoder.encode(s));
			try {
				const s = client.messages.stream({ model: SUPPORT_WIDGET_MODEL, max_tokens: MAX_TOKENS, system, messages });
				for await (const ev of s) {
					if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") push(ev.delta.text);
				}
				try {
					const f = await s.finalMessage();
					reportFleetUsage("uplink-support-widget", SUPPORT_WIDGET_MODEL, f.usage);
				} catch {
					/* metering only */
				}
			} catch (err) {
				console.error("[support-widget] stream error", err);
				push("\n\nSorry — I'm having trouble right now. Please use “Talk to a human” to open a ticket.");
			} finally {
				controller.close();
			}
		},
	});
	return new Response(stream, {
		headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
	});
}
