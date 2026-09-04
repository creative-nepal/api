UPDATE "order_items" oi
SET "unit_cost_cents" = ROUND("product_batches"."cost_price_cents"::numeric / GREATEST("products"."units_per_pack", 1))
FROM "product_batches", "products"
WHERE "product_batches"."id" = oi."batch_id"
  AND "products"."id" = oi."product_id"
  AND oi."unit_cost_cents" = 0
  AND "product_batches"."cost_price_cents" > 0;
