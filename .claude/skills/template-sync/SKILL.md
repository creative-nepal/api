---
name: template-sync
description: >
  Pull upstream template changes into a vertical clone of creative-nepal — merge order across the
  three repos, which generators to re-run, the cross-repo contracts to re-check, and the
  regression pass. Use when merging upstream/main into a clone, resolving a merge conflict in a
  kernel file, or after an upstream release tag.
---

# Syncing a clone with upstream

Order matters: **api → web → admin**. i18n keys and the CMS block contract flow from `api`
outward, so merging a frontend first leaves it rendering keys the API does not serve yet.

```sh
# 1. api
cd api && git fetch upstream && git merge upstream/main && bun install
bun run db:migrate                 # if drizzle/ gained a migration
bun run auth:generate              # ONLY if a Better Auth plugin changed — then see below
bun run check-types && bun run lint && bun run test
node .claude/skills/i18n-catalogue/scripts/check-parity.mjs
bun run db:generate                # must report "No schema changes"

# 2. then the frontends
cd ../web   && git fetch upstream && git merge upstream/main && bun install \
            && bun run check-types && bun run lint
cd ../admin && git fetch upstream && git merge upstream/main && bun install \
            && bun run check-types && bun run lint
cd ../web   && ./scripts/sync-ui.sh diff    # must be clean
```

## Conflicts, and what each one means

| Conflict in | Meaning |
|---|---|
| `.env.example` | upstream added a setting — add it to your `.env` too |
| `src/i18n/*.json` | upstream added keys; keep both sides, then re-run the parity check |
| `src/styles/globals.css` | you edited the shared design system — move your change to `brand.css` |
| `src/database/schema/*` | never resolve by hand-editing `auth.ts`; it is generated |
| any kernel file | you edited something a clone should not — take upstream's side, then re-apply your change upstream |

## Rules

- `auth:generate` rewrites `src/database/schema/auth.ts` wholesale. It has dropped
  `account.issuer` and the hand-added `User`/`Member`/`Team` row types, and it re-quotes the file
  (so single-quote replacements silently no-op). Always `git diff` it afterwards, restore what was
  dropped, and confirm `bun run db:generate` reports no changes — otherwise the next migration
  will contain a `DROP COLUMN` nobody intended.
- Never edit an applied migration. A late-discovered backfill is a **new** migration
  (`bunx drizzle-kit generate --custom --name=<what_it_does>`), written idempotently.
- A migration touching `invoice_counters`, `business_invoices` or a series key is
  compliance-critical: capture `(business_id, branch_id, fiscal_year, count, min, max)` before and
  after and confirm the diff is empty. A series is (business, branch, fiscal year).
- Run the integration suite against a real database — it is skipped otherwise, and it is what
  guards gapless numbering:

  ```sh
  TEST_DATABASE_URL=postgresql://... bun run test
  ```

## Verify

The regression pass in `docs/TEMPLATE.md` §5: routes match the enabled sectors, and per-role nav
and enforcement still agree (owner full, cashier `[pos, invoices]`, chef `[kitchen]`).
