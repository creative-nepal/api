# Multi-Sector Template Platform — Sector Kernel, Clone-per-Vertical, Remaining Features

**Date:** 2026-09-02
**Spans:** `api/`, `web/`, `admin/` (three sibling repos; each change lands as separate PRs per repo)
**Status:** Phases A–F **built and verified**, plus two rounds of per-sector depth (§13).

---

## 1. Context

### Why

The platform was one product: a multi-tenant, multi-sector billing SaaS for `mart`, `medical` and
`restaurant`, with tenancy on Better Auth organizations, an IRD/CBMS-compliant invoicing engine,
purchasing with TDS, platform billing, offline sync, a CMS and en/ne i18n.

The goal is to turn it into a **template**: an upstream repo set that gets **cloned per vertical**
(a medical SaaS, a restaurant SaaS, …), where each clone stays multi-tenant for its own clients,
enables only the sectors that vertical sells — **by config, not code deletion**, so upstream merges
stay clean — and grows new domain features by extending a documented plugin seam.

### Decisions taken with the owner (2026-09-02)

1. **Clone model: pure template repo.** Each vertical is a git clone with the template as
   `upstream`. Unused sectors are disabled by config.
2. **New sector: a generic `services` vertical** (appointments/memberships/service invoicing) —
   built *after* the mechanism is proven by porting the three existing sectors onto it.
3. **Include the open gaps:** multi-branch (Better Auth `teams`) and purchase-side debit notes.
4. **Accounting/payroll stay non-goals** (recorded in `system-design.md` §10).

Three later instructions shaped the built work: sorting/filtering/pagination must be server-side;
content, menus and access must be server-driven; verify everything against a local Docker Postgres.

---

## 2. Target operating model

```
template (upstream, this repo set)
 ├── kernel (sector-agnostic): auth, tenancy, entitlements, platform billing,
 │    invoicing engine, purchasing, sync, CMS, i18n, workspace, admin panel
 ├── sector plugins: mart | medical | restaurant | services
 └── clone playbook + scaffolding skills

clone: "MediBill"                          clone: "RestroNep"
 SECTORS_ENABLED=medical                    SECTORS_ENABLED=restaurant
 BRAND_* + CMS content + plan seed          ...
 tenants: pharmacy A, clinic B              tenants: cafe X, hotel Y
 git remote upstream = template             git remote upstream = template
```

**Invariant:** a clone never edits kernel files except through upstream; vertical work happens in
its sector plugin(s), config and seeds. That is what keeps `git merge upstream/main` cheap.

---

## 3. Phase A — Sector registry ✅ BUILT

The seam everything else stands on. Sector knowledge moved out of scattered conditionals.

**`api/src/database/schema/sector-keys.ts`** — the one place sector keys are declared. Kept
dependency-free: both the Drizzle schema (loaded by drizzle-kit, which must never pull in Nest) and
the registry import it. `billing.ts` now re-exports `SECTORS`/`Sector` from here, so every existing
importer is unchanged.

**`api/src/sectors/<key>/`** — three files per sector, split by what can load what:

| File | Contains | Importable without |
|---|---|---|
| `meta.ts` | display key, role names, nav items, plan feature keys | Nest **and** better-auth → unit-testable, and what `GET /v1/platform/sectors` serves |
| `access.ts` | statements + roles the sector contributes to `auth/access-control.ts` | Nest |
| `sector.ts` | the Nest modules the sector mounts | — |

`catalog.ts` composes the metas and parses `SECTORS_ENABLED`; `registry.ts` joins metas to modules.
`AppModule` mounts `...enabledSectorModules()`. An unknown key in `SECTORS_ENABLED` **fails the
boot** rather than silently mounting everything (also validated in `config/env.schema.ts`).

`auth/access-control.ts` now composes kernel statements + each sector's contributions instead of
listing pharmacist/waiter/chef inline. Statements for **every** sector always compile in regardless
of `SECTORS_ENABLED` — Better Auth's `roles` option *replaces* its defaults, so the vocabulary must
stay stable. Enablement gates modules and routes, never the permission vocabulary.

**Core/HTTP module split.** `PurchasingModule` imported `BatchesModule` for its repository, which
dragged batch *controllers* into mart. Modules other modules depend on are now split
`<name>-core.module.ts` (providers only) from `<name>.module.ts` (adds controllers):
`ProductsCoreModule`/`ProductsModule`, `BatchesCoreModule`/`BatchesModule`.

**`@RequireSector`** (`common/guards/require-sector.guard.ts`) — sector-only controllers declare
their sector; a business of another sector gets a translated 403 instead of an ad-hoc service check.

Verified: booted against every `SECTORS_ENABLED` value and diffed the registered route table.

| `SECTORS_ENABLED` | routes | batch routes |
|---|---|---|
| unset (all) | 118 | 5 |
| `medical` | 99 | 5 |
| `restaurant` | 110 | 0 |
| `mart` | 91 | 0 |

Live: a mart business calling `/kitchen/tickets` → `403 This feature is not available for a Mart
business`; the restaurant business → `200 []`.

---

## 4. Server-driven content, menus and access ✅ BUILT

The web workspace built its sidebar from a hardcoded `nav-items.ts` filtered by sector only, so a
cashier saw Staff and Settings links they could not use. Worse, `usePermission` read
`session.user.role` — the **platform** admin role, a different axis from business membership — and
returned `true` when it was absent, i.e. it granted everything by default. It was unused, which is
the only reason nothing was broken.

**`api/src/modules/workspace/`** — `GET /v1/businesses/:id/workspace` returns the business, the
membership role, that role's **effective permissions**, and the sector-scoped,
permission-filtered navigation. Nav items are declared per sector in `sectors/<key>/meta.ts` plus a
kernel list in `sectors/nav.ts`, each carrying the permission it requires. The pure resolution logic
is in `workspace-access.ts` (no Nest import) and is unit-tested directly.

Web now renders the sidebar from that response and `usePermission` reads the server's permission
map. `nav-items.ts` is deleted.

Admin's sector list came from a hardcoded `["mart","medical","restaurant"]` enum and a
`SECTOR_LABELS` map of hardcoded English (bypassing i18n). Both are replaced by
`features/sectors/` reading `GET /v1/platform/sectors`, with `useSectorOptions()` /
`useSectorLabel()` translating through the catalogue. A clone's admin now shows exactly the sectors
its API enables, with no frontend change.

**Authorization gap found and closed.** Every business-scoped **write** was gated but nearly every
**read** was open to any member. A chef could read suppliers, purchase bills, the Kharid Khata
purchase register and the TDS return — supplier PANs, cost and margin data — plus the invoice
register and audit log, the controlled-substances register, and restaurant revenue analytics.
Now gated:

| Endpoint | Gate |
|---|---|
| purchasing reads (suppliers, POs, bills, register, TDS return) | `product: ['update']` |
| `medical/controlled-register` | `dispense: ['controlled']` |
| `medical/insurance-claims` | `invoice: ['print']` |
| `medical/reports/batch-wise` | `product: ['update']` |
| `restaurant/analytics` | `product: ['update']` |
| `stock-adjustments` (read) | `product: ['update']` |
| `invoices` list/detail/registers/audit-log | `invoice: ['print']` |

Deliberately left open to any member: products, menu, tables, orders, batches, entitlements, sync
and workspace — a cashier and a waiter need these to do their job.

Verified live with real roles: chef → 403 on suppliers/register/analytics/invoices, 200 on kitchen
and workspace, nav `[kitchen]`. Cashier → 200 on products/orders/invoices, 403 on
suppliers/stock-adjustments, nav `[pos, invoices]`. Nav and enforcement agree.

**`trustedOrigins` made config-driven.** `auth.config.ts` hardcoded `localhost:3000/3001` while CORS
was env-driven — a clone on its own domain would have had sign-in rejected. It now derives from
`CORS_ORIGINS`.

---

## 5. Server-side sorting, filtering, pagination ✅ BUILT

The frontends were already correct: `DataTable` hardcodes `manualSorting`/`manualFiltering`/
`manualPagination` and wires no client row models, and no view sorts or filters fetched rows itself.

The gaps were in the API — endpoints that paginated without returning a `total` (so a client cannot
render a pager) or without a stable `ORDER BY`:

- **`users`** — the documented reference module — had no `ORDER BY` at all. Offset pagination over
  an unordered query can repeat and skip rows. Now `PaginatedResult`, sortable via the existing
  `resolveOrderBy`/`SORTABLE` pattern, with an `ilike` search over name and email.
- **`subscriptions` history** and **`platform-billing` user invoices** — now return `total`; the
  latter previously fetched a user's entire invoice history unbounded.

Swept every paginated query: all now have a stable `ORDER BY`.

---

## 6. Phase E — Debit notes ✅ BUILT

Completed `features.md` §6 — credit notes existed, debit notes did not.

Schema (`schema/purchasing.ts`): `debit_notes`, `debit_note_items`, `debit_note_counters`, with a
per-business-per-series gapless counter using the same atomic `INSERT … ON CONFLICT DO UPDATE …
RETURNING` as `invoice_counters`, and a BS fiscal-year series from the existing `fiscalYearLabel`.
`STOCK_ADJUSTMENT_REASONS` gains `debit_note`. Migration `drizzle/0003_lame_starfox.sql` is
additive-only.

`DebitNotesService` issues against a bill, caps the cumulative total at the bill total, optionally
destocks (writing `stock_adjustments` rows), and **never** recomputes weighted-average cost — the
recorded rule. The purchase register nets debit notes as negative rows; the TDS return stays
bill-based on purpose, since TDS already deducted and filed for a period is not retroactively
changed by a later purchase return.

Web: a Debit notes tab and an issue dialog on each bill.

Verified live: bill ₹70,000 + ₹9,100 VAT → debit note `2083-84-1` for 10 units with restock →
stock `-10`, ledger row `debit_note -10.000 'Debit note 2083-84-1'`; over-debit rejected
(`7119000 remains, 99000000 requested`); restock without a product rejected; second note numbered
`2083-84-2`; register shows the note as a negative row.

---

## 7. Phase B — Template-ization & clone playbook ✅ BUILT

**Whitelabel.** Every brand string is out of the code. `BRAND_NAME` drives transactional email
(`email/brand.ts`, consumed by the service, the layout and all three templates) and the CMS/plan
seeds. The name the *frontends* render was already an i18n key (`ui.brand.*`) served over HTTP, so
renaming a clone needs no frontend release. Theme tokens live in a new per-repo
`src/styles/brand.css`, imported after the shared design system from `src/app/globals.css` — the
shared `styles/globals.css` stays byte-identical across web and admin and keeps passing
`sync-ui.sh diff`.

**Seeds are sector-scoped.** `db:seed:plans` seeds only `SECTORS_ENABLED` — and gained the
**restaurant plans that never existed**, so a restaurant clone would previously have booted with
no plans at all. New `db:seed:demo` creates one demo business per enabled sector, with a
subscription and a catalogue (service items for `services`, products elsewhere).

**`docs/TEMPLATE.md`** — the playbook: what a clone owns vs. must not edit, stand-up, whitelabel,
adding a sector, the upstream merge order (api → web → admin) with the conflicts to expect, and a
regression pass.

**Verified by actually doing it:** stood up a `MediBill` clone on its own database with
`SECTORS_ENABLED=medical`, migrated, seeded, and booted it on :3344. Its CMS pages read
"MediBill", it seeded 2 medical plans and no others, `GET /platform/sectors` returned `[medical]`,
medical routes answered 200 and every restaurant route 404'd. The template database was untouched
throughout. Clone torn down afterwards.

**Two bugs this surfaced and fixed:**

- `getActiveEntitlement` matched `status = 'active'` only, so a **trialing** business had no
  entitlement — meaning *unlimited* products and invoices (limits silently skipped) while
  plan-gated features were *denied*. Trials now carry their plan's limits and features;
  `past_due` stays excluded on purpose, since dunning should suspend entitlement.
- `auth:generate` (Better Auth CLI) overwrote `schema/auth.ts`, dropping the `account.issuer`
  column and the hand-added `User`/`Member` row types. Both restored; `db:generate` then reports
  no drift. Worth knowing before the next regeneration.

## 8. Phase C — `services` sector ✅ BUILT

The first vertical built *on* the seam, and the proof it works for a non-inventory business.

`schema/services.ts`: `service_items` (no stock, has a duration), `service_memberships`
(pre-paid session packages), `service_appointments`. Modules `services/` (catalogue +
memberships) and `appointments/`, both `@RequireSector('services')` with every route —
reads included — permission-gated. Roles `receptionist` (books and bills) and `practitioner`
(completes own appointments) come from `sectors/services/access.ts`, not from editing
`access-control.ts`.

**Selling reuses the existing engine.** A `ServicesSectorPlugin` joins the orders sector-plugin
registry, so a service is checked out through the same order → invoice path as a mart sale:
same counters, same audit trail, same credit-note rules. `order_items` gained a `service_item_id`
alongside the existing `menu_item_id`. No parallel invoicing.

Adding the sector was, end to end: one key in `sector-keys.ts`, three files under
`sectors/services/`, a schema file, two modules, a checkout plugin, i18n in both catalogues, and
two web feature slices. The type checker enumerated every registration point that was still
missing — the seam is self-enforcing.

**Verified live:** demo services business boots with nav
`[appointments, services, pos, purchasing, invoices, staff, settings]` and plan *Services Basic*
(`maxAppointmentsPerMonth: 400`); an appointment books and completes, and completing it twice is
refused with a translated 409; a 3-session membership consumes exactly three, auto-flips to
`exhausted`, refuses the fourth, and the refused appointment **rolled back to `booked`** rather
than being left completed; a service checks out to a gapless invoice (`2083-84` #1, #2, #3) with
13% VAT and `order_items` rows carrying `service_item_id` and no phantom `product_id`. Cross-sector
isolation holds both ways: a mart business gets 403 on `/services`, a services business 403 on
`/kitchen`, and under `SECTORS_ENABLED=services` the batch and kitchen routes 404 entirely.

## 9. Phase D — Multi-branch ✅ BUILT

The oldest open gap. A **branch is a Better Auth `team`** (the plugin is now enabled) plus a
`branches` satellite carrying name, invoice-series `code`, address and the default flag.
`teamMember` has **no `role` column**, exactly as `features.md` recorded — so a branch is
*scoping*, not a role. No branch-role system was hand-rolled.

**The series is (business, branch, fiscal year).** `invoice_counters` is keyed on all three;
`business_invoices` is unique on all four including the number. Two branches can each hold
invoice #1. Requests select a branch with `X-Branch-Id`, resolved by `BranchScopeGuard` into
`@CurrentBranch()`, falling back to the business's default — which is created with every business
in `organization-hooks.ts`, since invoicing resolves a branch on every issue and has nowhere else
to fall back to. A **credit note is always drawn from the series of the invoice it corrects**,
never the caller's current branch.

**The migration was the risk, and it is provably a no-op.** `0005` adds every `branch_id` column
nullable, backfills one `Main` branch per business (NULL `code`, so existing printed numbers keep
their exact unprefixed form), moves existing invoices, counters, leases, orders and tables onto
it, and only then sets NOT NULL and swaps the unique index — drizzle-kit's generated
`ADD COLUMN ... NOT NULL` would have failed outright on populated tables. `0006` seeds
`product_branch_stock` from the pre-existing totals. Verified against a database holding two live
invoice series: `diff` of `(business, fiscal_year, count, min, max)` before and after is **empty**,
counters identical, zero orphans, no schema drift.

**Stock** lives in `product_branch_stock` per branch with `products.stockQty` as the cached
business-wide total. The branch row carries the sufficiency check in its own WHERE clause and is
decremented first, so the cache can never authorize a sale and two tills at one branch cannot both
sell the last unit. Goods receipt and stock adjustments credit the receiving branch.

**Reporting** takes an optional `branchId` on the invoice list and the Annexure-13 sales register;
omitting it gives the consolidated view.

**The concurrency spec now actually runs.** It was `describe.skip` without `TEST_DATABASE_URL`;
against the real database all 49 tests pass, including 20 parallel transactions per branch
producing gapless independent series, and the cross-branch same-number case.

Verified live: a second branch `LTP` opened on a business whose Main series was at 5 — the new
branch numbered 1, 2, 3 while Main continued 6, 7; consolidated list 10 = 7 + 3; a credit note
against a Lalitpur invoice landed at Lalitpur #4 despite a Main header; a foreign business's
branch id returns 404; selling at a branch with no stock is refused while the other branch sells;
after a transfer the shelves reconcile (8 + 28 = 36 cached total). A cashier can list branches
(the switcher needs them) but cannot open one, and `branches` is absent from their nav.

Web gained a branch switcher (hidden for single-branch businesses), a branches screen, and an
`X-Branch-Id` header on the API client; admin gained a Branches tab on business detail, served by
a platform-scoped endpoint since a platform operator is not a member of the businesses they
support.

**One more hardcoded-label fix:** web's `SECTOR_LABELS` bypassed i18n exactly as admin's did, and
had no entry for `services`. Both now read `common.sector.*` from the catalogue.

## 10. Phase F — Skills ✅ BUILT

Three new skills in `api/.claude/skills/`, written from what the work actually required rather
than from the plan:

- **`new-sector`** — the plugin seam end to end, led by the import-boundary table (`meta.ts` free
  of Nest *and* better-auth, `sector-keys.ts` free of everything) since getting that split wrong
  is the only real trap. Carries the `auth:generate` warning below.
- **`clone-vertical`** — the short path through `docs/TEMPLATE.md` plus the traps: disable a
  sector by config not deletion, `CORS_ORIGINS` also drives `trustedOrigins`, merge don't rebase.
- **`template-sync`** — merge order api → web → admin, a conflict-meaning table, and the rule that
  a late backfill is a *new* migration, never an edit to an applied one.

Updated where this work invalidated them: `nest-module` (the four-guard stack and its load-bearing
order; **every** business-scoped route needs `@RequirePermission`, reads included; the core/HTTP
module split), `drizzle-schema-change` (the three-phase NOT NULL-on-populated-table procedure, the
compliance-critical before/after diff, cached totals), `i18n-catalogue` and both `feature-module`s
(nav, permissions and sector labels all come from the server).

Every one of them records the `auth:generate` hazard: it rewrites `schema/auth.ts` wholesale, has
twice dropped `account.issuer` and the hand-added row types, and re-quotes the file so a
single-quote replacement silently no-ops. That bit me twice; it is now written down in three
places.

## 11. Public content is admin-driven ✅ BUILT

A late requirement: everything a visitor reads should be editable by an operator, not compiled in.

Already true: marketing pages are one CMS-rendered catch-all (no hand-written marketing routes),
header and footer navigation come from `content_navigation`, the brand name is an i18n key, and
the workspace nav and permissions come from `/workspace`.

Two gaps closed:

- **16 hardcoded user-visible strings** across POS, invoices, purchasing, products, tables and the
  auth screens — the repo's own "no hardcoded user-visible string" rule, quietly broken. All now
  i18n keys in both catalogues; the sweep now returns zero.
- **The pricing page was static copy while real prices lived in the admin plans screen**, so the
  two would drift. Added a `pricing` CMS block that renders the **live** catalogue, following the
  three-repo block contract in order (api schema + Zod → web renderer → admin editor), plus an
  anonymous `GET /v1/public/plans` returning active plans only, cached under the same `content`
  tag so a publish revalidates both. The block's sector picker is server-driven like the rest of
  admin. Verified by raising Mart Basic to Rs 1,299 in admin and seeing the public page follow.

## 12. Platform services — email, jobs, notifications ✅ BUILT

**Email was fire-and-forget.** `auth.config.ts` called Resend inline and discarded the promise, so
a Resend outage silently lost a password reset or a staff invitation with no record. Email is now
an outbox: `sendX()` writes to `email_outbox`, and the `email-outbox` job claims due rows with
`FOR UPDATE SKIP LOCKED` (two workers cannot take the same row), delivers, and retries with
exponential backoff to `maxAttempts` before dead-lettering. Failed messages are listed and
retryable from admin. Verified: a reset queued, drained and marked sent; a deliberately broken row
retried once then dead-lettered with its error preserved, and requeued from admin.

**Schedules are data, not decorators.** `@Cron` was hardcoded and only covered platform billing.
Jobs are now rows in `job_schedules`, registered at boot through Nest's `SchedulerRegistry`, so a
platform operator can change a cron expression or disable a job from admin and it takes effect
live. Invalid expressions are refused. Verified: `stock-alerts` moved to a 2-minute cadence and
fired on it; `platform-alerts` disabled and did not run.

Six jobs, each wrapped by `JobRunnerService` which records start, duration, outcome and detail to
`job_runs` — so a failure is visible rather than silent (it caught a real one: a
`current_date + $param` cast error in the expiry scan). `email-outbox`, `invoice-lease-expiry`
(the existing `expireStaleLeases` was written but never scheduled), `stock-alerts`,
`subscription-lifecycle` (trials never transitioned on their own), `notification-digest` and
`platform-alerts`.

**Notifications** are scoped to a business or to the platform operator, with per-user read state,
so one member dismissing a business-wide alert does not hide it from the rest. Every raise carries
a `dedupeKey`, so a daily rescan is a no-op rather than a flood — verified by rerunning the scan
and raising zero. Web gets a header bell with unread count; admin gets an operations console with
jobs, runs, the email queue and platform alerts.

**Clients manage their own staff.** The staff screen could only invite. It now lists members and
pending invitations, changes roles, removes members and revokes invitations — each action wrapped
in `<Can>` against `member:create/update/delete` and `invitation:cancel`, with the owner row
protected.

## 13. Sector depth — round 2 ✅ BUILT

Round 1 closed the structural gaps (registry, branches, services sector, clone playbook).
Round 2 closed the gaps a shop actually notices on day one. Every item is API + web, with
admin touched only where a platform operator needs to see it.

### 13.1 Discounts — kernel, all four sectors

A POS that cannot discount a sale is not a POS, so this landed as kernel billing rather than
per sector.

Discount reduces the taxable base **before** VAT — service charge applies to the discounted
subtotal, and VAT to that sum. Accepted per line and per order, as an amount or a percent
(never both). The order-level discount is apportioned down onto the lines at checkout, so
line discounts are the single source of truth and every downstream path inherits them,
including the restaurant split-bill.

Two guard rails, because a discount is revenue leaving the till:

- `businesses.max_discount_percent` caps the giveaway and **defaults to 0**, so discounts stay
  off until an owner opts in from Settings → Billing rules.
- `order:discount` is granted to owner and manager but **not cashier** — a cashier can sell but
  cannot self-approve a discount.

Three pre-existing defects surfaced while wiring it and are fixed here:

| Defect | Effect |
|---|---|
| `invoiceLineBuilder` never passed `serviceChargeCents` | any restaurant with a service charge issued an invoice whose total disagreed with the order |
| Sales register reported gross subtotal and omitted service charge | `taxableSales × 13%` did not reconcile against `vatAmount` |
| Credit notes ignored discount and service charge | refunded VAT that was never collected |

Invariant now holds for every VAT invoice in the database:
`vat = round((subtotal − discount + serviceCharge) × 0.13)` and
`total = subtotal − discount + serviceCharge + vat`.

### 13.2 Stock takes — mart, medical, restaurant

Opening a take snapshots current quantities: per branch for mart and restaurant, per batch for
medical, matching how each sector tracks stock. `services` is excluded by `RequireSector` — a
salon has no shelf to count.

The variance applies as `delta = counted − snapshot`, deliberately **not** "set stock to
counted". Those differ whenever a sale lands mid-count, and the delta is the correct one: the
counted figure was true at snapshot time, so movements since then legitimately apply on top.
Setting stock to the counted figure would silently erase every sale made while counting.

Variances are written through `StockAdjustmentsService`, so a count lands in the same ledger as
every other movement and the medical batch→product rollup stays consistent.

Two constraints live in the database rather than in a read-then-write check: a partial unique
index allows one open count per branch, and line uniqueness uses `NULLS NOT DISTINCT` so it
actually holds where `batch_id` is null.

`stocktake:open / count / complete` split so a client can hand counting to a stock clerk via a
custom role while the write-off decision stays with a manager.

### 13.3 Reservations — restaurant

Bookings can be taken without a table and assigned one at seating, which is how a host works.
Double-booking uses half-open interval overlap, so a booking ending exactly when another starts
is allowed. The window end is computed in SQL as
`reserved_for + make_interval(mins => duration_minutes)` rather than stored, so changing a
booking's length cannot leave a stale end. Party size is checked against the table's seats.

`booked → seated → completed`, with `no_show` and `cancelled` as alternative closes, enforced by
conditional UPDATEs so two concurrent seatings cannot both succeed. Seating flips the table to
`occupied`. A waiter may view/book/seat; cancelling loses business, so it stays with a manager.

### 13.4 Appointment reminders — services

An hourly job claims appointments due within 24 hours, emails the customer through the existing
outbox and raises an in-app notification.

The claim comes first — a conditional `UPDATE … RETURNING` stamps `reminder_sent_at` before any
email is enqueued, the same claim-then-work shape the outbox uses. Marking afterwards would
double-send everything in flight if the process died mid-run.

This needed `customers.email`, which did not exist: a customer record held a phone and a PAN but
no way to reach anyone by mail. It is now on create/update and searchable alongside name and
phone.

The job registers through `JobsRegistry`, so it appears in the admin operations screen with an
operator-editable schedule and **no admin-side change**.

### 13.5 Substitution and batch recall — medical

`genericName` was already stored on medical products and nothing ever read it — the field
existed, the lookup did not. Matching normalises case and whitespace, since
`Paracetamol 500mg` and `paracetamol 500MG ` are the same drug typed by two people. Each
alternative returns stock, price, manufacturer and earliest expiry.

Recall traces every dispense of a batch back to the customer's name, phone and email;
quarantine writes off the remainder under a new `recalled` adjustment reason and deactivates the
batch, taking it out of FEFO. The dispense history deliberately survives quarantine — writing
off the stock is the easy half, the shop still has to ring the people who already have it.

`recall:view` vs `recall:quarantine` splits looking up buyers from writing off stock.

---

## 14. Remaining phases

None. All phases are built.

**Order:** B ✅ → C ✅ → E ✅ → D ✅, then sector depth round 1 ✅ and round 2 ✅. D was taken
before the depth rounds because its migration touches compliance-critical numbering.

---

## 15. Non-goals (unchanged)

Accounting (GL/double-entry) and payroll stay out per `system-design.md` §10. Also out:
org-level bundled subscriptions, FIFO/LIFO costing, multi-warehouse within a branch, and
re-merging the three repos into a monorepo.

---

## 16. Local environment

Postgres runs in Docker (the local server's `nabin` role has no CREATEDB):

```sh
docker run -d --name creativenepal-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=creative_nepal \
  -p 5433:5432 postgres:16-alpine
```

`api/.env` points at `postgresql://postgres:postgres@localhost:5433/creative_nepal`. Then
`bun run db:migrate`, `db:seed:admin`, `db:seed:plans`, `db:seed:content`.
Admin login: `admin@creativenepal.test` / `Admin12345!`.

Ports: API 3333, admin 3001, web **3002** (3000 was occupied by an unrelated app, so
`CORS_ORIGINS` includes 3002 locally).

## 17. Verification

```sh
# api
bun run check-types && bun run lint && bun run test
node .claude/skills/i18n-catalogue/scripts/check-parity.mjs
SECTORS_ENABLED=medical bun run start   # restaurant routes must 404

# web, admin
bun run check-types && bun run lint
cd web && ./scripts/sync-ui.sh diff     # shared design system must not drift
```

All green as of 2026-09-03: api **57 tests passing** (8 more skip without `TEST_DATABASE_URL`),
three repos type-clean and lint-clean, i18n catalogues key-for-key identical (common 68,
errors 109, ui 718), no shared-UI drift, no schema drift.

Route tables per `SECTORS_ENABLED` after round 2 — the check that a sector only mounts what it
should:

| `SECTORS_ENABLED` | routes | of which stock-take |
|---|---|---|
| `mart` | 134 | 6 |
| `medical` | 147 | 6 |
| `restaurant` | 163 | 6 |
| `services` | 118 | 0 |
| all four | 189 | 6 |

Run the numbering integration suite against a real database — it is the one that guards the
compliance-critical invariant:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/creative_nepal bun run test
```
