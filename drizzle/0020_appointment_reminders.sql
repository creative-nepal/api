ALTER TABLE "customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;