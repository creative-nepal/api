# Cloning this platform into a vertical product

This repo set is a **template**. A clone is a separate product — its own brand, domain, database
and customers — built from the same three repos, enabling only the sectors it sells, and pulling
upstream fixes by git merge.

A clone stays **multi-tenant**: one deployment serves many client businesses of that vertical.
Enabling one sector does not mean one customer.

```
template (upstream)                    clone: "MediBill"
 ├── api    ──────────────────────────► api    SECTORS_ENABLED=medical
 ├── web    ──────────────────────────► web    tenants: pharmacy A, clinic B, hospital C
 └── admin  ──────────────────────────► admin
```

---

## 1. What a clone may and may not change

This is the rule that keeps `git merge upstream/main` cheap.

**A clone owns:**

| Path | What |
|---|---|
| `.env` (all three repos) | `SECTORS_ENABLED`, `BRAND_*`, secrets, database, origins |
| `web/src/styles/brand.css`, `admin/src/styles/brand.css` | theme token overrides |
| `api/src/i18n/{en,ne}/ui.json` → `brand.*` | the name every screen renders |
| CMS content | edited in the admin dashboard, not in code |
| `api/src/sectors/<new-sector>/` | a sector only this clone sells |
| `api/src/modules/<new-domain>/`, `web/src/features/<new>/` | features only this clone needs |

**A clone must not edit** (change it upstream first, then merge down):

```
api/src/{auth,common,config,database/schema,health,i18n,modules/{businesses,plans,
         subscriptions,entitlements,platform,platform-billing,invoices,orders,
         sync,content,users,workspace},sectors/{catalog,registry,nav,sector-definition}}.ts
web|admin/src/{components,hooks,lib,styles/globals.css}
```

The design system under `components/`, `hooks/`, `lib/` and `styles/globals.css` is byte-identical
between `web` and `admin` and is synced by `web/scripts/sync-ui.sh` — a local edit there drifts on
every sync as well as every merge.

**Disable a sector by config, never by deleting its folder.** `SECTORS_ENABLED=medical` already
means the mart, restaurant and services modules are not mounted, their routes do not exist, and their plans
are not seeded. Deleting the folders buys nothing and guarantees a merge conflict on every
upstream release.

---

## 2. Standing up a clone

### 2.1 Fork the three repos

```sh
mkdir myvertical && cd myvertical
for repo in api web admin; do
  git clone <template-remote>/creative-nepal-$repo $repo
  (cd $repo && git remote rename origin upstream && git remote add origin <your-remote>/$repo)
done
```

Keep the sibling layout (`api/`, `web/`, `admin/` in one parent). Nothing depends on it at build
time, but every doc and the sync script assume it.

### 2.2 Database

```sh
docker run -d --name myvertical-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=myvertical \
  -p 5433:5432 postgres:16-alpine
```

### 2.3 Configure

Copy each `.env.example` to `.env` and fill it. The clone-specific ones:

```sh
# api/.env
SECTORS_ENABLED=medical                 # the vertical this product sells
BRAND_NAME=MediBill
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/myvertical
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://api.medibill.example
CORS_ORIGINS=https://medibill.example,https://admin.medibill.example
```

`CORS_ORIGINS` also drives Better Auth's `trustedOrigins`, so sign-in works on the clone's real
domains with no code change. Every origin the frontends are served from must be listed.

`CONTENT_PREVIEW_SECRET` and `WEB_REVALIDATE_SECRET` must match across all three repos.

### 2.4 Migrate and seed

```sh
cd api
bun install
bun run db:migrate
bun run db:seed:admin      # needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
bun run db:seed:plans      # seeds only the enabled sectors' plans
bun run db:seed:content    # CMS pages, titled with BRAND_NAME
bun run db:seed:demo       # optional: one demo business per enabled sector
```

### 2.5 Whitelabel

1. **Name** — `api/src/i18n/{en,ne}/ui.json` → the `brand` block. The frontends read it over HTTP,
   so this is live without a frontend release. Keep `en` and `ne` key-for-key identical.
2. **Colour** — `web/src/styles/brand.css` and `admin/src/styles/brand.css`. Uncomment the tokens
   and set them; these load after the shared design system, so they win.
3. **Marketing copy** — in the admin dashboard, not in code. The seed writes placeholders; the
   `terms` and `privacy` pages say so explicitly.
4. **Email** — `BRAND_NAME` covers subject lines and the layout header. Set `EMAIL_FROM` to a
   sender verified in Resend.

### 2.6 Run

```sh
cd api   && bun run dev     # :3333
cd web   && bun run dev     # :3000
cd admin && bun run dev     # :3001
```

---

## 3. Adding a sector to a clone

Only when the vertical needs a domain the template does not have. Prefer contributing it upstream —
a sector built in a clone never reaches the other clones.

1. `api/src/database/schema/sector-keys.ts` — add the key. This is the only place it is declared.
2. `api/src/sectors/<key>/meta.ts` — display key, role names, nav items (each with the permission
   it requires), plan feature keys. **No Nest or better-auth imports** — this file is what
   `GET /v1/platform/sectors` serves and what the unit tests load.
3. `api/src/sectors/<key>/access.ts` — statements and roles the sector contributes.
4. `api/src/sectors/<key>/sector.ts` — the Nest modules it mounts.
5. Register both in `catalog.ts` and `registry.ts`.
6. Schema in `api/src/database/schema/<key>.ts`, exported from `schema/index.ts`, then
   `bun run db:generate`.
7. Modules under `api/src/modules/`, each controller carrying `@RequireSector('<key>')` and
   `@RequirePermission(...)` — **including reads**.
8. i18n: `common.sector.<key>` and `ui.web.nav.*` in **both** `en` and `ne`.
9. `bun run auth:generate` if roles changed.
10. Web: `web/src/features/<key>/` and routes under `web/src/app/(workspace)/`. The sidebar needs
    no change — it renders whatever `/workspace` returns.

Verify with `SECTORS_ENABLED=<key>` alone: the new routes exist, every other sector's do not.

---

## 4. Pulling upstream changes

Order matters: i18n keys and the CMS block contract flow from `api` outward.

```sh
# 1. api
cd api && git fetch upstream && git merge upstream/main
bun install
bun run db:migrate                    # if drizzle/ gained a migration
bun run auth:generate                 # ONLY if a Better Auth plugin changed
bun run check-types && bun run lint && bun run test
node .claude/skills/i18n-catalogue/scripts/check-parity.mjs

# 2. web, then admin
cd ../web   && git fetch upstream && git merge upstream/main && bun install && bun run check-types && bun run lint
cd ../admin && git fetch upstream && git merge upstream/main && bun install && bun run check-types && bun run lint
cd ../web   && ./scripts/sync-ui.sh diff     # must be clean
```

Then the regression pass in §5.

**Conflicts you should expect, and what they mean:**

| Conflict in | Meaning |
|---|---|
| `.env.example` | upstream added a setting — add it to your `.env` too |
| `i18n/*.json` | upstream added keys; keep both sides, then re-run the parity check |
| `styles/globals.css` | you edited the shared design system — move it to `brand.css` |
| a kernel file | you edited something a clone should not; take upstream's side and re-apply your change upstream |

---

## 5. Regression pass

After a clone stand-up or an upstream merge:

```sh
# routes match the enabled sectors
SECTORS_ENABLED=<yours> bun run start
#   -> another sector's route must 404; yours must exist

# per role, against a demo business
#   owner    full nav, all reads
#   cashier  nav [pos, invoices]; 403 on suppliers and stock-adjustments
#   chef     nav [kitchen] only; 403 on suppliers, register, analytics, invoices
```

Then by hand: sign in, create a business, add a product, ring up a sale, confirm the invoice
number is gapless within its fiscal-year series, issue a credit note, record a purchase bill,
issue a debit note, and download the purchase register.

Invoice numbering is the one thing that cannot be corrected after the fact — if a migration
touches `invoice_counters` or a series key, assert `max(invoice_number)` per series before and
after and confirm it is unchanged. A series is **(business, branch, fiscal year)**: each branch
numbers independently, so two branches legitimately both hold invoice #1, and a business's
default branch keeps a NULL code so its printed numbers stay unprefixed.

---

## 6. Releases

The template tags the three repos in lockstep (`template-v1.2.0`). Record the tag a clone sits on
in its own README, so an upstream merge has a known starting point.

Never rewrite a clone's history to match upstream; merge, don't rebase — the divergence is the
product.
