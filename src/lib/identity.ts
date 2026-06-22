/**
 * Identity resolution over the READ-ONLY Counter connection — the context-aware
 * differentiator. All lookups are best-effort: if the canonical conn is
 * unconfigured/unreachable, or no match, they return null and the caller degrades
 * to "no context". Never throws.
 */
import { and, desc, eq } from "drizzle-orm";
import {
	canonicalConfigured,
	canonicalRo,
	ro_hosting_detail,
	ro_sites_detail,
	ro_uplink_customer,
	ro_uplink_subscription,
} from "@/db/canonical-readonly";

export type ResolvedCustomer = {
	id: string;
	email: string | null;
	name: string | null;
	businessName: string | null;
	slug: string | null;
};

/** Find a unified Uplink customer by email (case-insensitive). */
export async function resolveCustomerByEmail(email: string): Promise<ResolvedCustomer | null> {
	if (!canonicalConfigured() || !email) return null;
	try {
		const rows = await canonicalRo
			.select()
			.from(ro_uplink_customer)
			.where(eq(ro_uplink_customer.email, email.toLowerCase()))
			.limit(1);
		const c = rows[0];
		if (!c) return null;
		return {
			id: c.id,
			email: c.email,
			name: c.name,
			businessName: c.business_name,
			slug: c.slug,
		};
	} catch (e) {
		console.error("[identity] resolveCustomerByEmail failed:", e instanceof Error ? e.message : e);
		return null;
	}
}

/** Look up a unified Uplink customer by id (for the ticket context sidebar). */
export async function resolveCustomerById(id: string): Promise<ResolvedCustomer | null> {
	if (!canonicalConfigured() || !id) return null;
	try {
		const [c] = await canonicalRo
			.select()
			.from(ro_uplink_customer)
			.where(eq(ro_uplink_customer.id, id))
			.limit(1);
		if (!c) return null;
		return { id: c.id, email: c.email, name: c.name, businessName: c.business_name, slug: c.slug };
	} catch {
		return null;
	}
}

export type SubscriptionContext = {
	id: string;
	productKind: string | null;
	planTier: string | null;
	status: string | null;
	resourceRef: string | null;
	hosting?: typeof ro_hosting_detail.$inferSelect | null;
	sites?: typeof ro_sites_detail.$inferSelect | null;
};

/** All subscriptions for a customer, with hosting/site detail attached. */
export async function getCustomerSubscriptions(customerId: string): Promise<SubscriptionContext[]> {
	if (!canonicalConfigured() || !customerId) return [];
	try {
		const subs = await canonicalRo
			.select()
			.from(ro_uplink_subscription)
			.where(eq(ro_uplink_subscription.customer_id, customerId))
			.orderBy(desc(ro_uplink_subscription.created_at));

		const out: SubscriptionContext[] = [];
		for (const s of subs) {
			const ctx: SubscriptionContext = {
				id: s.id,
				productKind: s.product_kind,
				planTier: s.plan_tier,
				status: s.status,
				resourceRef: s.resource_ref,
			};
			if (s.product_kind === "hosting") {
				const [h] = await canonicalRo
					.select()
					.from(ro_hosting_detail)
					.where(eq(ro_hosting_detail.subscription_id, s.id))
					.limit(1);
				ctx.hosting = h ?? null;
			} else if (s.product_kind === "sites") {
				const [w] = await canonicalRo
					.select()
					.from(ro_sites_detail)
					.where(eq(ro_sites_detail.subscription_id, s.id))
					.limit(1);
				ctx.sites = w ?? null;
			}
			out.push(ctx);
		}
		return out;
	} catch (e) {
		console.error("[identity] getCustomerSubscriptions failed:", e instanceof Error ? e.message : e);
		return [];
	}
}

/** Best-effort: the subscription matching a product_kind for a customer (for ticket stamping). */
export async function matchSubscription(
	customerId: string,
	productKind: string,
): Promise<{ id: string; resourceRef: string | null } | null> {
	if (!canonicalConfigured() || productKind === "general") return null;
	try {
		const [s] = await canonicalRo
			.select()
			.from(ro_uplink_subscription)
			.where(
				and(
					eq(ro_uplink_subscription.customer_id, customerId),
					eq(ro_uplink_subscription.product_kind, productKind),
				),
			)
			.limit(1);
		return s ? { id: s.id, resourceRef: s.resource_ref } : null;
	} catch {
		return null;
	}
}
