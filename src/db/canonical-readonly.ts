/**
 * READ-ONLY connection to the canonical Counter DB (counter_dev).
 *
 * Uses the least-privilege `support_readonly` role (SELECT only on the identity
 * graph). This is what preserves the context-aware-AI differentiator without
 * coupling the apps. We pin MINIMAL Drizzle models — only the columns we read —
 * so Counter migrations rarely break us (schema-drift guard).
 *
 * If CANONICAL_READ_ONLY_URL is unset, `canonicalRo` throws lazily on first use;
 * callers must degrade gracefully (treat as "no context").
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import postgres from "postgres";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function canonicalConfigured(): boolean {
	return Boolean(process.env.CANONICAL_READ_ONLY_URL ?? process.env.POOL_CANONICAL_READ_ONLY_URL);
}

function getCanonicalRo() {
	if (_db) return _db;
	const url = process.env.POOL_CANONICAL_READ_ONLY_URL ?? process.env.CANONICAL_READ_ONLY_URL;
	if (!url) throw new Error("CANONICAL_READ_ONLY_URL is not set");
	_client = postgres(url, {
		max: Number(process.env.CANONICAL_DB_POOL_MAX ?? 2),
		idle_timeout: Number(process.env.DB_POOL_IDLE_TIMEOUT ?? 20),
		connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 10),
		prepare: false,
	});
	_db = drizzle(_client);
	return _db;
}

export const canonicalRo = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_t, prop) {
		return Reflect.get(getCanonicalRo(), prop, getCanonicalRo());
	},
});

// ── Pinned read-only models — minimal column subset of the Counter identity graph.
// Column names verified against counter_dev (2026-06-21). Keep MINIMAL so Counter
// migrations rarely break us.
export const ro_uplink_customer = pgTable("uplink_customer", {
	id: uuid("id").primaryKey(),
	email: varchar("email", { length: 320 }),
	name: varchar("name", { length: 200 }),
	business_name: varchar("business_name", { length: 200 }),
	slug: varchar("slug", { length: 160 }),
	created_at: timestamp("created_at", { withTimezone: true }),
});

export const ro_uplink_subscription = pgTable("uplink_subscription", {
	id: uuid("id").primaryKey(),
	customer_id: uuid("customer_id"),
	product_kind: varchar("product_kind", { length: 32 }),
	plan_tier: varchar("plan_tier", { length: 64 }),
	status: varchar("status", { length: 32 }),
	resource_ref: varchar("resource_ref", { length: 128 }),
	current_period_end: timestamp("current_period_end", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }),
});

export const ro_hosting_detail = pgTable("hosting_subscription_detail", {
	id: uuid("id").primaryKey(),
	subscription_id: uuid("subscription_id"),
	primary_domain: varchar("primary_domain", { length: 255 }),
	ssl_status: varchar("ssl_status", { length: 32 }),
	dns_status: varchar("dns_status", { length: 32 }),
	disk_used_mb: integer("disk_used_mb"),
	disk_quota_mb: integer("disk_quota_mb"),
	provision_state: varchar("provision_state", { length: 32 }),
});

export const ro_sites_detail = pgTable("sites_subscription_detail", {
	id: uuid("id").primaryKey(),
	subscription_id: uuid("subscription_id"),
	primary_subdomain: varchar("primary_subdomain", { length: 255 }),
	custom_domain: varchar("custom_domain", { length: 255 }),
	custom_domain_status: varchar("custom_domain_status", { length: 32 }),
	kadence_active: boolean("kadence_active"),
	provision_state: varchar("provision_state", { length: 32 }),
});
