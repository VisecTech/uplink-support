/**
 * Grounding for the customer-facing deflection widget — built per request from
 * published support_article rows, so the KB agents author is the KB the bot
 * answers from. Used by src/app/api/support-widget/route.ts.
 */
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { support_article } from "@/db/schema";

export const SUPPORT_WIDGET_MODEL = process.env.SUPPORT_WIDGET_MODEL ?? "claude-sonnet-4-6";

export async function buildSupportSystem(productKind: string): Promise<string> {
	// 'general' (e.g. the support-site bubble) grounds on the WHOLE KB; a specific
	// product embed narrows to that product + general articles.
	const scope =
		productKind === "general"
			? and(eq(support_article.status, "published"), isNull(support_article.deleted_at))
			: and(
					eq(support_article.status, "published"),
					isNull(support_article.deleted_at),
					or(eq(support_article.product_kind, productKind), eq(support_article.product_kind, "general")),
				);
	const rows = await db
		.select({ title: support_article.title, summary: support_article.summary, body: support_article.body_md })
		.from(support_article)
		.where(scope)
		.orderBy(asc(support_article.sort_order))
		.limit(20);

	const kb = rows.length
		? rows.map((a) => `# ${a.title}\n${(a.summary || a.body || "").slice(0, 1500)}`).join("\n\n")
		: "(no articles published yet)";

	return `You are the support assistant for Uplink Web Services, an Australian web-services company
(hosting, Shopkit stores, WPresskit websites, Clubkit, web projects). You're helping a visitor on the
"${productKind}" area via a chat widget.

Rules:
- Answer ONLY from the knowledge base below. If the answer isn't there, or the question is about a
  specific account/order/site state (which you can't see), say you can't confirm that from here and
  invite them to click "Talk to a human" to open a ticket — don't guess.
- Never invent prices, dates, account details, or policies. No promises about timeframes.
- Be warm, brief, and concrete. Australian English. One short paragraph or a few bullets.
- If they clearly want a human, or seem frustrated, point them to "Talk to a human" rather than looping.

KNOWLEDGE BASE:
${kb}`;
}
