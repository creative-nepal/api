ALTER TABLE "businesses" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "theme" jsonb DEFAULT '{}'::jsonb NOT NULL;