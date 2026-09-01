# Rebuild creative-nepal as a full-stack Turborepo

## Context

The repo is currently the untouched `create-turbo` starter (`apps/web`, `apps/docs`, `packages/ui`/`eslint-config`/`typescript-config`). The user wants to replace it with a real product monorepo: a public Next.js web app, a Next.js admin dashboard, a NestJS API, and an Expo mobile app, sharing auth (Better Auth), a Postgres database (Drizzle ORM), a shadcn/ui component library, and a TanStack Query + Axios data layer — all under Turborepo, with a modular folder structure per app.

Confirmed decisions:
- **Wipe and rebuild** `apps/*` and `packages/*` from scratch (not an incremental repurpose).
- **Include `apps/mobile` (Expo)** now, not deferred.
- **Single Better Auth instance lives in `apps/api`** (NestJS, Postgres via Drizzle adapter). `web`, `admin`, and `mobile` are all pure clients of the API's `/api/auth/*` endpoints — no per-app auth instances.

Package manager is **bun** everywhere — root, and every app (`web`, `admin`, `api`, `mobile`) uses bun for installs/scripts, no mixed npm/yarn/pnpm.

Linting/formatting is **Biome** across the whole repo (replaces ESLint + Prettier entirely) — one `packages/biome-config` package with a shared base config, extended per app where needed (e.g. React/JSX rules for the Next.js/Expo apps).

Every Next.js app uses the **`src/` layout** (`apps/web/src/app`, `apps/admin/src/app`), not root-level `app/`.

**Repo-wide gotcha:** root `devEngines.packageManager` pins `bun`, which makes `npm`/`npx` invocations hard-fail (`EBADDEVENGINES`) anywhere in this repo — confirmed while loading the `shadcn` skill during planning. Every generator/CLI command below (`shadcn`, `@better-auth/cli`, `drizzle-kit`, `nest`, `create-expo-app`) must be run via **`bunx`, never `npx`**, and this gets called out explicitly in `README.md`/`CLAUDE.md` so it isn't rediscovered the hard way later.

This plan was cross-checked against the repo's installed skills (`better-auth-best-practices`, `drizzle-orm-patterns`, `nestjs-best-practices`, `turborepo`, `vercel-react-best-practices`, `shadcn`, `vercel-composition-patterns`) so the scaffold starts aligned with their guidance rather than needing a later cleanup pass.

## Target layout

```
apps/
  web/     Next.js 16 (App Router) — public web app          :3000
  admin/   Next.js 16 (App Router) — admin dashboard, auth-gated :3001
  api/     NestJS — REST API + Better Auth handler            :3333
  mobile/  Expo (expo-router) — React Native client
packages/
  ui/                 shadcn/ui primitives + reusable form-field layer (Tailwind v4) — used by web + admin
  db/                 Drizzle schema, pg client, drizzle-kit migrations — used by api
  auth/               Better Auth server instance (drizzle adapter) + web/admin client factory
  api-client/         Axios instance factory + TanStack Query setup + example hook pattern — used by web, admin, mobile
  biome-config/        shared biome.json base, extended per app
  typescript-config/  tsconfig bases: base, nextjs, react-library, nestjs, expo
  utils/               shared formatters (date-fns-based) + generic helpers — used by web, admin, mobile, api
```

## Per-package/app design

**packages/typescript-config** — `base.json`, `nextjs.json`, `react-library.json` (mirrors stock), plus new `nestjs.json` (CommonJS/decorators-enabled base for Nest) and `expo.json` extending `expo/tsconfig.base`.

**packages/biome-config** — single `biome.json` at package root (formatter + linter rules), with the `assist` actions block enabling `source.organizeImports` (Biome's import-sorting rule: groups/sorts imports on save/check) turned on for every consumer. Consumed via Biome's `extends` field by every app/package's own `biome.json` (each app layers small overrides, e.g. JSX-specific rules for web/admin/mobile). Root `bun run lint` / `bun run format` call `biome check` / `biome check --write` across the whole repo; no ESLint or Prettier anywhere.

**packages/db** — `drizzle-orm` + `postgres` driver + `drizzle-kit`. `src/schema/auth.ts` holds the full Better Auth table set required by the enabled plugins (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `passkey`, plus admin-plugin columns on `user` such as `role`/`banned`), generated via `bunx @better-auth/cli generate --output src/schema/auth.ts` against the `packages/auth` server config and committed; domain tables (e.g. `src/schema/users.ts` extras beyond auth) use `relations()` to declare joins, and foreign keys reference other tables via arrow functions (`() => otherTable.id`) to avoid circular-import issues between schema files; every table exports `$inferSelect`/`$inferInsert` types instead of hand-written duplicates. `src/schema/index.ts` barrel; `src/client.ts` exports `db` built from `DATABASE_URL`. Root `drizzle.config.ts`. Scripts: `db:generate` + `db:migrate` for the versioned prod flow, `db:push` for fast dev-loop schema sync, `db:studio`. Consumed only by `apps/api`.

**packages/auth** — `src/server.ts`: `betterAuth({ database: drizzleAdapter(db, { provider: "pg" }), ... })`, imported by `apps/api` only (server-only, pulls in `packages/db`). `BETTER_AUTH_SECRET` (32+ chars) / `BETTER_AUTH_URL` come from env and are **not** duplicated into `secret`/`baseURL` config fields (per Better Auth's own guidance — only set those fields if the env vars are absent). `trustedOrigins` lists the web/admin/mobile dev+prod origins explicitly. Every plugin is imported from its dedicated subpath for tree-shaking (`better-auth/plugins/admin`, not the barrel `better-auth/plugins`): `admin()` (role/ban management), `emailOTP()` (OTP sign-in/verification — email sending stubbed behind a `sendOTP` callback to fill in later), `passkey()` (WebAuthn), `lastLoginMethod()` (tracks/returns which method a user last used), `organization()` (multi-tenant orgs/members/invitations), plus a shared `accessControl`/statement definition passed to both `admin()` and `organization()` for role-based permissions. `socialProviders.google` configured with client id/secret from env for web/admin's redirect-based flow, **and** the `expo()` server plugin (from `@better-auth/expo`) enabled so `apps/mobile` can complete Google sign-in via native **ID token** exchange (`authClient.signIn.social({ provider: "google", idToken: { token, ... } })`) instead of a browser redirect.

`src/client.ts`: `createAuthClient(baseURL)` using `better-auth/react` with matching client plugins (`adminClient()`, `emailOTPClient()`, `passkeyClient()`, `lastLoginMethodClient()`, `organizationClient()`), imported by `apps/web` and `apps/admin`. `apps/mobile` gets its own client in-app (`src/lib/auth-client.ts`) built on `better-auth/react` + the same client plugins **plus** `expoClient()` from `@better-auth/expo` (wires `expo-secure-store` for token storage and scheme-based redirects) and uses `@react-native-google-signin/google-signin` (or `expo-auth-session`'s Google provider) to obtain the native Google ID token that's then passed into `signIn.social`. `Session`/`User`/`Organization` types are **inferred**, not hand-rolled (`typeof auth.$Infer.Session`, `typeof auth.$Infer.Session.user`) and re-exported from `packages/auth` for reuse across all four apps.

Since these plugins add tables beyond the base four (organization, member, invitation, passkey, plus admin-related columns on `user`), `packages/db`'s `src/schema/auth.ts` is generated with the full plugin set enabled so `@better-auth/cli generate` emits the complete schema in one pass — **re-run the CLI generate step any time a plugin is added or changed**. After first boot, verify the instance is live with `GET /api/auth/ok` → `{ status: "ok" }`.

**packages/api-client** — framework-agnostic. `src/axios.ts`: `createApiClient({ baseURL, getAuthHeaders? })`. `src/query-client.ts`: `createQueryClient()` with shared defaults (staleTime, retry). Stays deliberately generic (the axios instance + the `QueryClient` factory) — feature-specific queries/mutations live in each app's `features/<feature>/` folder (below), not in this package, so this package doesn't grow a copy of every domain's API surface.

**packages/utils** — framework-agnostic, no UI/React dependency, consumed by `web`, `admin`, `mobile`, and `api` alike. `src/formatters/` holds every human-facing formatter as a small named function (`formatDate`, `formatDateTime`, `formatRelativeTime`, `formatCurrency`, `formatFileSize`, `truncate`, …) so formatting logic is written once instead of re-implemented per app. **All date/time formatting goes through `date-fns`** (`format`, `formatDistanceToNow`, `parseISO`, etc.) — no hand-rolled `Date` string manipulation, no second date library. `src/lib/` for other generic helpers (e.g. `cn`-adjacent non-UI helpers stay out of here — those remain in `packages/ui`). Exported the same per-file way as the other packages (`exports: { "./*": "./src/*.ts" }`).

**packages/ui** — follows shadcn's official monorepo pattern: `shadcn/ui` initialized *inside `packages/ui`* with Tailwind v4 (CSS-first config), package-root `components.json` (`"aliases": { "components": "@repo/ui/components", "utils": "@repo/ui/lib/utils" }`). Folder structure keeps shadcn's own output strictly separate from anything hand-built on top of it, so `bunx shadcn@latest add`/`diff`/`update` never collide with custom code:

```
packages/ui/src/
  components/
    ui/          # raw shadcn primitives only — CLI-generated/updated, never hand-edited beyond shadcn's own diffs
    form/         # abstracted field components built ON TOP of ui/ (see below)
    composed/    # other reusable compound components built from ui/ (data-table, page-header, empty-state, confirm-dialog, sidebar shell)
  hooks/          # shared hooks (e.g. use-media-query) backing composed/ components
  lib/utils.ts    # cn()
  styles/globals.css
```

New primitives are added by running `bunx shadcn@latest add <component>` **from `packages/ui`** (not from the consuming app), landing exclusively in `src/components/ui/` — the shared, never-duplicated-per-app source of truth. **Prefer a shadcn primitive (or `add`-ing one) over hand-rolling a component whenever one fits** — the `composed/` and `form/` layers exist to *wrap* shadcn primitives with app-specific behavior, not to replace them. Seed `components/ui/` with `button`, `card`, `input`, `label`, `field` (shadcn's `Field`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError` primitives), `select`, `radio-group`, `checkbox`, `switch`, `popover`, `command` (for combobox), `calendar`, `dialog`, `dropdown-menu`, `sonner`, `avatar`, `badge`, `table`, `sidebar`, `separator`, `skeleton`, `tabs`. Exported via `exports: { "./*": "./src/*.tsx", "./globals.css": "./src/styles/globals.css" }`, matching the current stub's per-file export pattern. Each Next.js app's own `components.json` sets `"aliases.ui": "@repo/ui/components"` and points at the shared `components.json` so `shadcn add` run from an app still resolves against the shared registry; each app's Tailwind entry CSS does `@import "@repo/ui/globals.css"` plus `@source "../../../packages/ui/src"` so Tailwind scans the shared component source for class names.

`src/components/composed/` — reusable pieces assembled purely from `components/ui/` primitives (never raw HTML where a primitive exists): `<DataTable>` (built on `table` + `@tanstack/react-table`, paired with `nuqs` for its filter/sort/page state), `<PageHeader>`, `<EmptyState>`, `<ConfirmDialog>` (wraps `dialog` + `button`), and the `admin` sidebar shell (wraps `sidebar` — see below). These are what `web`/`admin` compose pages from, so a page is built from `@repo/ui/composed` + `@repo/ui/form` + a couple of feature-specific bits, not raw shadcn primitives sprinkled through every page.

**`packages/ui/src/components/form/`** — the shared, reusable form-field layer that `web` and `admin` both build every form from, so a field's look/behavior/validation-wiring is defined once. Built on shadcn's `Field` primitives + `react-hook-form` (`useFormContext`/`Controller`) + `@hookform/resolvers/zod`, so callers never touch RHF plumbing directly:
  - `<Form>` — thin wrapper around RHF's `FormProvider` that also takes a Zod `schema` prop and wires `zodResolver(schema)` internally.
  - `<TextField>`, `<EmailField>`, `<PasswordField>` (built-in show/hide toggle), `<NumberField>`, `<TextareaField>` — each renders `FieldLabel` + the shadcn `Input`/`Textarea` + `FieldError`, reading validation state off `useFormContext` by `name`.
  - `<SelectField>` (shadcn `Select`), `<RadioGroupField>` (shadcn `RadioGroup`), `<CheckboxField>`, `<SwitchField>`, `<ComboboxField>` (`Popover` + `Command`, async-searchable), `<DateField>` (`Popover` + `Calendar`, display value formatted via `@repo/utils`'s `formatDate`), `<DateTimeField>` (`DateField` + a time input, combined value, formatted via `@repo/utils`'s `formatDateTime`) — same `name`/`label`/`description` contract as the text fields above.
  - Every field is a controlled leaf that only needs `name` (+ field-specific props like `options` for select/radio/combobox); the schema passed to `<Form>` is the single source of truth for validation, so no duplicate per-field validation logic. New forms in `web`/`admin` are built by composing these, not by hand-rolling RHF wiring per page.
  - Follows the `vercel-composition-patterns` skill throughout: `PasswordField`/`EmailField`/`NumberField` etc. are **explicit variant components**, not one `TextField` with boolean mode props (`isPassword`, `isEmail`) branching internally (`architecture-avoid-boolean-props`, `patterns-explicit-variants`); `<Form>` is a **compound component** — it owns the RHF context and every `*Field` reads from it via `useFormContext`, so state is decoupled from any one field's implementation (`architecture-compound-components`, `state-decouple-implementation`). Components take `ref` as a normal prop (React 19, no `forwardRef`) and read context with `use()` rather than `useContext()` (`react19-no-forwardref`).

**Zustand** — per-app, not centralized in a package (client UI state like "sidebar collapsed" or "command palette open" doesn't need to cross app boundaries). Convention: `src/stores/<name>-store.ts` per app, one focused `create<...>()` store per concern (not one giant app store), `persist` middleware only for state that should survive a refresh (e.g. admin sidebar collapsed state).

**nuqs** — used in `apps/web` and `apps/admin` (both Next.js App Router) for URL-driven state: table filters/sort/pagination in the admin dashboard, tab/search state in web, so that state is shareable/bookmarkable instead of living in local React state. Wired once via `<NuqsAdapter>` in each app's root `src/providers/providers.tsx`; consumed with `useQueryState`/`useQueryStates` in feature components. Not used in `apps/mobile` — there's no URL to synchronize with in Expo, so `mobile` sticks to Zustand/local state for equivalent UI state.

**apps/api (NestJS)** — scalable, modular-monolith folder structure per the `nestjs-best-practices` skill's top-priority rules (`arch-feature-modules`, `arch-avoid-circular-deps`, `arch-use-repository-pattern`, `di-prefer-constructor-injection`):
- `src/main.ts` — bootstrap, global `ValidationPipe` (whitelist + transform, `security-validate-all-input`), CORS with `credentials: true` allowing web/admin/mobile dev origins, global prefix `api`, `helmet`, `app.enableShutdownHooks()` for graceful shutdown (`devops-graceful-shutdown`).
- `src/config/` — `@nestjs/config` registered as a global module (`devops-use-config-module`), zod-validated env schema (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), typed `ConfigService` wrapper (`AppConfigService`) instead of raw `configService.get(...)` calls scattered around.
- `src/database/` — Nest module that provides the Drizzle `db` client (from `packages/db`) behind a `DRIZZLE` injection token (`di-use-interfaces-tokens`), so feature modules depend on an injectable rather than importing `packages/db` directly; multi-step writes go through `db.transaction()` (`db-use-transactions`), and list endpoints use `.limit()`/relational queries deliberately to avoid N+1s (`db-avoid-n-plus-one`).
- `src/auth/` — Better Auth wired via **`@thallesp/nestjs-better-auth`** (`AuthModule.forRoot({ auth })` in `AppModule`, pointed at `packages/auth`'s `auth` instance, which already has the admin/emailOTP/passkey/lastLoginMethod/organization plugins + Google/expo social config). Gives `/api/auth/*` routes, a global `AuthGuard` (`security-use-guards`), and `@Session()`/`@Optional()` decorators for pulling the current user/session/organization into controllers.
- `src/modules/<domain>/` — one folder per bounded domain (starting with `users/` as the example), each self-contained and following the repository pattern (`*.module.ts`, `*.controller.ts`, `*.service.ts` calling a `*.repository.ts` rather than touching `db` directly, `dto/` with class-validator DTOs for request validation and response serialization (`api-use-dto-serialization`)). Controllers stay thin — one focused service per concern, not "god services" (`arch-single-responsibility`). New domains follow this exact shape.
- `src/common/` — cross-cutting, framework-level concerns only: guards, a global exception filter (`error-use-exception-filters`, translating errors to Nest `HttpException`s per `error-throw-http-exceptions`), interceptors (logging/response-shaping via `api-use-interceptors`), pipes, decorators (`@CurrentUser()` wrapper around Better Auth's `@Session()`).
- `src/health/` — health check module (`@nestjs/terminus`) checking DB connectivity (`micro-use-health-checks`).
- API is versioned from day one (`api-versioning`) via Nest's URI versioning (`/api/v1/...`) so `web`/`admin`/`mobile` have a stable contract as the API evolves.
- Barrel (`index.ts`) exports kept at the module boundary only (what a module exposes to `AppModule`), not sprinkled through every folder, to avoid circular-import foot-guns.

**apps/web** and **apps/admin** (Next.js 16, App Router, Tailwind v4, `src/` layout, following Vercel/Next.js best practices)
- `src/app/` — routes only (thin): Server Components by default, `"use client"` pushed to the leaves (interactive form/query bits), not whole pages, to keep bundles small and let Next stream/cache the rest. `(auth)/login`, `(auth)/register` route groups, root `layout.tsx` wires providers and uses `next/font` for font loading (no manual `<link>` font tags).
- `src/features/<feature>/` — every feature is a self-contained folder with the same fixed shape, so any feature is navigable without hunting across the app:

  ```
  features/<feature>/
    components/         # presentational pieces local to this feature (built from @repo/ui/composed + @repo/ui/form)
    views/               # page-level composition — wires components + queries/mutations/hooks into what a route renders
    hooks/               # feature-local hooks (wrap queries/mutations/state into one call)
    schemas.ts           # Zod schemas — passed straight into @repo/ui's <Form schema={...}>
    types.ts              # feature-local types not already covered by a schema's z.infer<> or the API's generated types
    constants.ts          # feature-local constants (e.g. option lists for a SelectField)
    services.ts            # thin functions calling @repo/api-client's axios instance — the only place raw HTTP calls happen
    queries.ts             # TanStack Query `queryOptions(...)` factories built on services.ts
    mutations.ts            # `useMutation` factories built on services.ts
    search-params.ts         # nuqs parsers/`createSearchParamsCache` for this feature's URL state
  ```

  `src/app/**/page.tsx` route files stay thin: import a feature's `views/` component and render it, nothing else. Server Components read via `services.ts`/`queries.ts` directly where possible; TanStack Query (via `queries.ts`/`mutations.ts`) is reserved for client-side interactive/mutating data (forms, optimistic updates, polling). Login/register/OTP/passkey forms are built from `@repo/ui`'s form-field components (`<Form schema={loginSchema}><EmailField name="email" /><PasswordField name="password" /></Form>`) against that feature's `schemas.ts`, and submit through the relevant `authClient` call from `@repo/auth`'s client. `admin`'s data-table filter/sort/pagination state is defined in each feature's `search-params.ts` and read/written via `nuqs`'s `useQueryStates` in `views/`.
- `src/stores/` — Zustand stores, one per concern (e.g. `sidebar-store.ts` in `admin`), per the shared-package design's convention.
- `src/lib/api.ts` — instantiates `createApiClient`/`createAuthClient` with `NEXT_PUBLIC_API_URL`; server-side calls to the API forward the incoming request's cookies explicitly (no implicit credential leakage across requests).
- `src/providers/` — a single client-boundary `providers.tsx` (`QueryClientProvider` from `@repo/api-client`, `NuqsAdapter` from `nuqs/adapters/next/app`, theme provider) mounted once in the root layout, keeping the rest of the tree server-rendered.
- `src/proxy.ts` — Next.js 16 renamed `middleware.ts` to `proxy.ts` (same request-interception API); used here for a lightweight session-cookie presence check that redirects to login (full validation happens server-side per request via the API), kept minimal per Vercel's guidance to avoid heavy logic in this hot path.
- `next.config.ts` sets `typedRoutes: true` and `images.remotePatterns` explicitly (no `domains` wildcarding); `admin` additionally gets a `src/app/(dashboard)/layout.tsx` shell built from `@repo/ui/composed`'s dashboard-sidebar wrapper — itself built directly on shadcn's `sidebar` primitive (`components/ui/sidebar.tsx`) rather than a hand-rolled layout. `<SidebarProvider>` lifts collapsed/open state (backed by the Zustand `sidebar-store`) so `<Sidebar>`, `<SidebarTrigger>`, and `<SidebarInset>` all read it via context instead of threading a `collapsed` boolean prop down through every layer (`architecture-compound-components`, `state-lift-state`) — gated by session, since it's an internal tool; `web` stays public-first with metadata/OG tags via the App Router `metadata` API.

**apps/mobile** (Expo, expo-router, `src/` layout)
- `src/app/` file-based routes (`(auth)/login`, `(tabs)/...`) — expo-router supports routing from `src/app` via the `expo.router.appRoot` (or default `src/app`) setting, kept consistent with web/admin's `src/` convention.
- `src/lib/auth-client.ts` — Better Auth client + `expoClient()` plugin (secure-store token storage); login screen offers email/password, email OTP, passkey, and **Google sign-in via native ID token** (Google Sign-In SDK obtains the token, `authClient.signIn.social({ provider: "google", idToken })` exchanges it with the API — no browser redirect needed on-device).
- `src/lib/api.ts` (wraps `@repo/api-client`, attaches the Better Auth session token from `expo-secure-store` via an axios interceptor).
- `src/components/` local to the app (no `@repo/ui`, since that's DOM/shadcn-based); optionally NativeWind later, not required for the scaffold.

## Turborepo / root wiring (Turborepo skill's rules)

- **Package tasks, not root tasks**: every real script (`build`, `lint`, `check-types`, `dev`, and `db:generate`/`db:push`/`db:migrate`/`db:studio`) lives in the owning package's own `package.json`; root `package.json` only ever delegates via `turbo run <task>` (never plain `turbo <task>` — that shorthand is reserved for interactive one-off terminal use, never written into scripts/CI). `db:generate` etc. are real scripts in `packages/db/package.json`, registered as root-level Turborepo tasks (`"cache": false`, since migrations must always actually execute) and invoked as `turbo run db:migrate`, not hand-rolled root scripts that reach into `packages/db` directly.
- `turbo.json`: `build`/`lint`/`check-types`/`dev` tasks (`lint` now runs `biome check` per package instead of `eslint`); package-specific differences (e.g. `api`'s build outputs `dist/**` vs. Next's `.next/**`, `mobile` having no `build` task since Expo uses `dev`/EAS) are expressed via a **Package Configuration** (`apps/api/turbo.json` with `"extends": ["//"]`) rather than cluttering the root `turbo.json` with `package#task` overrides.
- Declare env-var dependencies explicitly via `turbo.json`'s `globalEnv`/per-task `env` (e.g. `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `BETTER_AUTH_SECRET`) so cache keys correctly bust when config changes, not just source files; `.env`/`.env.*` files are added to each task's `inputs` (Turborepo doesn't load `.env` itself, but needs to know when they change).
- **No root `.env` file** — each app owns its own `.env`/`.env.example` (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`), so it's always clear which package needs which variable and cache invalidation stays scoped instead of repo-wide.
- Root `devDependencies` stay limited to repo tooling only (`turbo`, `typescript`, Biome) — no app-level deps (React, Next, Nest, Expo) at the root.
- `--filter` is the standard way to scope a task to one workspace or its dependents (e.g. `--filter=...admin` when iterating on a shared package `admin` consumes); `--affected` is the standard for CI/"only what changed." Both get a short mention in `README.md` rather than re-teaching turbo basics ad hoc.
- `.env.example` per app documents required vars, including `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (api) and platform-specific Google client IDs for mobile.
- Update `CLAUDE.md` and `README.md` to describe the new architecture (replacing the current stock-starter content), including the bun-only/`bunx`-not-`npx` note above.

## Execution order

1. Delete `apps/web`, `apps/docs`, existing `packages/ui/src` stub content, `packages/eslint-config`.
2. Rebuild `packages/typescript-config`, add `packages/biome-config`.
3. Build `packages/db` (schema + client + drizzle-kit config).
4. Build `packages/auth` (server instance + web client factory).
5. Build `packages/api-client` (axios + query client, deliberately generic) and `packages/utils` (date-fns-based formatters + generic helpers).
6. Build `packages/ui` (shadcn init + seed primitives in `components/ui/` + the `components/form/` and `components/composed/` layers on top).
7. Build `apps/api` (Nest app, auth mount, users module, health module).
8. Build `apps/web` (`src/` layout).
9. Build `apps/admin` (`src/` layout).
10. Build `apps/mobile`.
11. Wire root `turbo.json`/`package.json`, `.env.example` files, update `README.md`/`CLAUDE.md`.
12. `bun install` (bun everywhere, including inside `apps/api` and `apps/mobile`), then `bun run check-types` and `bun run lint` (Biome) across the workspace; fix any scaffold-level type/lint errors that surface.

## Verification

- `bun install` succeeds with no unresolved workspace deps.
- `turbo run check-types` passes for every app/package.
- `turbo run dev --filter=api` boots Nest and `GET /api/health` responds 200.
- `turbo run dev --filter=web` and `--filter=admin` boot Next.js on :3000/:3001 with no build errors.
- `apps/mobile`: `bunx expo-doctor` (or `expo start` reaching the Metro bundler) with no config errors.
- Manual smoke: register/login via `web`'s login form hits `apps/api`'s Better Auth endpoints and a session cookie is set.
