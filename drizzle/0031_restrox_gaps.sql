CREATE TABLE "table_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referred_by_customer_id" text;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD COLUMN "area_id" text;--> statement-breakpoint
ALTER TABLE "table_areas" ADD CONSTRAINT "table_areas_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_areas" ADD CONSTRAINT "table_areas_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "table_areas_branchId_name_uidx" ON "table_areas" USING btree ("branch_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_businessId_referralCode_uidx" ON "customers" USING btree ("business_id","referral_code");