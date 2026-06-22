CREATE TABLE "support_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"product_kind" varchar(32) NOT NULL,
	"org_id" uuid,
	"slug" varchar(160) NOT NULL,
	"title" varchar(300) NOT NULL,
	"body_md" text NOT NULL,
	"summary" text,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"sanitized_filename" varchar(500) NOT NULL,
	"disk_path" varchar(1024) NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" varchar(128),
	"ext" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "support_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_kind" varchar(16) NOT NULL,
	"author_staff_id" uuid,
	"body_text" text NOT NULL,
	"body_html" text,
	"is_internal_note" boolean DEFAULT false NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"email_message_id" varchar(998),
	"email_in_reply_to" varchar(998),
	"delivery_status" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "support_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"email" varchar(320) NOT NULL,
	"name" varchar(200) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(16) DEFAULT 'agent' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "support_staff_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"uplink_customer_id" uuid,
	"subscription_id" uuid,
	"org_id" uuid,
	"requester_email" varchar(320) NOT NULL,
	"requester_name" varchar(200),
	"product_kind" varchar(32) DEFAULT 'general' NOT NULL,
	"resource_ref" varchar(128),
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"priority" varchar(16) DEFAULT 'normal' NOT NULL,
	"channel" varchar(16) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"assignee_staff_id" uuid,
	"first_response_due_at" timestamp with time zone,
	"resolution_due_at" timestamp with time zone,
	"first_responded_at" timestamp with time zone,
	"solved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"customer_token" varchar(128) NOT NULL,
	"email_message_id" varchar(998),
	"email_thread_key" varchar(255),
	"ai_deflected" boolean DEFAULT false NOT NULL,
	"ip" varchar(64),
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_message_id_support_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."support_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_message" ADD CONSTRAINT "support_message_author_staff_id_support_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."support_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_staff_session" ADD CONSTRAINT "support_staff_session_staff_id_support_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."support_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_assignee_staff_id_support_staff_id_fk" FOREIGN KEY ("assignee_staff_id") REFERENCES "public"."support_staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_article_product_slug_unique" ON "support_article" USING btree ("product_kind","slug");--> statement-breakpoint
CREATE INDEX "support_article_product_status_idx" ON "support_article" USING btree ("product_kind","status");--> statement-breakpoint
CREATE INDEX "support_attachment_message_idx" ON "support_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "support_attachment_ticket_idx" ON "support_attachment" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_message_ticket_idx" ON "support_message" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_message_msgid_idx" ON "support_message" USING btree ("email_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_staff_email_unique" ON "support_staff" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "support_staff_session_token_unique" ON "support_staff_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "support_staff_session_staff_idx" ON "support_staff_session" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "support_ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_ticket_assignee_idx" ON "support_ticket" USING btree ("assignee_staff_id","status");--> statement-breakpoint
CREATE INDEX "support_ticket_customer_idx" ON "support_ticket" USING btree ("uplink_customer_id");--> statement-breakpoint
CREATE INDEX "support_ticket_product_idx" ON "support_ticket" USING btree ("product_kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "support_ticket_token_unique" ON "support_ticket" USING btree ("customer_token");--> statement-breakpoint
CREATE INDEX "support_ticket_thread_idx" ON "support_ticket" USING btree ("email_thread_key");--> statement-breakpoint
CREATE INDEX "support_ticket_msgid_idx" ON "support_ticket" USING btree ("email_message_id");