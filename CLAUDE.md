# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

`creative-nepal-api` — the NestJS backend, port 3333, global prefix `/api`, URI-based
versioning (`/api/v1/...`). Standalone repo. It was extracted from a Turborepo monorepo;
its siblings are `creative-nepal-web` (public site) and `creative-nepal-admin` (dashboard).
This repo has no workspace dependencies on either.

All three are checked out side by side under `creativenepal-platform/` as `api/`, `web/` and
`admin/`. Each is an independent git repository; the parent folder is convenience only.

## Commands

Package manager is **bun** (`devEngines.packageManager` = bun 1.3.14; `bun.lock` is present —
do not use npm/yarn/pnpm). Any CLI generator (`@better-auth/cli`, `drizzle-kit`, `@nestjs/cli`)
must be invoked via **`bunx`, never `npx`**.

```sh
bun run dev              # nest start --watch, port 3333
bun run build            # nest build
bun run lint             # eslint --fix
bun run format           # prettier --write
bun run check-types      # tsc --noEmit
bun run test             # jest
bun run test:e2e         # jest --config ./test/jest-e2e.json
bun run db:generate      # drizzle-kit generate
bun run db:push          # dev-loop schema sync
bun run db:migrate       # versioned prod migrations
bun run db:studio        # Drizzle Studio
bun run auth:generate    # regenerate Better Auth's Drizzle schema
bun run db:seed:content  # bootstrap CMS pages + navigation
```

## Linting: ESLint + Prettier, not Biome

The sibling frontend repos use Biome. This one deliberately does not: Biome's `useImportType`
rule rewrites constructor-injected classes into `import type`, which silently breaks NestJS's
decorator-metadata-based dependency injection at runtime. Keep `eslint.config.mjs` + `.prettierrc`.

## TypeScript 6 here, 7 in the frontends

`creative-nepal-web` and `creative-nepal-admin` run TypeScript 7. This repo is pinned to
`typescript@^6.0.3` and must stay there: `bun run build` drives the Nest CLI, which needs the
programmatic compiler API, and TypeScript 7.0 ships the `tsc` executable only — the API returns in
7.1. Installing 7.x fails the build with *"The installed TypeScript version does not expose the
programmatic compiler API"*. Revisit when the CLI supports 7.1.

Three `tsconfig.json` settings exist because of that toolchain, do not drop them:

- `"moduleResolution": "nodenext"` — `node10` was removed in TS 7 and deprecated in 6. NestJS 12 is
  ESM-only (`"type": "module"`), so subpath imports now go through its `exports` map.
- `"types": ["node", "jest"]` — under `nodenext` the automatic `@types` sweep no longer picks up
  `@types/jest`, and every `describe`/`it`/`expect` becomes `Cannot find name`.
- `"rootDir"` + explicit `include`/`exclude` — TS 6 requires an explicit `rootDir` (TS5011), and
  without `"exclude": ["dist"]` a stale `dist/tsconfig.tsbuildinfo` feeds the compiler cached
  diagnostics from the previous build. `tsconfig.build.json` sets `rootDir` to `./src` so the
  emitted layout stays `dist/main.js`.

NestJS 12 runs here, but four dependencies still declare peer ranges that stop at Nest 11:
`nestjs-pino`, `@nestjs/terminus`, `@nestjs/throttler` and `@thallesp/nestjs-better-auth`. They
work (the app boots and serves), but `nestjs-pino`'s `LoggerModuleAsyncParams` degrades against
Nest 12's `exports` map — that is why `LoggerModule.forRootAsync` in
`src/common/logging/logging.module.ts` passes an empty `providers: []`.

## Architecture

- `src/config/` — Zod-validated env schema + a typed `AppConfigService` wrapper. Never call
  `ConfigService.get()` with raw strings outside this module.
- `src/database/` — Drizzle Postgres client + schema, exposed to the rest of the app only
  through a `DRIZZLE` injection token (`InjectDatabase()` decorator), never imported directly.
- `src/auth/` — the `betterAuth()` server instance (`auth.config.ts`), wired into Nest via
  `@thallesp/nestjs-better-auth`'s `AuthModule.forRoot()`. A global `AuthGuard` protects every
  route by default; opt out per-route with `@AllowAnonymous()`/`@OptionalAuth()`. `@CurrentUser()`
  is a thin wrapper around the library's `@Session()` decorator.
- `src/health/` — `@nestjs/terminus` health check with a custom Drizzle-based DB indicator at
  `GET /api/health` (public).
- `src/i18n/` — `nestjs-i18n` catalogues (`en`/`ne`) served to the frontends via
  `GET /api/v1/i18n/:lang`. Services never inject `I18nService`; they throw a key behind an
  `i18n:` marker (`throw new ForbiddenException({ message: 'i18n:errors.invoice.quotaExceeded', limit })`)
  and `HttpExceptionFilter` translates it, interpolating `{placeholder}` from the payload. An
  argument value may itself carry the marker so slugs localize too. The catalogues are JSON, so
  `nest-cli.json`'s `assets` entry is what gets them into `dist` — do not remove it.
- `src/modules/<domain>/` — one folder per bounded domain, each following the repository pattern
  (`*.controller.ts` → `*.service.ts` → `*.repository.ts`, never skip a layer). `modules/users/`
  is the reference implementation.
- `src/sectors/` — the sector plugin seam that makes this repo a clonable multi-vertical template.
  Sectors shipped: `mart`, `medical`, `restaurant`, `services` (appointments/memberships —
  non-inventory, and the worked example of adding one; see `docs/TEMPLATE.md` §3).
  Sector keys are declared **once** in `src/database/schema/sector-keys.ts` (kept dependency-free
  so drizzle-kit can load the schema without pulling in Nest). Each sector then has:
  `<key>/meta.ts` (inert data: display key, roles, nav items, plan feature keys — importable
  without Nest, which is what makes it unit-testable and what `GET /v1/platform/sectors` serves),
  `<key>/access.ts` (the statements and roles it contributes to `auth/access-control.ts`), and
  `<key>/sector.ts` (the Nest modules it mounts). `SECTORS_ENABLED` (comma list, blank = all)
  selects which sectors a deployment mounts; an unknown key fails the boot rather than silently
  mounting everything. Access-control statements always compile in **every** sector regardless of
  `SECTORS_ENABLED`, because Better Auth's `roles` option replaces its defaults and the vocabulary
  must stay stable — enablement gates modules and routes, never the permission vocabulary.
- Modules that other modules depend on are split `<name>-core.module.ts` (providers only, exported)
  from `<name>.module.ts` (adds the controllers). Importing the core module gets you the service
  without dragging that domain's HTTP routes into a sector that shouldn't expose them — this is
  why a mart deployment has no `/batches` routes even though purchasing needs `BatchesRepository`.
- Business-scoped controllers stack three guards in order: `BusinessAccessGuard` (resolves and
  attaches the business + membership), `RequireSectorGuard` (`@RequireSector('restaurant')` —
  rejects a business of the wrong sector), then `RequirePermissionGuard` (`@RequirePermission(...)`).
  **Every** business-scoped route needs `@RequirePermission`, reads included — an ungated `@Get`
  is readable by any member of the business, including a waiter or chef.
- Multi-branch: a **branch is a Better Auth `team`** plus a `branches` satellite. Better Auth's
  `teamMember` has **no `role` column**, so a branch is *scoping*, not a role — a member's role is
  per-organization and applies at every branch they touch. Every business has exactly one default
  branch, created with it (`auth/organization-hooks.ts`); requests select one with an
  `X-Branch-Id` header resolved by `BranchScopeGuard` into `@CurrentBranch()`, falling back to
  that default. **An invoice series is (business, branch, fiscal year)** — `invoice_counters` is
  keyed on all three and `business_invoices` is unique on all four including the number, so two
  branches can each hold invoice #1. A credit note is always drawn from the series of the invoice
  it corrects, never from the caller's current branch. The default branch carries a NULL `code`
  so a single-branch business's printed numbers are unprefixed and unchanged. Stock lives in
  `product_branch_stock` per branch, with `products.stockQty` as the cached business-wide total;
  the branch row carries the sufficiency check, so the cache can never authorize a sale.
- `src/email/` — transactional email is an **outbox**, not a direct send. `EmailService.sendX()`
  writes a row to `email_outbox` (it is constructed outside Nest DI by `auth.config.ts`, so it
  reaches the database through `getDb()` like `organization-hooks` does); the `email-outbox` job
  claims due rows with `FOR UPDATE SKIP LOCKED`, calls `deliver()`, and retries with exponential
  backoff until `maxAttempts`, after which the row is dead-lettered and retryable from admin.
  Never call Resend directly — a failed password reset would otherwise vanish.
- `src/modules/jobs/` — every scheduled job. Schedules are **rows in `job_schedules`, not `@Cron`
  decorators**: `JobsBootstrap` seeds defaults from `JobsRegistry` and registers each job with
  Nest's `SchedulerRegistry` at boot, and a platform operator can change the cron expression or
  disable a job from admin, applied live without a deploy. Every run is wrapped by
  `JobRunnerService`, which records start, duration, outcome and detail to `job_runs` — so a
  failing job is visible rather than silent. Adding a job means adding a descriptor to
  `JobsRegistry`; nothing else.
- `src/modules/notifications/` — in-app notifications, scoped to a business (`businessId`) or to
  the platform operator (`businessId` null), optionally to one user. Read state is per user in
  `notification_reads`, so one member dismissing a business-wide alert does not hide it from the
  rest. Every raise carries a `dedupeKey` unique per scope, so a daily scan re-raising the same
  low-stock condition is a no-op rather than a flood.
- `src/modules/workspace/` — resolves what the signed-in member may see, server-side:
  `GET /v1/businesses/:id/workspace` returns the business, the membership role, that role's
  effective permissions, and the sector-scoped, permission-filtered navigation. The frontends
  render from this; they never derive a menu or a permission locally. The pure resolution logic
  lives in `workspace-access.ts` (no Nest import) so it is unit-tested directly.
- `src/modules/content/` — the CMS. Two controllers over one service: `content.controller.ts` is
  anonymous, cacheable and published-only; `content-admin.controller.ts` is gated on the platform
  `content` permission and can see drafts.
- `src/common/` — cross-cutting only: exception filter, logging interceptor.

Auth schema regeneration: `bun run auth:generate` re-runs `@better-auth/cli generate` against
`src/auth/auth.config.ts` — **required any time a Better Auth plugin changes**.

## Cross-repo contracts

Three things now span repo boundaries. Changing one means changing the others, in separate PRs.

**i18n catalogues.** `src/i18n/{en,ne}/` holds `common.json`, `errors.json` and `ui.json`.
`ui.json` is every string the web and admin interfaces render — no user-visible string is
hardcoded in a frontend component. Adding a string means adding the key to **both** `en/ui.json`
and `ne/ui.json`; the two files must stay key-for-key identical. The frontends consume
`GET /api/v1/i18n/:lang`, so a key added here is live for them without a frontend release.

**CMS block contract.** A page body is an ordered array of typed blocks (`hero`, `features`,
`richText`, `faq`, `cta`) stored as JSONB — never raw HTML, so an author cannot inject markup
into the site. The contract lives in three places that must move together, in this order:

1. here — `src/database/schema/content.ts` (the TypeScript shape) and
   `src/modules/content/content.schema.ts` (the Zod mirror every write is parsed with;
   class-validator cannot express a discriminated union, so the DTOs accept `unknown` and the
   service validates). Hrefs are restricted to site paths and `http(s)`/`mailto`/`tel`, which is
   what keeps `javascript:` URLs out of the database.
2. `creative-nepal-web` — `src/features/content/types` + `components/block-renderer.tsx`.
3. `creative-nepal-admin` — `src/features/content/types` + `schemas.ts`.

**Revalidation and preview.** After any CMS write this API pings `WEB_REVALIDATE_URL`
(`ContentRevalidationService`, fire-and-forget) so a publish reaches visitors without waiting out
the web app's 5-minute window. Draft preview: the web app sends `CONTENT_PREVIEW_SECRET` as
`x-preview-secret` and this API then includes drafts. `CONTENT_PREVIEW_SECRET` and
`WEB_REVALIDATE_SECRET` must match the values in the two frontend repos.

## Skills

Task procedures live in `.claude/skills/` and load on demand — this file stays the always-on
facts. Available here:

- `nest-module` — add or extend a domain module (controller → service → repository, DTOs,
  permissions, `app.module.ts` registration).
- `drizzle-schema-change` — schema edit → `db:generate` / `db:migrate`, and the generated
  `auth.ts` rule.
- `i18n-catalogue` — add a key to `en/` **and** `ne/`, the `i18n:` throw marker, and
  `scripts/check-parity.mjs` which fails on drift.
- `cms-block-type` — the API half of the block contract and the cross-repo rollout order.

### Installed from the registry

Third-party skills are vendored under `.agents/skills/<name>/` with a symlink from
`.claude/skills/<name>/` — both are committed, so a fresh checkout gets them. Manage with the
skills CLI, and note **`npx` fails inside this repo** (`devEngines.packageManager` pins bun):

```sh
bunx skills add <owner/repo@skill> -y   # install
bunx skills update                      # update everything installed here
```

- `nestjs-best-practices` (kadajett/agent-nestjs-skills, 26.4K installs) — 40 rules over
  architecture, DI, security, performance. Its **database rules assume TypeORM/Prisma**; this repo
  is Drizzle, so `drizzle-schema-change` and `nest-module` above win on any DB or layering conflict.
- `code-review` and `diagnosing-bugs` (mattpocock/skills, 451K / 509K installs) — a two-axis
  diff review and a debugging loop. Claude Code already ships a built-in `/code-review`, so this
  one is listed scoped as `<repo>:code-review` — pick that one for files in this repo.
