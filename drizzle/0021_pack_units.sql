ALTER TABLE "products" ADD COLUMN "units_per_pack" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sub_unit_label" text;