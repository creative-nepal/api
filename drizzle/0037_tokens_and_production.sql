CREATE TABLE "order_token_counters" (
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"business_date" date NOT NULL,
	"last_token" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_token_counters_pk" PRIMARY KEY("business_id","branch_id","business_date")
);
--> statement-breakpoint
CREATE TABLE "production_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"product_id" text,
	"menu_item_id" text,
	"item_name" text NOT NULL,
	"planned_for" date NOT NULL,
	"planned_qty" numeric(14, 3) NOT NULL,
	"produced_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"wasted_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "token_number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_token_counters" ADD CONSTRAINT "order_token_counters_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_token_counters" ADD CONSTRAINT "order_token_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_runs_businessId_plannedFor_idx" ON "production_runs" USING btree ("business_id","planned_for");--> statement-breakpoint
CREATE INDEX "production_runs_businessId_status_idx" ON "production_runs" USING btree ("business_id","status");