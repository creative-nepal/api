---
name: nest-module
description: >
  Add or extend a bounded domain module in creative-nepal-api, following the repo's
  controller -> service -> repository layering, DTO split, permission gating and
  app.module.ts registration. Use when adding a new endpoint, a new domain folder under
  src/modules/, a new list/filter/sort query, or when a service is about to touch Drizzle
  directly.
---

# Adding or extending a NestJS domain module

Reference implementations: `src/modules/users/` (canonical) and `src/modules/plans/`
(smallest complete CRUD + list/sort/paginate). Read `plans` before writing anything.

## Layering — never skip a layer

```
*.controller.ts   HTTP shape only: DTO in, ResponseDto out, permission decorators
*.service.ts      business rules, throws Http exceptions, no Drizzle imports
*.repository.ts   the only place that touches `schema` / the `db` handle
*.module.ts       controllers + providers + exports
dto/<name>-request.dto.ts    class-validator DTOs (Create/Update/ListQuery)
dto/<name>-response.dto.ts   serialization shape
```

A service importing `drizzle-orm` or `schema` is a bug — move that query into the repository.

## Steps

1. Decide where it lives, then create the four files above plus `dto/`:
   - every sector needs it → `src/modules/<domain>/` (kernel)
   - one sector owns it → `src/sectors/<key>/modules/<domain>/`
   - two sectors share it → kernel, not duplicated into both
2. Repository: inject with `@InjectDatabase() private readonly db: Database`, never import
   the client module directly. For sortable lists declare a `SORTABLE` map of allowed
   columns and resolve with `resolveOrderBy()` from `common/repository/sorting` — do not
   interpolate `sortBy` into SQL.
3. List endpoints: extend `ListQueryDto` (`common/dto/list-query.dto`) and return
   `PaginatedResult<T>` (`common/dto/pagination-query.dto`) — `{ data, total, limit, offset }`.
   The frontends' `DataTable` is server-driven and depends on that shape.
4. Controller: `@Controller({ path: '<plural>', version: '1' })` +
   `@UseInterceptors(ClassSerializerInterceptor)`. Every route is authenticated by the global
   `AuthGuard`; open one only with `@AllowAnonymous()` / `@OptionalAuth()`.

   A **business-scoped** controller (`path: 'businesses/:businessId/...'`) stacks its guards in
   this order, and the order is load-bearing — each one needs what the previous attached:

   ```ts
   @UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard, BranchScopeGuard)
   @RequireSector('restaurant')   // omit for a kernel domain every sector has
   ```

   Then `@RequirePermission({ <resource>: ['<action>'] })` on **every route, reads included** —
   see the rule below. Reach for `@CurrentBusiness()`, `@CurrentMembership()` and
   `@CurrentBranch()` rather than re-querying. Platform-operator routes are a different axis:
   `@UserHasPermission({ permissions: { business: ['view-any'] } })`, no business guard.
5. Register the module: **kernel** (sector-agnostic) modules go in `src/app.module.ts` `imports`;
   a module belonging to one sector goes in that sector's `src/sectors/<key>/sector.ts` instead,
   so `SECTORS_ENABLED` can gate it. A module in neither serves nothing, and nothing warns you.
6. Errors: throw i18n keys, not English strings —
   `throw new NotFoundException({ message: 'i18n:errors.plan.notFound', id })`. Add the key with
   the `i18n-catalogue` skill. `HttpExceptionFilter` translates and interpolates `{id}`.
7. Verify: `bun run check-types && bun run lint && bun run test`.

## Rules

- **Every business-scoped route needs `@RequirePermission`, reads included.** An ungated `@Get`
  is readable by any member of the business — a waiter or a chef. This was a real gap: supplier
  PANs, the purchase register, the TDS return, the invoice audit log and the controlled-substances
  register were all readable by anyone on the payroll. Reads a cashier or waiter genuinely needs to
  work (products, menu, tables, orders, batches) stay open deliberately; everything else is gated.
- **A module other modules depend on is split in two**: `<name>-core.module.ts` (providers only,
  exported) and `<name>.module.ts` (imports core, adds controllers). Import the *core* module when
  you need the service — importing the HTTP module drags its routes into whatever mounts you, which
  is how batch endpoints once appeared in a mart-only deployment.
- Anything writing an invoice, order or stock needs a branch: take it from `@CurrentBranch()`, or
  from the record being acted on (a credit note follows the branch of the invoice it corrects, a
  table order follows the table's branch). Never fall back to "the first branch".

## Gotchas

- **bun, never npm/yarn/pnpm**; CLI generators via `bunx`, never `npx`.
- Biome is deliberately absent here — `useImportType` rewrites constructor-injected classes to
  `import type` and breaks Nest DI at runtime. Do not add it, do not convert an injected
  constructor parameter's import to `import type`.
- Two audiences over one service = two controllers: `<domain>.controller.ts` for the client
  (`BusinessAccessGuard` + `@RequirePermission`) and `<domain>-admin.controller.ts` for the
  platform operator (`@UserHasPermission`, no business guard). Do not branch on the session inside
  one controller. When both share a path prefix, register the **client controller first** in
  `controllers: []` — Nest matches in declaration order, so `/businesses/me` would otherwise be
  captured by the admin controller's `/businesses/:businessId`.
- New response fields are a frontend contract: check `../web` and `../admin` `types/` before
  renaming or removing one.
