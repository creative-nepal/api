---
name: new-sector
description: >
  Add a business sector (vertical) to creative-nepal-api — the sector plugin seam under
  src/sectors/, its schema, modules, checkout plugin, roles, nav and i18n. Use when adding a
  vertical such as salon/gym/clinic/school, when SECTORS_ENABLED must accept a new key, or
  when a sector's roles, nav items or plan feature keys change.
---

# Adding a sector

Worked example to copy: **`services`** (appointments/memberships — the non-inventory one, so it
exercises the seam hardest). `mart` is the simplest.

A sector is data + wiring, split by **what can import what**. Getting that split wrong is the
only real trap here:

| File | Holds | Must NOT import |
|---|---|---|
| `src/database/schema/sector-keys.ts` | the key, and nothing else | anything |
| `src/sectors/<key>/meta.ts` | display key, role names, nav items, plan feature keys | Nest **or** better-auth |
| `src/sectors/<key>/access.ts` | statements + roles it contributes | Nest |
| `src/sectors/<key>/sector.ts` | the Nest modules it mounts | — |

`meta.ts` stays free of Nest and better-auth because it is what `GET /v1/platform/sectors`
serves and what `catalog.spec.ts` unit-tests; both break the moment it pulls in either.
`sector-keys.ts` stays dependency-free because drizzle-kit loads the schema and must never
pull in Nest.

## Steps

1. **`src/database/schema/sector-keys.ts`** — add the key. This is the only place it is declared;
   `SECTORS`/`Sector` in `billing.ts` re-export from here.
2. **`src/sectors/<key>/meta.ts`** — `key`, `nameKey` (`common.sector.<key>`), `roleNames`,
   `navItems`, `planFeatureKeys`. Every nav item declares the `permission` it requires; the
   workspace endpoint filters on it, so an item without one shows to everybody.
3. **`src/sectors/<key>/access.ts`** — `<key>Statements`, `<key>OwnerGrants`,
   `<key>ManagerGrants`, `create<Key>Roles(ac)`. Wire all four into `src/auth/access-control.ts`.
4. **`src/sectors/<key>/sector.ts`** — `export const <key>Modules: Type<unknown>[]`.
5. Register in **`src/sectors/catalog.ts`** (meta) and **`src/sectors/registry.ts`** (modules).
   `bun run check-types` now enumerates every remaining registration point — let it drive you.
6. **Schema**: `src/database/schema/<key>.ts`, `export *` from `index.ts`, then
   `bun run db:generate` (see `drizzle-schema-change`).
7. **Modules** under `src/modules/`, per `nest-module`. Every business-scoped controller carries
   `@RequireSector('<key>')` and `@RequirePermission(...)` on **every route, reads included**.
8. **Selling?** Add a `SectorPlugin` in `src/modules/orders/sector-plugins/` and register it in
   that folder's `registry.ts` and in `orders.module.ts`. Reuse the order → invoice engine; never
   write a second invoicing path — numbering, audit trail and credit notes all live there.
9. **i18n**: `common.sector.<key>` and any `ui.web.nav.*`, in **both** `en` and `ne`
   (`i18n-catalogue`).
10. `bun run auth:generate` if roles or statements changed — then re-check the file, see below.
11. **Frontend**: `web/src/features/<key>/` + routes under `web/src/app/(workspace)/`, and add the
    key to the `Sector` unions in `web/src/features/business/types` and
    `admin/src/features/businesses/types`. The sidebar needs no change — it renders whatever
    `/workspace` returns.

## Rules

- Statements for **every** sector always compile into `access-control.ts`, regardless of
  `SECTORS_ENABLED`. Better Auth's `roles` option *replaces* its defaults, so the vocabulary must
  be complete and stable. Enablement gates modules and routes, never the permission vocabulary.
- If another module needs your sector's repository, split `<name>-core.module.ts` (providers only)
  from `<name>.module.ts` (adds controllers). Importing a module pulls in its **controllers**, so
  importing the HTTP module leaks your routes into sectors that should not expose them.
- `auth:generate` overwrites `src/database/schema/auth.ts` from scratch. It has twice dropped
  `account.issuer` and the hand-added `User`/`Member`/`Team` row types, and it re-quotes the file
  — so a single-quote find-and-replace silently does nothing. After running it:
  `git diff src/database/schema/auth.ts`, restore anything dropped, then `bun run db:generate`
  and confirm it reports no changes.

## Verify

```sh
bun run check-types && bun run lint && bun run test
node .claude/skills/i18n-catalogue/scripts/check-parity.mjs

SECTORS_ENABLED=<key> bun run start
#   your routes exist; every other sector's 404
#   a business of another sector calling your route gets 403, not 404
```
