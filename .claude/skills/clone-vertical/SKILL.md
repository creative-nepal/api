---
name: clone-vertical
description: >
  Stand up a new vertical product from this template — clone the three repos, point them at a
  fresh database, enable the sectors that vertical sells, whitelabel it and smoke-test it. Use
  when starting a new client-facing product (a medical-only SaaS, a restaurant-only SaaS), or
  when asked what a clone may change without breaking upstream merges.
---

# Cloning into a vertical product

Full procedure and the kernel "do not edit" list: **`docs/TEMPLATE.md`**. Read it — this skill is
the short path and the traps, not a replacement.

A clone stays **multi-tenant**: one deployment, many client businesses of that vertical. Enabling
one sector does not mean one customer.

## Steps

1. Clone `api`, `web`, `admin` side by side; rename `origin` → `upstream`, add your own `origin`.
2. Database — nothing shared with the template:

   ```sh
   docker run -d --name <vertical>-pg \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=<vertical> \
     -p 5433:5432 postgres:16-alpine
   ```

3. `.env` in each repo from `.env.example`. The clone-specific ones are `SECTORS_ENABLED`,
   `BRAND_NAME`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGINS`.
4. `bun run db:migrate`, then `db:seed:admin`, `db:seed:plans`, `db:seed:content`, and
   `db:seed:demo` if you want a demo business per enabled sector.
5. Whitelabel: the name in `src/i18n/{en,ne}/ui.json` → `brand`; colour in
   `web|admin/src/styles/brand.css`; marketing copy in the admin dashboard, not in code.

## Rules

- **Disable a sector by config, never by deleting its folder.** `SECTORS_ENABLED=medical` already
  means the other sectors' modules are not mounted, their routes do not exist and their plans are
  not seeded. Deleting folders buys nothing and guarantees a conflict on every upstream release.
- `CORS_ORIGINS` also drives Better Auth's `trustedOrigins`. Every origin the frontends are served
  from must be listed, or sign-in fails with `INVALID_ORIGIN` on the clone's real domain.
- `CONTENT_PREVIEW_SECRET` and `WEB_REVALIDATE_SECRET` must match across all three repos.
- A clone owns its `.env`, `brand.css`, the `brand` i18n block, CMS content, and anything under
  `src/sectors/<its-own>/`, `src/modules/<its-own>/`, `web/src/features/<its-own>/`. Everything
  else is kernel — change it upstream and merge down (`template-sync`).
- Don't rebase a clone onto upstream. Merge. The divergence is the product.

## Verify

```sh
SECTORS_ENABLED=<yours> bun run start   # other sectors' routes must 404
```

Then by hand: sign in, create a business, add a product, ring up a sale, confirm the invoice number
is gapless in its fiscal-year series, issue a credit note, record a purchase bill, issue a debit
note, download the purchase register. Per role: an owner sees the full nav, a cashier sees
`[pos, invoices]` and gets 403 on suppliers, a chef sees `[kitchen]` only.
