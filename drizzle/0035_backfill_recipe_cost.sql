UPDATE "order_items" oi
SET "unit_cost_cents" = recipe."cost_cents"
FROM (
  SELECT
    mii."menu_item_id" AS menu_item_id,
    ROUND(SUM(mii."quantity" * (p."cost_price_cents"::numeric / GREATEST(p."units_per_pack", 1)))) AS cost_cents
  FROM "menu_item_ingredients" mii
  JOIN "products" p ON p."id" = mii."product_id"
  GROUP BY mii."menu_item_id"
) AS recipe
WHERE oi."menu_item_id" = recipe."menu_item_id"
  AND oi."unit_cost_cents" = 0;
