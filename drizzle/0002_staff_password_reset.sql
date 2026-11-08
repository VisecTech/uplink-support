-- 2026-11-08: staff "forgot password" links.
-- Only the SHA-256 of the token is stored, so a database read cannot be turned
-- into a working link. used_at makes a link single-use; consuming is one atomic
-- UPDATE ... WHERE used_at IS NULL AND expires_at > now(), so two clicks cannot
-- both succeed.
CREATE TABLE IF NOT EXISTS "support_staff_password_reset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid NOT NULL REFERENCES "support_staff"("id") ON DELETE CASCADE,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"requested_ip" varchar(64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_staff_password_reset_token_unique" ON "support_staff_password_reset" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_staff_password_reset_staff_idx" ON "support_staff_password_reset" USING btree ("staff_id");
