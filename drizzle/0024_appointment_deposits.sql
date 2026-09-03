ALTER TABLE "service_appointments" ADD COLUMN "deposit_required_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "deposit_paid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "deposit_method" text;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "deposit_reference" text;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "deposit_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD COLUMN "deposit_forfeited_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "deposit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN "no_show_fee_cents" integer DEFAULT 0 NOT NULL;