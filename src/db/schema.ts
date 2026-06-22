/**
 * uplink-support — own database schema (DB: uplink_support).
 *
 * Ported from the parked Counter support module. KEY DIFFERENCE: this app has its
 * OWN database. The identity-graph tables (uplink_customer, uplink_subscription,
 * org, user) live in the canonical Counter DB and are read over a READ-ONLY
 * connection (see canonical-readonly.ts). So the former cross-DB foreign keys
 * become plain uuid "soft references" here — resolved at read time, never FK'd.
 * assignee/author instead FK to our OWN support_staff table.
 */
import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

const baseCols = {
	id: uuid("id").primaryKey().defaultRandom(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
	deleted_at: timestamp("deleted_at", { withTimezone: true }),
};

// ── Staff (own auth — replaces Counter's `user` table for support agents) ──────
export const support_staff = pgTable(
	"support_staff",
	{
		...baseCols,
		email: varchar("email", { length: 320 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		password_hash: varchar("password_hash", { length: 255 }).notNull(),
		// 'admin' | 'agent'
		role: varchar("role", { length: 16 }).notNull().default("agent"),
		active: boolean("active").notNull().default(true),
		last_login_at: timestamp("last_login_at", { withTimezone: true }),
	},
	(t) => ({
		email_unique: uniqueIndex("support_staff_email_unique").on(t.email),
	}),
);
export type SupportStaff = typeof support_staff.$inferSelect;

export const support_staff_session = pgTable(
	"support_staff_session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
		staff_id: uuid("staff_id")
			.notNull()
			.references(() => support_staff.id, { onDelete: "cascade" }),
		token_hash: varchar("token_hash", { length: 64 }).notNull(),
		expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(t) => ({
		token_unique: uniqueIndex("support_staff_session_token_unique").on(t.token_hash),
		staff_idx: index("support_staff_session_staff_idx").on(t.staff_id),
	}),
);
export type SupportStaffSession = typeof support_staff_session.$inferSelect;

// ── Tickets ───────────────────────────────────────────────────────────────────
export const support_ticket = pgTable(
	"support_ticket",
	{
		...baseCols,
		// Soft refs into the canonical Counter DB (NO FK — different database).
		uplink_customer_id: uuid("uplink_customer_id"),
		subscription_id: uuid("subscription_id"),
		org_id: uuid("org_id"),
		requester_email: varchar("requester_email", { length: 320 }).notNull(),
		requester_name: varchar("requester_name", { length: 200 }),
		// 'hosting' | 'shopkit' | 'clubkit' | 'sites' | 'webdev_project' | 'general'
		product_kind: varchar("product_kind", { length: 32 }).notNull().default("general"),
		resource_ref: varchar("resource_ref", { length: 128 }),
		// 'open' | 'pending' | 'on_hold' | 'solved' | 'closed'
		status: varchar("status", { length: 32 }).notNull().default("open"),
		// 'low' | 'normal' | 'high' | 'urgent'
		priority: varchar("priority", { length: 16 }).notNull().default("normal"),
		channel: varchar("channel", { length: 16 }).notNull(), // 'web' | 'email' | 'widget'
		subject: varchar("subject", { length: 300 }).notNull(),
		assignee_staff_id: uuid("assignee_staff_id").references(() => support_staff.id, {
			onDelete: "set null",
		}),
		first_response_due_at: timestamp("first_response_due_at", { withTimezone: true }),
		resolution_due_at: timestamp("resolution_due_at", { withTimezone: true }),
		first_responded_at: timestamp("first_responded_at", { withTimezone: true }),
		solved_at: timestamp("solved_at", { withTimezone: true }),
		closed_at: timestamp("closed_at", { withTimezone: true }),
		customer_token: varchar("customer_token", { length: 128 }).notNull(),
		email_message_id: varchar("email_message_id", { length: 998 }),
		email_thread_key: varchar("email_thread_key", { length: 255 }),
		ai_deflected: boolean("ai_deflected").notNull().default(false),
		ip: varchar("ip", { length: 64 }),
		user_agent: text("user_agent"),
	},
	(t) => ({
		status_idx: index("support_ticket_status_idx").on(t.status),
		assignee_idx: index("support_ticket_assignee_idx").on(t.assignee_staff_id, t.status),
		customer_idx: index("support_ticket_customer_idx").on(t.uplink_customer_id),
		product_idx: index("support_ticket_product_idx").on(t.product_kind, t.status),
		token_unique: uniqueIndex("support_ticket_token_unique").on(t.customer_token),
		thread_idx: index("support_ticket_thread_idx").on(t.email_thread_key),
		msgid_idx: index("support_ticket_msgid_idx").on(t.email_message_id),
	}),
);
export type SupportTicket = typeof support_ticket.$inferSelect;

export const support_message = pgTable(
	"support_message",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
		ticket_id: uuid("ticket_id")
			.notNull()
			.references(() => support_ticket.id, { onDelete: "cascade" }),
		// 'customer' | 'agent' | 'ai' | 'system'
		author_kind: varchar("author_kind", { length: 16 }).notNull(),
		author_staff_id: uuid("author_staff_id").references(() => support_staff.id, {
			onDelete: "set null",
		}),
		body_text: text("body_text").notNull(),
		body_html: text("body_html"),
		is_internal_note: boolean("is_internal_note").notNull().default(false),
		ai_generated: boolean("ai_generated").notNull().default(false),
		email_message_id: varchar("email_message_id", { length: 998 }),
		email_in_reply_to: varchar("email_in_reply_to", { length: 998 }),
		// 'queued' | 'sent' | 'failed'
		delivery_status: varchar("delivery_status", { length: 16 }),
	},
	(t) => ({
		ticket_idx: index("support_message_ticket_idx").on(t.ticket_id, t.created_at),
		msgid_idx: index("support_message_msgid_idx").on(t.email_message_id),
	}),
);
export type SupportMessage = typeof support_message.$inferSelect;

export const support_attachment = pgTable(
	"support_attachment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
		message_id: uuid("message_id")
			.notNull()
			.references(() => support_message.id, { onDelete: "cascade" }),
		ticket_id: uuid("ticket_id")
			.notNull()
			.references(() => support_ticket.id, { onDelete: "cascade" }),
		original_filename: varchar("original_filename", { length: 500 }).notNull(),
		sanitized_filename: varchar("sanitized_filename", { length: 500 }).notNull(),
		disk_path: varchar("disk_path", { length: 1024 }).notNull(),
		size_bytes: integer("size_bytes").notNull(),
		mime_type: varchar("mime_type", { length: 128 }),
		ext: varchar("ext", { length: 16 }),
	},
	(t) => ({
		message_idx: index("support_attachment_message_idx").on(t.message_id),
		ticket_idx: index("support_attachment_ticket_idx").on(t.ticket_id),
	}),
);
export type SupportAttachment = typeof support_attachment.$inferSelect;

// Help-centre articles — also the corpus the deflection bot grounds on.
export const support_article = pgTable(
	"support_article",
	{
		...baseCols,
		product_kind: varchar("product_kind", { length: 32 }).notNull(),
		org_id: uuid("org_id"), // soft ref (rare tenant-specific article)
		slug: varchar("slug", { length: 160 }).notNull(),
		title: varchar("title", { length: 300 }).notNull(),
		body_md: text("body_md").notNull(),
		summary: text("summary"),
		// 'draft' | 'published'
		status: varchar("status", { length: 16 }).notNull().default("draft"),
		sort_order: integer("sort_order").notNull().default(0),
		view_count: integer("view_count").notNull().default(0),
	},
	(t) => ({
		product_slug_unique: uniqueIndex("support_article_product_slug_unique").on(
			t.product_kind,
			t.slug,
		),
		product_status_idx: index("support_article_product_status_idx").on(t.product_kind, t.status),
	}),
);
export type SupportArticle = typeof support_article.$inferSelect;
