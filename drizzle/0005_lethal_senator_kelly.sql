CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"membership_key" text,
	"created_at" timestamp,
	CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key")
);--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"team_id" text,
	"name" text NOT NULL,
	"code" text,
	"address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "product_branch_stock" (
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"product_id" text NOT NULL,
	"stock_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_branch_stock_pk" PRIMARY KEY("branch_id","product_id")
);--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_team_id" text;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "invoice_leases" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD COLUMN "branch_id" text;--> statement-breakpoint
-- BACKFILL: one default branch per existing business.
-- 'Main' carries a NULL code so every already-issued invoice number keeps the
-- series it was printed with; existing counters and invoices move onto it
-- unchanged, so max(invoice_number) per series is identical before and after.
INSERT INTO "branches" ("id", "business_id", "team_id", "name", "code", "address", "is_default", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, b."id", NULL, 'Main', NULL, NULL, true, true, now(), now()
FROM "businesses" b;--> statement-breakpoint
UPDATE "business_invoices" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
UPDATE "invoice_counters" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
UPDATE "invoice_leases" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
UPDATE "orders" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
UPDATE "restaurant_tables" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
UPDATE "stock_adjustments" t SET "branch_id" = br."id" FROM "branches" br WHERE br."business_id" = t."business_id" AND br."is_default" = true AND t."branch_id" IS NULL;--> statement-breakpoint
ALTER TABLE "business_invoices" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_counters" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_leases" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "business_invoices_businessId_fiscalYear_number_uidx";--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_branch_stock" ADD CONSTRAINT "product_branch_stock_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_branch_stock" ADD CONSTRAINT "product_branch_stock_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_branch_stock" ADD CONSTRAINT "product_branch_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_organizationId_idx" ON "team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "teamMember_teamId_idx" ON "team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teamMember_userId_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_teamId_uidx" ON "branches" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_businessId_code_uidx" ON "branches" USING btree ("business_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_businessId_default_uidx" ON "branches" USING btree ("business_id") WHERE is_default = true;--> statement-breakpoint
CREATE INDEX "branches_businessId_isActive_idx" ON "branches" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "product_branch_stock_businessId_productId_idx" ON "product_branch_stock" USING btree ("business_id","product_id");--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_leases" ADD CONSTRAINT "invoice_leases_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_invoices_branch_fiscalYear_number_uidx" ON "business_invoices" USING btree ("business_id","branch_id","fiscal_year","invoice_number");--> statement-breakpoint
ALTER TABLE "invoice_counters" DROP CONSTRAINT "invoice_counters_pk";--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_pk" PRIMARY KEY("business_id","branch_id","fiscal_year");
