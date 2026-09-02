-- Seed per-branch stock from the business-wide totals that existed before
-- branches. Every business has exactly one branch at this point (the 'Main'
-- backfilled in 0005), so all existing stock belongs to it and the sum of
-- product_branch_stock equals products.stock_qty for every product.
--
-- Idempotent: ON CONFLICT DO NOTHING, so re-running cannot double-count.
INSERT INTO "product_branch_stock" ("business_id", "branch_id", "product_id", "stock_qty", "updated_at")
SELECT p."business_id", br."id", p."id", p."stock_qty", now()
FROM "products" p
JOIN "branches" br
  ON br."business_id" = p."business_id"
 AND br."is_default" = true
ON CONFLICT ("branch_id", "product_id") DO NOTHING;
