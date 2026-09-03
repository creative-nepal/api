CREATE TABLE "menu_item_ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_item_ingredients_menuItemId_productId_uidx" ON "menu_item_ingredients" USING btree ("menu_item_id","product_id");--> statement-breakpoint
CREATE INDEX "menu_item_ingredients_businessId_menuItemId_idx" ON "menu_item_ingredients" USING btree ("business_id","menu_item_id");