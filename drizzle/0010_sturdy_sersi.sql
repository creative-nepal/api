CREATE TABLE "job_schedules" (
	"name" text PRIMARY KEY NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
