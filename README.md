# creative-nepal-api

NestJS backend. Postgres via Drizzle, Better Auth, CMS, i18n. Port 3333, global prefix `/api`,
URI versioning (`/api/v1/...`).

Part of a three-repo system, checked out side by side:

| Repo | Role | Port |
| --- | --- | --- |
| **`creative-nepal-api`** (this repo) | backend | 3333 |
| [`creative-nepal-web`](../web) | public site | 3000 |
| [`creative-nepal-admin`](../admin) | internal dashboard | 3001 |

```
creativenepal-platform/
  api/      NestJS backend
  web/      public site
  admin/    internal dashboard
```

Each is an independent git repository; the parent folder is just for convenience.

## Getting started

Requires [bun](https://bun.sh) 1.3.14 and Postgres.

```sh
bun install
cp .env.example .env        # set DATABASE_URL, BETTER_AUTH_SECRET, CORS_ORIGINS
bun run db:push             # sync schema (dev loop)
bun run db:seed:admin       # create the first platform admin
bun run db:seed:content     # bootstrap CMS pages + navigation
bun run dev                 # http://localhost:3333
```

`GET /api/health` is public and reports database connectivity.

## Scripts

```sh
bun run dev              # nest start --watch
bun run build            # nest build
bun run start:prod       # node dist/main
bun run lint             # eslint --fix
bun run format           # prettier --write
bun run check-types      # tsc --noEmit
bun run test             # jest
bun run test:e2e         # jest --config ./test/jest-e2e.json

bun run db:generate      # drizzle-kit generate (versioned migration)
bun run db:push          # drizzle-kit push (dev-loop schema sync)
bun run db:migrate       # drizzle-kit migrate
bun run db:check         # drizzle-kit check
bun run db:studio        # Drizzle Studio
bun run auth:generate    # regenerate Better Auth's Drizzle schema
```

`bun run auth:generate` is **required any time a Better Auth plugin changes**.

## Layout

```
src/
  config/      Zod-validated env + typed AppConfigService
  database/    Drizzle client + schema, exposed via the DRIZZLE token only
  auth/        betterAuth() instance; global AuthGuard, @AllowAnonymous/@OptionalAuth
  health/      terminus health check with a Drizzle DB indicator
  i18n/        en/ne catalogues, served at GET /api/v1/i18n/:lang
  modules/     one folder per domain: controller -> service -> repository
    content/   the CMS (public controller + permission-gated admin controller)
  common/      exception filter, logging interceptor
docs/          system design, feature specs, competitor research, plans
```

## Linting

ESLint + Prettier, **not Biome**. Biome's `useImportType` rewrites constructor-injected classes
into `import type`, which silently breaks NestJS's decorator-metadata dependency injection at
runtime. The frontend repos use Biome; this one must not.

## Docker

```sh
docker build -t creative-nepal-api .
docker run --env-file .env -p 3333:3333 creative-nepal-api
```

CI publishes to GHCR on pushes to `main` (`.github/workflows/docker-publish.yml`).

## Sector features and where they came from

The four sectors are `mart`, `medical` (pharmacy retail), `restaurant` and `services`, enabled per
deployment with `SECTORS_ENABLED`. Beyond the kernel — invoicing, purchasing, tenancy, CMS — each
sector's feature set was built against what products already sold into that vertical actually
ship, read from their own documentation:

| Sector | Reference products | What that produced here |
| --- | --- | --- |
| all four | [mis.ac](https://mis.ac/articles/blog/pos-software-nepal.php), [Vyapar](https://vyaparapp.in/pos-software/retail), IMS | payments by method (cash/eSewa/Khalti/Fonepay/card), split tender, till open-close with cash variance |
| `restaurant` | [Petpooja](https://www.petpooja.com/poss), [Foodmandu](https://foodmandu.com/), Bhoj, Pathao Food | delivery channels with per-aggregator commission and channel-level gross/net reporting |
| `medical` | [Marg ERP](https://margcompusoft.com/retail/chemist_software.html) | substitute-by-salt, rack location, one search box over salt/rack/barcode, loose unit sales from a strip |
| `services` | [Zenoti](https://www.zenoti.com/salon-management-software), [Fresha](https://www.fresha.com/for-business) | appointment deposits, no-show forfeiture, reminder job |

**[`docs/competitor-research.md`](docs/competitor-research.md)** records the full comparison —
what each product advertises, what we matched, what we deliberately left out and why, and the
three bugs the exercise uncovered. [`docs/gap-analysis.md`](docs/gap-analysis.md) is the earlier
round against Nepali billing software generally.

## Notes for contributors

`CLAUDE.md` documents the module conventions, the i18n error-marker pattern, and the cross-repo
contracts (CMS block types, i18n keys, shared secrets). Adding a CMS block type requires
coordinated changes in all three repos, starting here.
