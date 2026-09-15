-- 2026-09-15: screen tickets from senders we can't match to an account.
-- requester_verified: true = Uplink customer or active ShopKit store login,
-- false = unknown sender (ticket still opens, but no automatic reply is sent),
-- NULL = tickets created before this migration.
ALTER TABLE "support_ticket" ADD COLUMN IF NOT EXISTS "requester_verified" boolean;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_ticket_verified_idx" ON "support_ticket" USING btree ("requester_verified","status");
--> statement-breakpoint
-- Active login emails from every ShopKit store database, copied in by
-- scripts/sync-store-logins.sh (the desk cannot read tenant databases itself).
CREATE TABLE IF NOT EXISTS "known_store_login" (
	"email" varchar(320) NOT NULL,
	"tenant_slug" varchar(80) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "known_store_login_pk" PRIMARY KEY("email","tenant_slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "known_store_login_email_idx" ON "known_store_login" USING btree ("email");
