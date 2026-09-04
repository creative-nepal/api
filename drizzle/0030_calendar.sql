CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"scope" text DEFAULT 'organisation' NOT NULL,
	"branch_id" text,
	"kind" text DEFAULT 'event' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"recurrence" jsonb,
	"remind_minutes_before" integer,
	"reminder_sent_at" timestamp with time zone,
	"assigned_to_user_id" text,
	"linked_type" text,
	"linked_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_businessId_scope_idx" ON "calendar_events" USING btree ("business_id","scope");--> statement-breakpoint
CREATE INDEX "calendar_events_businessId_startsAt_idx" ON "calendar_events" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_businessId_status_idx" ON "calendar_events" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "calendar_events_assignedTo_idx" ON "calendar_events" USING btree ("assigned_to_user_id");