# Multi-Sector Billing SaaS — System Design

Consolidated, implementation-grounded system design. This supersedes the three original design docs (`multi-sector-billing-system-design.html`, `sector-feature-spec.html`, `offline-sync-architecture.html`) by reconciling their proposals against this repo's actual architecture (Turborepo, NestJS + Drizzle + Better Auth, Next.js admin/web, Expo mobile) and against real Nepal billing-software/IRD requirements researched separately. Where this doc and the original HTML docs disagree, this doc is authoritative — the HTML docs remain as the original product vision, this is the as-buildable version.

Build sequencing lives separately in `docs/plans/2026-08-14-billing-phase{1..5}-*.md`. This document describes *what the system is*; the phase docs describe *in what order it gets built*.

---

## 1. Product model

One account can own several businesses across different sectors (mart, medical, restaurant), each with its own subscription, billed independently, with a shared payment wallet at the account level — the same relationship a Google Account has to Workspace/Cloud billing.

```
Account (person/owner identity, one login)
  └─ owns → Business (mart | medical | restaurant)   ← the tenant
       ├─ has → Subscription (plan + billing cycle, per business)
       ├─ has → Membership (staff: owner/manager/cashier/...)
       └─ funded by → Wallet (shared across all the account's businesses)
```

**Two billing planes, kept conceptually and schematically separate:**
- **Platform billing** — what a business owes *this SaaS* for its subscription (Phase 5).
- **Business billing** — what a business's own customers owe *it* (Phase 1, IRD/CBMS-compliant `business_invoices`).

They share invoicing-engine internals (numbering discipline, audit trail, no-hard-delete rule) but are distinct entities. Conflating them is the single easiest way to corrupt compliance-critical numbering.

---

## 2. "Business" = Better Auth `organization`

Rather than building a parallel tenancy system, a **Business is a Better Auth `organization`**, extended by a 1:1 satellite table (`businesses`) carrying sector/compliance fields Better Auth doesn't know about.

```
organization (Better Auth)  ←1:1→  businesses (app-owned satellite)
     id, name, slug, ...              id, organizationId (fk, unique),
                                       sector, legalName, panNumber,
member (Better Auth)                  vatRegistered, cbmsRequired,
     organizationId, userId, role     fiscalYearStartMonth, status
```

This reuses, for free: organization creation, staff invitations (`member`/`invitation` tables), role-based membership, and `session.activeOrganizationId` for business-switching. The alternative — a hand-rolled parallel tenancy/membership system — was rejected because it duplicates infrastructure Better Auth already provides correctly (see §9 for the specific API surface used).

**Why a satellite table instead of Better Auth's `additionalFields`**: sector, PAN, VAT status, and CBMS-compliance flags are domain concepts the auth layer shouldn't own, and a satellite table keeps `apps/api/src/auth/` free of billing-domain schema — consistent with this repo's existing convention that `apps/api/src/database/` is the single owner of all schema, auth included.

---

## 3. Roles and permissions

Better Auth's `organization` plugin ships a real access-control system (`createAccessControl` + statements + roles), not just role strings. This system defines its own statements layered on Better Auth's defaults:

```
Statements = defaultStatements (organization/member/invitation/team/ac)
           + business:  [manage]
           + product:   [create, update, delete]
           + order:     [create, refund]
           + invoice:   [issue, print, credit-note]

Roles (per business/organization):
  owner       — all statements
  manager     — product + order + invoice (not business:manage)
  cashier     — order:create + invoice:issue/print
  pharmacist  — reserved now, activated in Phase 2 (medical)
  waiter      — reserved now, activated in Phase 3 (restaurant): order:create
  chef        — reserved now, activated in Phase 3 (restaurant): no statements (KOT-only, enforced by UI/route scoping)
```

Roles beyond Better Auth's defaults (`owner`/`admin`/`member`) are added once, upfront, covering all three sectors' eventual needs — this avoids a second `db:generate` regeneration cycle when Phase 2/3 land. Permission checks always go through Better Auth's own `hasPermission` (server, authoritative) / `checkRolePermission` (client, local/UI-only) — never a hand-rolled `member.role === 'x'` string comparison.

**Passing `roles` replaces Better Auth's `defaultRoles` — it does not merge with them** (`hasPermission` evaluates `{ ...options.roles || defaultRoles }`). So `admin` and `member` are re-exported explicitly alongside the custom roles, and `owner` re-declares the default `organization`/`member`/`invitation`/`team`/`ac` statements on top of the domain ones. Omitting them would leave a business owner unable to invite staff, silently breaking the invitation flow this design depends on. See §12.

**Platform-level admin** (Better Auth's `admin()` plugin, `user.role`) is a separate axis from business membership — it's the SaaS operator's own team managing the platform (businesses, plan catalog), not a business's staff.

---

## 3.5 Super admin — platform-wide control, separate from any business

Every business has its own `owner`/`manager`/etc. roles (§3), but those are **scoped to one organization** — an owner of Business A has zero visibility into Business B. A super admin needs to see and act across *all* businesses, all accounts, all subscriptions — a different axis entirely, not "owner of everything" (which Better Auth's org model has no concept of and shouldn't).

**This is Better Auth's `admin()` plugin (already installed in `auth.config.ts`), extended — not a parallel system built from scratch.** The plugin already gives:

```
defaultStatements = {
  user:    [create, list, set-role, ban, impersonate, impersonate-admins,
            delete, set-password, set-email, get, update],
  session: [list, revoke, delete],
}
adminRoles: ["admin"]   -- which user.role values count as "admin" at all
```

This covers *user account* administration (ban a user, impersonate for support, force-reset a password) but knows nothing about businesses, subscriptions, or plans — those are this system's own domain, not Better Auth's. The super-admin design is therefore two layers working together:

```
Layer 1 — Better Auth admin() plugin (user/session control, built-in)
  user.role === 'admin' gates: ban/unban users, impersonate for support,
  force password/email changes, revoke sessions

Layer 2 — this system's own platform-statements (business/plan/subscription control, hand-built)
  Same createAccessControl pattern as §3, but a SEPARATE statement set scoped
  to platform concerns, not organization concerns:

  platformStatements = {
    ...adminDefaultStatements,     -- keep user/session control
    business:     [list-all, suspend, close, view-any],
    plan:         [create, update, archive],
    subscription: [assign, cancel, view-any],
    audit:        [view-all],       -- cross-tenant invoice_audit_log read
  }

  export const platformAc = createAccessControl(platformStatements);
  export const superAdminRole = platformAc.newRole({ ...all of the above });
```

Wired via the *same* `admin()` config already in `auth.config.ts` (`ac`, `roles: { admin: superAdminRole }`) — **not a second Better Auth plugin**, just extending the one already installed the same way §3 extended `organization()`. A super admin is simply a `user` with `role: 'admin'` whose admin-plugin role carries these platform statements, checked via the same `auth.api.hasPermission` mechanism as §4's guard chain — just against `platformStatements` instead of the organization's `Statements`.

**What a super admin can do that no business owner can:**
- List/search **every** business across every account (`GET /v1/businesses`, already scoped platform-operator-only in Phase 1's plan — this section makes the mechanism explicit rather than a bare `user.role === 'admin'` string check).
- Suspend or close any business (`businesses.status`), independent of that business's own owner — e.g. for a compliance violation or non-payment, without needing membership in that organization.
- Create/edit/archive the global `plans` catalog (already platform-operator-gated in Phase 1).
- Assign or cancel any business's subscription directly (support/billing-dispute resolution) without going through that business's own owner.
- Read `invoice_audit_log` across every business (compliance/support investigation) — a business owner can only read their own.
- Ban a user platform-wide, or impersonate a user for support purposes — both native to Better Auth's `admin()` plugin already.

**What a super admin explicitly does *not* get, by design**: automatic membership in every organization, or the ability to silently edit a business's own sales data (`products`/`orders`/`business_invoices`) as if they were that business's owner. Platform control is administrative (suspend, assign plans, read audit trails) — it is deliberately **not** the same as being a member of every business, which would blur the tenant-isolation boundary §8 depends on. If a super admin genuinely needs to act *as* a business (e.g. debugging a specific issue), that should go through an explicit, audited "support access" grant — not a standing global membership. Not designed in Phase 1 (no support-access-grant flow exists yet); flagged here so it isn't silently assumed away.

**Where this lives**: `apps/api/src/auth/access-control.ts` (already created per §3) gains a second export block for `platformStatements`/`platformAc`/`superAdminRole`, alongside the organization-scoped ones — one file, two independent statement sets, because platform admin and business roles are genuinely different authorization domains that happen to share the same underlying Better Auth mechanism. `apps/admin` is already scoped as the platform-operator UI (per the Phase 1 plan's "who uses apps/admin" decision) — this section is what makes that UI's authorization model concrete rather than an assumed `user.role === 'admin'` check with no defined permission granularity.

**Does the two-tier model (platform statements + per-business statements) scale?** Yes, by construction — neither permission check is aware of, or grows more expensive with, total tenant count. `hasPermission` for a business action evaluates the acting user's role *within the one organization in scope*; `hasPermission` for a platform action evaluates a flat, global `user.role`, independent of how many businesses exist. There's no "loop over all organizations" anywhere in either check. The actual scaling limits in this system are elsewhere: standard pagination/indexing on the platform-wide business list, the in-process entitlement cache's known multi-instance caveat (§4), and the intentionally serialized per-business `invoice_counters` lock (§6.1) — none of which are access-control problems. The Phase 1 plan's §2.5 has the full walkthrough. One explicit non-goal: a *scoped* platform admin (e.g. regional/partial admin) is a different, undesigned axis — `dynamicAccessControl` (§9, deferred) is the mechanism to reach for if that's ever needed, not a redesign of what's here.

---

## 4. Request-scoping: `X-Business-Id` and the guard chain

```
Request
  │
  ▼
[Global AuthGuard]           — resolves WHO: session.user (existing, unmodified)
  │
  ▼
[BusinessAccessGuard]        — resolves WHICH BUSINESS + membership
  │   reads X-Business-Id (or :businessId route param)
  │   businesses.organizationId → member lookup
  │   no membership → 404 (never 403 — don't leak existence)
  │
  ▼
[@RequirePermission(...)]    — resolves CAN THEY DO THIS
  │   calls Better Auth's auth.api.hasPermission against §3's statements
  │
  ▼
[EntitlementsService.hasFeature] — resolves DOES THEIR PLAN ALLOW THIS
      subscriptions ⋈ plans.featureFlags, status === 'active'
      in-process TTL cache (~30–60s), not Redis (nothing else in the
      stack needs Redis yet — adding it for one cheap join is premature)
```

Four independent, separately-testable questions, each answered by the layer that actually owns that knowledge — auth doesn't know about businesses, businesses doesn't know about plans, plans doesn't know about permissions. No layer reimplements what another already owns.

---

## 5. Sector extension strategy

Sector-specific product/order fields (mart's `unitType`/barcode, medical's `batches[]`/`schedule`, restaurant's `tableId`/modifiers) live in a `sectorData jsonb` column on the shared `products`/`orders` tables — not per-sector child tables.

```
products / orders (shared, sector-agnostic core columns)
  ...
  sectorData jsonb   -- validated at the service layer against a per-sector schema,
                        not enforced by Postgres
```

**Why jsonb over relational per-sector tables**: with only one sector (mart) implemented in Phase 1, there's no second data point to validate a relational split against — designing that split now would be guessing. jsonb also avoids a join on the checkout hot path. This is explicitly a **Phase 1 decision to revisit once Phase 2 (medical) exists**, particularly if `batches[]` querying (FEFO sorting, expiry filtering) proves painful as jsonb — batches may warrant promotion to a real child table at that point.

**Sector logic itself**: Phase 1 branches on `business.sector` directly inside `modules/orders/`, rather than building a formal `SectorPlugin` registry/interface. Service methods are deliberately named after the target interface's hook names (`beforeCreate`, `onLineItemAdd`, `beforeCheckout`, `invoiceLineBuilder`) so extracting a real plugin interface once a second sector exists is a mechanical lift, not a redesign. A plugin registry designed against one data point would likely guess the wrong abstraction boundary.

---

## 6. The invoicing engine (compliance-critical core)

This is the highest-risk, most safety-critical part of the system — shared by every sector, not sector-specific logic.

### 6.1 Gapless sequential numbering

Nepal's IRD requires invoice numbers to restart at 1 each fiscal year (Bikram Sambat) and never skip or repeat. The *only* mechanism that guarantees this under concurrent checkouts is a row-locked atomic update inside the same transaction as invoice creation:

```sql
-- one row per (business, fiscal year); the lock IS the safety guarantee
UPDATE invoice_counters
SET last_number = last_number + 1
WHERE business_id = $1 AND fiscal_year = $2
RETURNING last_number
-- ON CONFLICT DO UPDATE if the (business, fiscal_year) row doesn't exist yet
```

`COUNT(*) + 1` or any read-then-write pattern outside a lock races under concurrent checkouts and produces duplicates — this is the one place in the system where "probably fine" is not an acceptable engineering standard, since a duplicate or skipped invoice number is a real compliance violation with financial-audit consequences.

`IssueInvoiceService.issue(businessId, order, tx)` accepts the *caller's* transaction rather than opening its own, so it composes atomically with the checkout transaction (stock decrement + order insert + invoice issuance either all succeed or all roll back together).

### 6.2 No hard deletes, ever

`business_invoices` has no `DELETE` exposed at any layer. Corrections happen via a **credit note**: a new invoice row referencing the original (`creditNoteForInvoiceId`), drawing its own number from the same gapless counter. The register always shows every number ever issued — this is a legal requirement, not a style preference.

### 6.3 Print discipline

`printedCount` increments on every print; the client renders a "COPY" watermark once `printedCount > 1`. First print is authoritative, every reprint is visibly marked as such, and every print event is audit-logged.

### 6.4 Full audit trail

`invoice_audit_log` is append-only: `issued | printed | credit_note_issued | cbms_pushed | cbms_failed`, each row carrying the acting user and a timestamp. This is what makes a billing dispute or an IRD inspection answerable from the database instead of from institutional memory.

### 6.5 CBMS push — turnover/sector-gated, not universal

**This is the single largest correction to the original design docs**, from actual Nepal market research: real-time CBMS push to IRD is not something every business needs from day one. It's mandated above a turnover threshold (cited figures vary by source and by IRD notice revision — treat the exact number as needing live confirmation, not hardcoding) and for specific sectors regardless of turnover (e.g. a restaurant with a bar license). `businesses.cbmsRequired` is therefore an **explicit, operator-settable boolean**, not something computed purely from a revenue figure the system doesn't even track yet. `modules/orders/` only enqueues to `cbms_push_queue` when `cbmsRequired` is true — enqueueing unconditionally would either waste effort on businesses that don't need it, or worse, create a false sense that CBMS compliance is "handled" everywhere when the actual outbound IRD integration is still a stub pending API credentials (see §10).

### 6.6 Mandatory invoice fields (verified against IRD's published rules)

Every `business_invoices` row must be able to render: "Tax Invoice" heading (English/Nepali), seller name/address/PAN, sequential invoice number, date in **both BS and AD**, buyer name/address/PAN (mandatory above NPR 10,000), itemized goods/services with qty and rate, taxable subtotal, VAT at 13% shown as a separate line (not folded into the total), grand total in figures and words, and an authorized signature/seal field for printed copies.

### 6.7 Registers, not just invoices

IRD lets businesses skip maintaining physical purchase/sales registers (Kharid/Bikri Khata) *if* their software can export the equivalent — including **Annexure 13** in IRD's prescribed Excel format. This is a small addition on top of an invoicing engine that already has the data (`business_invoices`), and is the concrete thing that turns "we generate compliant invoices" into "you don't need paper registers anymore" — a real, marketed differentiator for competitors in this space.

---

## 7. Data model (Phase 1 scope)

```
businesses            1:1 satellite to Better Auth organization
plans                 global catalog (sector, key, priceCents, featureFlags jsonb)
subscriptions         business ⨯ plan, 1 active row per business this phase
products              tenant-scoped, sectorData jsonb
customers              tenant-scoped (the business's OWN customers)
orders / order_items   tenant-scoped, status is a superset state machine
                        (mart only ever uses placed→billed; restaurant's full
                        placed→confirmed→in_kitchen→preparing→ready→served→billed
                        is reserved now so Phase 3 doesn't need a migration)
invoice_counters       (business_id, fiscal_year) → last_number, row-locked
business_invoices      the compliance-critical invoice record
cbms_push_queue        retry queue, conditional on cbmsRequired
invoice_audit_log      append-only trail
```

Every tenant-scoped table indexes `business_id` **first** in its composite indexes — a repo-wide rule (not just this system's), enforced by code review since Postgres won't structurally enforce it. `order_items` denormalizes `business_id` (rather than requiring a join through `orders`) specifically so this rule can be honored without an extra join on the checkout hot path.

Deliberately **not** built in Phase 1: `platform_invoices`/`platform_invoice_lines`, `payment_methods`/wallet (Phase 5) — building them without the consuming logic (a payment gateway, a consolidation cron) risks schema drift before the real requirements are known.

---

## 8. Multi-tenancy enforcement

**Phase 1's enforcement is entirely application-layer**: every tenant-scoped query is filtered by `business_id`, either directly or via the repository pattern's base query shape. Postgres Row-Level Security (RLS) as a second line of defense is explicitly deferred — not because it's unimportant, but because app-layer scoping needs to be correct and tested first; RLS on top of broken app-layer scoping just adds a false sense of safety, and RLS on top of *correct* app-layer scoping is genuinely defense-in-depth worth adding once the base case is solid.

---

## 9. What's reused from Better Auth vs. hand-built

Verified against the installed `better-auth` package (not assumed from memory or possibly-stale skill examples — this repo cross-checked the skill's example code against the actual installed types and found real discrepancies, documented in the Phase 1 plan):

| Concern | Reused from Better Auth | Hand-built |
|---|---|---|
| Tenant identity | `organization` table, creation flow | `businesses` satellite table only |
| Staff membership | `member` table, roles | — |
| Staff onboarding | `inviteMember` + `sendInvitationEmail` | — |
| Role/permission model | `createAccessControl`, `ac`/`roles`, `hasPermission` | Business/product/order/invoice statements (domain-specific) |
| Org-creation → business-row atomicity | `organizationHooks.afterCreateOrganization` | The `businesses` insert itself, inside that hook |
| Owner-removal safety | Built-in (last owner can't be removed/demoted) | — |
| Business-switching | `session.activeOrganizationId` | — |
| Seat limits | `membershipLimit` (plan-aware function) | Wiring it to `plans.featureFlags.maxStaff` |
| Multi-branch (future) | `teams` sub-feature (not enabled yet) | — |
| Platform admin (ban, impersonate, sessions) | `admin()` plugin, `defaultStatements`, `adminRoles` | — |
| Platform admin over businesses/plans/subscriptions | `admin()` plugin's `ac`/`roles` extension mechanism (same pattern as `organization()`) | `platformStatements` (business/plan/subscription/audit — this system's own domain, §3.5) |

Two explicit **non-uses**, both deliberate: `dynamicAccessControl` (DB-driven custom roles) is skipped because Phase 1's full role set is known upfront and doesn't vary per business; `teams` is skipped because Phase 1 has no multi-location requirement, but is the designated future mechanism rather than inventing a parallel "branch" concept.

---

## 10. Explicit non-goals of Phase 1 (see phase docs for when they land)

- **Medical and restaurant sectors** — Phase 2, Phase 3. Mart is the only sector proven end-to-end first, deliberately, so the sector-branching approach in §5 has one real validated shape before a second sector tests whether it generalizes.
- **Offline sync** (mobile/desktop SQLite outbox, invoice-number leasing) — Phase 4. No sector has a mobile screen to sync yet; building sync infrastructure before there's anything to sync would be speculative.
- **Platform billing** (subscription charges, wallet, consolidated platform invoices) — Phase 5. Phase 1's `subscriptions` table carries the fields (`currentPeriodEnd`, `status`) a future billing cron will act on, but no gateway integration exists yet.
- **Real IRD CBMS integration** — the `cbms_push_queue` table and conditional enqueueing exist; the actual outbound polling worker that calls IRD's live API is stubbed/logged, pending IRD API credentials and — separately — the formal IRD software-approval process (a business/legal workstream, not an engineering task, that should start in parallel rather than after the engine ships).
- **Nepal server residency** — IRD rules require the central server (or an audit-log server, for foreign-hosted clouds) physically located in Nepal. This is a hosting/deployment decision outside this document's engineering scope, but needs resolving before production launch, not left implicit.
- **General ledger / double-entry accounting — a decided non-goal, not a backlog item.** `docs/gap-analysis.md` §4 item 5 asks for this to be an explicit decision rather than a silent absence, so: this is a billing/POS/inventory system, and it stops at the source documents. It produces what an accountant needs — sales and purchase registers, VAT in and out, TDS withheld, cost and margin — in formats built for export, and does not attempt chart of accounts, journals, trial balance or P&L. Every full-suite competitor bundles accounting, so this is a real positioning choice with a real cost: a business using this still needs a bookkeeper or separate ledger software. The alternative is worse — a half-built ledger is more dangerous than none, because people trust its numbers. If it is ever built it should be its own product decision with its own phase, not an extension of the invoicing engine.
- **Payroll — a decided non-goal.** The weakest fit of anything competitors bundle: nothing else in this system touches employment, hours, or statutory salary deductions, and `member`/roles model *access*, not employment. It would share almost no machinery with what exists.
- **Redis, Postgres RLS** — both are real hardening steps, deliberately sequenced after the simpler versions (in-process cache, app-layer scoping) are proven correct, not skipped outright.

---

## 11. Corrections applied vs. the original HTML design docs

For traceability — every place this document's guidance differs from `multi-sector-billing-system-design.html` / `sector-feature-spec.html`, and why:

1. **Payment gateway**: originals suggest Stripe/Razorpay; corrected to **eSewa/Khalti** (Nepal's actual dominant wallets, confirmed via competitor research) for Phase 5.
2. **CBMS push**: originals imply every invoice pushes to CBMS; corrected to **turnover/sector-gated**, via an explicit `cbmsRequired` flag rather than a universal assumption.
3. **IRD approval**: originals have no mention of a software-approval process; added as an explicit non-engineering prerequisite workstream.
4. **Server residency**: originals have no deployment/hosting discussion; added as an explicit open decision, since Nepal e-billing rules constrain it directly.
5. **Access control**: originals describe a generic "RBAC via memberships.role" without specifying mechanism; this doc specifies Better Auth's actual `createAccessControl`/`hasPermission` API (verified against the installed package and official docs, not assumed).
6. **Business creation**: originals describe "create org, then create business row" without addressing atomicity; this doc specifies Better Auth's `organizationHooks.afterCreateOrganization` hook as the mechanism, avoiding a hand-built two-step saga.
7. **Annexure 13 / registers**: not mentioned in the originals; added since it's a low-cost, high-value addition once the invoicing engine exists, and is a real IRD-recognized way to eliminate physical registers.

---

## 12. Verified deltas from building Phase 1

Findings from implementing this design against the installed packages, recorded so the next phase does not rediscover them. Each was checked against `better-auth@1.6.29`'s own `dist/`, not assumed.

**Better Auth**

1. **`roles` replaces, never merges** (§3). Both `organization()` and `admin()` behave this way.
2. **Team-scoped roles do not exist.** `teamMember` is `{ id, teamId, userId, createdAt }` — no `role` column — and `hasPermission` accepts `organizationId` only, no `teamId`. Any future multi-branch or per-sector role scoping cannot lean on `teams` for *authorization*; teams can partition data, not permissions. This is the specific reason `docs/features.md`'s model was not adopted.
3. **`useMemoryCache` is not reachable from the HTTP endpoint.** `useMemoryCache` is a parameter of the internal `hasPermission` function, not of `auth.api.hasPermission`'s body, so §4's guard chain cannot pass it. Unimportant in practice — the cache is a module-level `Map` that, with `dynamicAccessControl` disabled, only ever holds the static role set.
4. **`@thallesp/nestjs-better-auth`'s `@MemberHasPermission()` is unusable here.** It resolves the organization from `session.activeOrganizationId`, not from §4's `X-Business-Id`. Organization-scoped checks therefore use a local `@RequirePermission()` guard that calls `auth.api.hasPermission` with the business's `organizationId` explicitly; platform-scoped checks do use the library's `@UserHasPermission()`, which is role-based and needs no organization.
5. **The org plugin has no cross-tenant list**, as §9 anticipated — confirmed, `GET /v1/businesses` is hand-built.

**Bikram Sambat dates** (§6.1, §6.6)

6. `nepali-date-converter` reads a JS `Date`'s **local** components. On a UTC-hosted server every instant from 18:15Z onward resolves to the previous Nepali day, which at a fiscal-year boundary files an invoice under the wrong year's sequence. The conversion is normalised to Nepal time (UTC+5:45, no DST) before use, with tests asserting identical results under UTC, Asia/Kathmandu and America/Los_Angeles.
7. That library covers **BS 2000–2090 only** (roughly AD 1943–2034) and throws outside it. Wrapped in an explicit `RangeError` so the limit surfaces legibly rather than as a library internal during checkout. Worth revisiting well before 2033.

**Schema and permissions, added beyond §7**

8. **`business: ['set-compliance']`** added to `platformStatement`. §3.5's statement set has no verb covering "operator edits a business's `cbmsRequired`/`vatRegistered`", which the admin UI requires; reusing `suspend` would have been semantically wrong.
9. **A partial unique index** `subscriptions(business_id) WHERE status <> 'canceled'` makes §7's "1 active row per business" a real constraint rather than a convention, while retaining canceled rows as history.
10. **`products(business_id, sku)` is unique**, not just indexed. NULL skus stay distinct in Postgres, so unbarcoded products are unaffected.
11. **VAT is derived from `businesses.vatRegistered`**, not per product — §7's `products` has no vatability flag. A VAT-registered business charges 13% on every line. `docs/features.md` §2 wants a per-product `isVatable`; adding it is a schema change, not a service tweak.
12. **Buyer PAN is enforced above NPR 10,000** at checkout for VAT-registered businesses, per §6.6. This rejects the order *inside* the transaction, so stock is never decremented for an invoice that cannot legally be issued.

**Still not verified**

13. Nothing has been exercised against a live database. The concurrent-numbering stress test (§6.1's entire safety argument) is written and skips unless `TEST_DATABASE_URL` is set. Until it has run, gapless numbering is a design claim, not a demonstrated property.

---

## Related documents

- `docs/plans/2026-08-14-billing-phase1-foundation-mart.md` — Phase 1 build plan (**built**; see §12 for deltas found while implementing it).
- `docs/plans/2026-08-14-billing-phase2-medical-sector.md` / `-phase3-restaurant-sector.md` / `-phase4-offline-sync.md` / `-phase5-platform-billing.md` — later-phase outlines.
- `docs/features.md` — later product-feature pass. **Superseded on tenancy**: it models sector-as-subscription, which this system does not implement (§12.2). Its purchase cycle, stock movements, and credit/debit notes are still the target feature set and remain unbuilt in every phase.
- `docs/gap-analysis.md` — competitor comparison; a planning input, not a spec.
- `multi-sector-billing-system-design.html`, `sector-feature-spec.html`, `offline-sync-architecture.html` — original product-vision docs (superseded where they conflict with this document, per §11).
