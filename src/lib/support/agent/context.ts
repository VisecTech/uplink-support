/**
 * Gather everything an AI draft-reply needs for a ticket into one prompt block:
 * the requester's identity + products + provisioning state (via the READ-ONLY
 * Counter conn), the conversation so far, and matching KB articles. Deterministic
 * (no tool loop) — a single model call (see run.ts).
 */
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { support_article, support_message, support_ticket } from "@/db/schema";
import { getCustomerSubscriptions, resolveCustomerById } from "@/lib/identity";

export type TicketContext = {
	ticket: typeof support_ticket.$inferSelect;
	prompt: string;
};

export async function gatherTicketContext(ticketId: string): Promise<TicketContext | null> {
	const [ticket] = await db.select().from(support_ticket).where(eq(support_ticket.id, ticketId)).limit(1);
	if (!ticket) return null;

	const lines: string[] = [];
	lines.push(`TICKET ${ticket.subject}`);
	lines.push(`Product area: ${ticket.product_kind} · channel: ${ticket.channel} · status: ${ticket.status}`);
	lines.push(`Requester: ${ticket.requester_name || "(no name)"} <${ticket.requester_email}>`);

	// Identity + products via the read-only Counter connection.
	if (ticket.uplink_customer_id) {
		const cust = await resolveCustomerById(ticket.uplink_customer_id);
		if (cust) {
			lines.push(
				`\nCUSTOMER: ${cust.name ?? "(no name)"}${cust.businessName ? ` (${cust.businessName})` : ""} — verified Uplink account.`,
			);
			const subs = await getCustomerSubscriptions(cust.id);
			if (subs.length) {
				lines.push("Subscriptions:");
				for (const s of subs) {
					lines.push(`- ${s.productKind}${s.planTier ? ` (${s.planTier})` : ""} — ${s.status}`);
					if (s.hosting) {
						lines.push(
							`  Hosting ${s.hosting.primary_domain}: provision=${s.hosting.provision_state}, ssl=${s.hosting.ssl_status ?? "?"}, dns=${s.hosting.dns_status ?? "?"}, disk ${s.hosting.disk_used_mb ?? "?"}/${s.hosting.disk_quota_mb ?? "?"}MB`,
						);
					}
					if (s.sites) {
						lines.push(
							`  Website ${s.sites.primary_subdomain}${s.sites.custom_domain ? ` (custom: ${s.sites.custom_domain}/${s.sites.custom_domain_status ?? "?"})` : ""}: provision=${s.sites.provision_state}, kadence=${s.sites.kadence_active ? "active" : "no"}`,
						);
					}
				}
			}
		}
	} else {
		lines.push("\nCUSTOMER: not a linked Uplink account (treat as a general enquiry; don't assume account state).");
	}

	// Conversation so far
	const history = await db
		.select()
		.from(support_message)
		.where(eq(support_message.ticket_id, ticket.id))
		.orderBy(asc(support_message.created_at));
	lines.push("\nCONVERSATION (oldest first):");
	for (const m of history) {
		const who = m.is_internal_note ? "INTERNAL NOTE" : m.author_kind.toUpperCase();
		lines.push(`[${who}] ${m.body_text.slice(0, 4000)}`);
	}

	// Relevant KB (product-specific + general)
	const articles = await db
		.select({ title: support_article.title, summary: support_article.summary, body: support_article.body_md })
		.from(support_article)
		.where(
			and(
				eq(support_article.status, "published"),
				isNull(support_article.deleted_at),
				or(eq(support_article.product_kind, ticket.product_kind), eq(support_article.product_kind, "general")),
			),
		)
		.limit(8);
	if (articles.length) {
		lines.push("\nKNOWLEDGE BASE (ground your answer in these; cite nothing you can't support):");
		for (const a of articles) {
			lines.push(`# ${a.title}\n${(a.summary || a.body || "").slice(0, 1200)}`);
		}
	}

	lines.push("\nWrite the reply now.");
	return { ticket, prompt: lines.join("\n") };
}
