CREATE TABLE "wastage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"product_id" text,
	"menu_item_id" text,
	"batch_id" text,
	"item_name" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"note" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wastage_records_businessId_createdAt_idx" ON "wastage_records" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "wastage_records_businessId_reason_idx" ON "wastage_records" USING btree ("business_id","reason");--> statement-breakpoint
CREATE INDEX "wastage_records_businessId_productId_idx" ON "wastage_records" USING btree ("business_id","product_id");