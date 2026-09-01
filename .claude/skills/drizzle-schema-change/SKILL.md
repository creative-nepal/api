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
`platform.ts`, `purchasing.ts`, `restaurant.ts`), re-exported from `index.ts` — which is the
entry point `drizzle.config.ts` reads. A new file that is not re-exported from `index.ts` is
invisible to both the app and drizzle-kit.

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
  plugin is added, removed or configured differently.
- The `db` handle reaches the app only through the `DRIZZLE` token / `@InjectDatabase()`
  decorator. Do not import the client outside `src/database/`.
- Queries belong in a `*.repository.ts` (see the `nest-module` skill), never in a service.
- Dropping or renaming a column is a frontend contract change — grep `../web/src` and
  `../admin/src` for the field name before committing.
- `bunx drizzle-kit ...`, never `npx`.
