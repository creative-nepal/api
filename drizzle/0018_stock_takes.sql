CREATE TABLE "stock_take_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"stock_take_id" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_id" text,
	"product_name" text NOT NULL,
	"batch_no" text,
	"system_qty" numeric(14, 3) NOT NULL,
	"counted_qty" numeric(14, 3),
	"counted_by_user_id" text,
	"counted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_take_lines_takeId_productId_batchId_uq" UNIQUE NULLS NOT DISTINCT("stock_take_id","product_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "stock_takes" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"started_by_user_id" text,
	"closed_by_user_id" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_stock_take_id_stock_takes_id_fk" FOREIGN KEY ("stock_take_id") REFERENCES "public"."stock_takes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_lines" ADD CONSTRAINT "stock_take_lines_counted_by_user_id_user_id_fk" FOREIGN KEY ("counted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_take_lines_businessId_stockTakeId_idx" ON "stock_take_lines" USING btree ("business_id","stock_take_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_businessId_reference_uidx" ON "stock_takes" USING btree ("business_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_businessId_branchId_open_uidx" ON "stock_takes" USING btree ("business_id","branch_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "stock_takes_businessId_status_idx" ON "stock_takes" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "stock_takes_businessId_createdAt_idx" ON "stock_takes" USING btree ("business_id","created_at");