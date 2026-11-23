-- 2026-11-23: an emailed reply records WHO sent it (audit low list).
-- Any mail quoting a ticket's [UWS-…] reference was filed on that ticket and
-- shown to staff as the customer's own reply. The sender's address is now kept
-- on the message, and sender_mismatch marks one that is not the requester.
ALTER TABLE "support_message" ADD COLUMN IF NOT EXISTS "sender_email" varchar(320);
--> statement-breakpoint
ALTER TABLE "support_message" ADD COLUMN IF NOT EXISTS "sender_mismatch" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- One ticket per reference. 67 tickets, 67 distinct keys when this was written.
CREATE UNIQUE INDEX IF NOT EXISTS "support_ticket_thread_key_unique" ON "support_ticket" USING btree ("email_thread_key") WHERE "email_thread_key" IS NOT NULL;
