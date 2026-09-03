CREATE TABLE "sales_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"commission_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel_commission_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_channels" ADD CONSTRAINT "sales_channels_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_channels_businessId_name_uidx" ON "sales_channels" USING btree ("business_id","name");