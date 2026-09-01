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

1. `src/modules/<domain>/` — create the four files above plus `dto/`.
2. Repository: inject with `@InjectDatabase() private readonly db: Database`, never import
   the client module directly. For sortable lists declare a `SORTABLE` map of allowed
   columns and resolve with `resolveOrderBy()` from `common/repository/sorting` — do not
   interpolate `sortBy` into SQL.
3. List endpoints: extend `ListQueryDto` (`common/dto/list-query.dto`) and return
   `PaginatedResult<T>` (`common/dto/pagination-query.dto`) — `{ data, total, limit, offset }`.
   The frontends' `DataTable` is server-driven and depends on that shape.
4. Controller: `@Controller({ path: '<plural>', version: '1' })` +
   `@UseInterceptors(ClassSerializerInterceptor)`. Every route is authenticated by the global
   `AuthGuard`; gate writes with `@UserHasPermission({ permissions: { <resource>: ['create'] } })`,
   and open a route only with `@AllowAnonymous()` / `@OptionalAuth()`.
5. Register the module in `src/app.module.ts` `imports` — a module that is not listed there
   serves nothing, and nothing warns you.
6. Errors: throw i18n keys, not English strings —
   `throw new NotFoundException({ message: 'i18n:errors.plan.notFound', id })`. Add the key with
   the `i18n-catalogue` skill. `HttpExceptionFilter` translates and interpolates `{id}`.
7. Verify: `bun run check-types && bun run lint && bun run test`.

## Gotchas

- **bun, never npm/yarn/pnpm**; CLI generators via `bunx`, never `npx`.
- Biome is deliberately absent here — `useImportType` rewrites constructor-injected classes to
  `import type` and breaks Nest DI at runtime. Do not add it, do not convert an injected
  constructor parameter's import to `import type`.
- Two audiences over one service = two controllers, like `content.controller.ts` (anonymous,
  published-only) and `content-admin.controller.ts` (permission-gated, sees drafts). Do not
  branch on the session inside one controller.
- New response fields are a frontend contract: check `../web` and `../admin` `types/` before
  renaming or removing one.
