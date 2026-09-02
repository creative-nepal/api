CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"trigger" text DEFAULT 'schedule' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text,
	"user_id" text,
	"type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title_key" text NOT NULL,
	"body_key" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"href" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_outbox_status_nextAttemptAt_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_outbox_createdAt_idx" ON "email_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_runs_name_startedAt_idx" ON "job_runs" USING btree ("name","started_at");--> statement-breakpoint
CREATE INDEX "job_runs_startedAt_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "notification_reads_userId_idx" ON "notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_scope_dedupe_uidx" ON "notifications" USING btree ("business_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_businessId_createdAt_idx" ON "notifications" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications" USING btree ("user_id","created_at");