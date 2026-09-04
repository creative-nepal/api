ALTER TABLE "order_items" ADD COLUMN "unit_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "order_items" oi
SET "unit_cost_cents" = ROUND("products"."cost_price_cents"::numeric / GREATEST("products"."units_per_pack", 1))
FROM "products"
WHERE "products"."id" = oi."product_id"
  AND "products"."cost_price_cents" > 0;
