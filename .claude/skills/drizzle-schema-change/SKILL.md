---
name: drizzle-schema-change
description: >
  Change the Postgres schema in creative-nepal-api — add or alter a Drizzle table, column,
  enum or relation — and produce the matching migration. Use when editing anything under
  src/database/schema/, when a migration must be generated or applied, or after changing a
  Better Auth plugin (which regenerates auth.ts).
---

# Changing the database schema

Schema lives in `src/database/schema/` (`auth.ts`, `billing.ts`, `content.ts`, `medical.ts`,
`platform.ts`, `purchasing.ts`, `restaurant.ts`, `services.ts`), re-exported from `index.ts` —
which is the entry point `drizzle.config.ts` reads. A new file that is not re-exported from
`index.ts` is invisible to both the app and drizzle-kit.

`sector-keys.ts` is the one place sector keys are declared, and is deliberately dependency-free:
drizzle-kit loads the schema and must never pull in Nest through it.

## Steps

1. Edit the domain file, not `index.ts` (except to add the `export *`).
2. Export the row types next to the table — `export type Plan = typeof plans.$inferSelect;`
   / `NewPlan = typeof plans.$inferInsert;` — repositories and services import those, never
   hand-written interfaces.
3. Generate the migration:

   ```sh
   bun run db:generate     # writes ./drizzle/NNNN_*.sql — commit it
   bun run db:check        # drizzle-kit consistency check on the journal
   ```

4. Apply it:

   ```sh
   bun run db:push         # local dev loop only, no migration file
   bun run db:migrate      # versioned, what production runs
   ```

   `db:push` is for iterating locally; anything that reaches another machine needs a
   generated migration committed alongside the schema change.
5. `bun run check-types` — the repositories fail here first if a column was renamed.

## Rules

- `src/database/schema/auth.ts` is **generated**. Never hand-edit it: change
  `src/auth/auth.config.ts` and run `bun run auth:generate`. Required any time a Better Auth
  plugin is added, removed or configured differently. It rewrites the file wholesale and has
  twice dropped `account.issuer` plus the hand-added `User`/`Member`/`Team` row types — and it
  re-quotes to double quotes, so a single-quote find-and-replace silently does nothing. Always
  `git diff` it afterwards, restore what was dropped, then confirm `bun run db:generate` reports
  no changes; otherwise the next migration carries a `DROP COLUMN` nobody intended.
- The `db` handle reaches the app only through the `DRIZZLE` token / `@InjectDatabase()`
  decorator. Do not import the client outside `src/database/`.
- Queries belong in a `*.repository.ts` (see the `nest-module` skill), never in a service.
- Dropping or renaming a column is a frontend contract change — grep `../web/src` and
  `../admin/src` for the field name before committing.
- `bunx drizzle-kit ...`, never `npx`.

## Adding a NOT NULL column to a populated table

`db:generate` emits `ALTER TABLE ... ADD COLUMN x NOT NULL`, which **fails outright** on a table
that already has rows. Declare it `.notNull()` in the schema anyway — so the snapshot records the
final state — then hand-edit the generated SQL into three phases before applying it:

1. `ADD COLUMN x text` (nullable)
2. the backfill (`INSERT` any parent rows, then `UPDATE ... WHERE x IS NULL`)
3. `ALTER COLUMN x SET NOT NULL`, then any index/PK swap

Editing a migration is only safe **before it has been applied anywhere**. A backfill discovered
later is a new migration: `bunx drizzle-kit generate --custom --name=<what_it_does>`, written
idempotently (`ON CONFLICT DO NOTHING`).

## Compliance-critical tables

`invoice_counters`, `business_invoices` and `invoice_leases` carry gapless invoice numbering,
which cannot be corrected after the fact. A **series is (business, branch, fiscal year)** — each
branch numbers independently, so two branches legitimately both hold invoice #1.

Before and after any migration touching them, capture and diff:

```sql
select business_id, branch_id, fiscal_year, count(*), min(invoice_number), max(invoice_number)
from business_invoices group by 1,2,3 order by 1,2,3;
```

An empty diff is the only acceptable result for existing series. Then run the integration suite,
which is skipped without a database and is what actually proves concurrent allocation:

```sh
TEST_DATABASE_URL=postgresql://... bun run test
```

## Cached totals

`products.stockQty` is a **cache** of `product_branch_stock` summed across branches; the same
pattern holds for batches. The per-branch row is the source of truth and carries the sufficiency
check in its own `WHERE` clause, so the cache can never authorize a sale. Any new writer must
update both, branch row first.
