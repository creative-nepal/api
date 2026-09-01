# Multi-Sector Billing SaaS — Phase 1: Foundation & Mart

> [!NOTE]
> **Status: built (steps 1–9), not yet exercised against a database.**
> `check-types`, `lint` and the Jest suite pass; the NestJS app boots with all
> routes mapped and `apps/admin` builds. Corrections found while implementing
> are recorded in `docs/system-design.md` §12 — read that alongside this plan,
> since a few snippets below were wrong as written (§2's `ownerRole` in
> particular). See the Verification section for what has and has not been run.

## Context

First implementable slice of the Multi-Sector Billing SaaS described in `docs/multi-sector-billing-system-design.html`, `docs/sector-feature-spec.html`, and `docs/offline-sync-architecture.html`. This phase proves the tenancy/subscription/entitlement/invoicing architecture end-to-end for one sector (mart), with a platform-operator admin UI slice.

None of this exists in the repo yet — `apps/api/src/database/schema` currently only has Better Auth's own tables (`user`, `session`, `account`, `organization`, `member`, `invitation`, etc.), and `apps/api/src/modules` has only a `users` module.

Implements: `multi-sector-billing-system-design.html` §02–§09 (architecture, concepts, modules, data model, tenancy, billing, API, security) scoped to what mart needs; `sector-feature-spec.html` §compliance + all §mart-* sections in full. Medical, restaurant, offline sync, and platform-level billing consolidation are out of scope for this phase — see the sibling phase docs in this directory (`2026-08-14-billing-phase2-medical-sector.md`, `-phase3-restaurant-sector.md`, `-phase4-offline-sync.md`, `-phase5-platform-billing.md`).

Key decisions made with the user up front (apply across all phases):
- **"Business" = Better Auth `organization`**, extended via a 1:1 satellite table — reuses org creation, `member` roles, `invitation`, and `session.activeOrganizationId` for free instead of building parallel tenancy plumbing.
- **Foundation first**: this phase = schema + businesses/plans/subscriptions/entitlements + mart end-to-end + a thin platform-operator admin UI. Not all 3 sectors.
- **Offline sync excluded**: mobile has no sector screens to sync yet; that's its own later phase once a sector has a mobile surface.

## Nepal market research findings (corrections to the original design docs)

Researched existing Nepal billing/POS providers (RestroX, Hamro SAN, Pharma Care, TMBill, Restronp, OneFlow, Tigg, BUSY Software Nepal) and IRD's actual published rules to check the design docs' compliance assumptions against reality. Several corrections and gaps surfaced that change Phase 1's scope and priorities:

1. **CBMS real-time push is not universal — it's turnover-gated.** The design docs (and the original Phase 1 draft) treat CBMS sync as something every business needs from day one. In practice, IRD's real-time CBMS mandate applies only above a turnover threshold (sources vary — figures cited include Rs 10 crore generally / Rs 5 crore for hospitality, with an earlier Rs 25 crore threshold from a 2023 mandate expansion — so treat the exact cutoff as needing confirmation against IRD's current notice, not the schema). Below threshold, a business still needs **IRD-approved billing software** generating compliant VAT invoices, but not necessarily live CBMS push. **Correction to §1/§3**: `businesses` needs a `cbmsRequired` (or equivalent) flag, defaulted off, so `cbms_push_queue` enqueueing in `modules/orders/` becomes conditional rather than unconditional. Getting this wrong either over-builds (pointless queue churn for small shops) or under-builds (a fast-growing business silently out of compliance once it crosses the threshold with no alert).

2. **IRD software approval is a real prerequisite, not a technical afterthought.** IRD requires a formal application (application letter, documented software modules/reports/format, sample invoices printed and digital, screenshots/video of the billing flow, business registration certs, and reportedly source code/access on request) before software can legally be used for VAT billing. RestroX and competitors market "IRD Approved Billing" as a headline trust signal — this is a go-to-market gate, not just a nice-to-have. **Addition**: this should be tracked as an explicit business/legal workstream parallel to Phase 1 engineering, ideally started early since approval timelines aren't instant — not something to discover after the invoicing engine is built. Not an engineering task, but worth a line item so it isn't missed.

3. **Server residency requirement affects deployment, which Phase 1 currently has zero section on.** Nepal e-billing rules require the central server to be located inside Nepal (or, for foreign-hosted cloud, a separate audit-log server physically in Nepal recording every invoice event), with IRD able to request access. This has zero mention anywhere in the current plan set and directly constrains hosting choice for `apps/api`/Postgres — deploying to a generic international cloud region without a Nepal-based audit log would itself be a compliance gap regardless of how correct the invoicing logic is. **Addition**: flag hosting/deployment as a decision to make explicitly before or alongside Phase 1, not default to "wherever's convenient."

4. **Real invoice-numbering guidance confirms the schema's approach but adds a branch dimension.** IRD requires sequential numbering restarting at 1 per fiscal year (matches `invoice_counters`' design already) and recommends "a logical prefix for years and branches" in the number format. Phase 1's schema has no branch/location concept — single location per business is an *implicit* assumption, never stated as a scoping decision. **Addition to §7 (deferred)**: multi-branch/multi-location per business (naturally: Better Auth's `teams` sub-feature, already flagged in §7 as the future mechanism) should explicitly note it also affects invoice-numbering prefix design when it lands, so Phase 2+/branch work doesn't have to retrofit the numbering scheme.

5. **Local payment methods, not Stripe/Razorpay.** The original design doc's tech-stack section suggests Stripe/Razorpay for payments — neither is relevant in Nepal. Every competitor surfaced in research (RestroX, others) integrates **eSewa and Khalti**, Nepal's dominant digital wallets, plus standard bank/QR payment. This affects Phase 5 (platform billing / Wallet), not Phase 1 directly, but is worth correcting now so Phase 5's outline doesn't get built around the wrong gateway. **Correction to Phase 5 doc**: replace "Stripe/Razorpay" with "eSewa/Khalti (+ possibly a card gateway) — the locally relevant options, not the design doc's original suggestion."

6. **Mandatory-VAT sectors regardless of turnover.** Some sectors must register for VAT (and by extension use compliant billing) regardless of revenue — the sourced list includes restaurants *with a bar*, education/travel/software/audit consultancies, electronics/motor-parts dealers, and a few others. Relevant to Phase 3 (restaurant): a restaurant business with a bar license may need `cbmsRequired`/VAT-compliant billing even if under the general turnover threshold, so this flag can't be purely turnover-derived — it needs an explicit override, not just a computed default.

7. **Confirms rather than changes**: the plan's 13% VAT rate, mandatory invoice fields (PAN, sequential number, taxable value/VAT split, BS+AD dates, buyer PAN above Rs 10,000), Annexure 13/purchase-sales-register export requirement, and "no physical register needed if IRD-approved software produces the same reports" are all consistent with what's already designed — no changes needed there, but Annexure 13 / sales-purchase-register export (Excel format matching IRD's prescribed layout) isn't currently in `modules/invoices/`'s scope and should be added as a small, concrete Phase 1 addition since it's cheap relative to the invoicing engine already being built and is explicitly called out as a condition for skipping physical registers.

Sources: [SoftwareSuggest — Billing Software in Nepal](https://www.softwaresuggest.com/billing-software/nepal), [RestroX](https://www.restrox.com/np), [Fiscal Nepal — CBMS mandate expansion](https://www.fiscalnepal.com/2023/12/21/14830/ird-expands-central-billing-monitoring-system-mandate-for-high-turnover-businesses/), [IRD CBMS API doc](https://ird.gov.np/public/pdf/976029276.pdf), [BusySoftwareNepal — Best IRD Billing Software 2026](https://busysoftwarenepal.com/blog/best-ird-billing-software-nepal-2026/), [Nepalese Express — registering e-billing software with IRD](https://nepalesexpress.com/@bhaktaraz-bhatta/a-complete-guide-to-registering-your-electronic-billing-software-with-nepals-inland-revenue-department-ird), [HamroInvoice — IRD bill format guide](https://hamroinvoice.com/blog/nepal-ird-bill-format-hs-code-guide), [Common Law Nepal — VAT invoice rules & penalties](https://commonlaw.com.np/publications/vat-invoice-rules-and-penalties-in-nepal), [AttorneyNepal — VAT registration threshold](https://www.attorneynepal.com/blog/vat-registration-nepal-turnover-threshold-process).

## Architecture decision: who uses `apps/admin` this phase

`apps/admin` today (nav: Overview, Users; gated by Better Auth's `admin()` platform-role plugin) is unambiguously platform-operator-facing, not tenant/business-owner-facing. This phase only builds the **platform-operator** view (manage businesses, plan catalog, assign subscriptions). Tenant-facing mart POS/checkout UI (for business owners/cashiers) is a separate product surface and is explicitly deferred — building 3 sectors' worth of UI is out of scope for "foundation first," and mixing platform-ops and tenant-facing UI into one app mid-phase is its own design decision that deserves its own plan.

## 1. Schema — `apps/api/src/database/schema/billing.ts` (new file, barrel-exported from `schema/index.ts` like `auth.ts`)

Sector-specific fields go in a `jsonb sectorData` column on `products`/`orders`, not per-sector child tables — matches the design doc's own `productSchemaExtension: JSONSchema` framing, avoids a join on the checkout hot path, and there's no second sector yet to validate a relational split against. Revisit once medical/restaurant land.

Every tenant-scoped table indexes `business_id` first, per CLAUDE.md's tenant-isolation rule — enforced by code review since Postgres won't structurally enforce it.

```
businesses            -- 1:1 satellite to Better Auth `organization`
  id (text pk), organizationId (text, unique, fk -> organization.id, cascade)
  sector (text: 'mart'|'medical'|'restaurant'), legalName, panNumber,
  vatRegistered (bool), cbmsRequired (bool, default false), fiscalYearStartMonth (int), status ('active'|'suspended'|'closed')
  createdAt, updatedAt
  -- cbmsRequired: whether real-time CBMS push applies to this business. Not purely turnover-derived —
  -- some sectors (e.g. a restaurant with a bar license) must comply regardless of revenue, so this
  -- is an explicit, operator-settable flag, not something computed automatically from a revenue figure
  -- Phase 1 doesn't track. Defaults false so small businesses aren't pointlessly queued for CBMS push.

plans                 -- global catalog, NOT tenant-scoped
  id (text pk), sector, key (slug), name, priceCents (int, minor units),
  currency (default 'NPR'), billingCycle ('monthly'|'yearly'),
  featureFlags (jsonb), isActive (bool)
  unique(sector, key)

subscriptions          -- tenant-scoped, 1 active row per business this phase
  id, businessId (fk), planId (fk), status ('trialing'|'active'|'past_due'|'canceled'),
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd
  index(businessId, status)
  -- no payment gateway wired yet; assigning a plan just activates the row (see §6)

-- no persisted "entitlements" table: resolved at request time as
-- subscriptions ⋈ plans, cached in-process (see §4)

products               -- tenant-scoped
  id, businessId (fk), name, sku, unitType (default 'pcs'), priceCents (int),
  stockQty (numeric), lowStockThreshold (numeric), isActive (bool),
  sectorData (jsonb, default {})
  index(businessId, sku), index(businessId, isActive)

customers               -- the BUSINESS's own customers, not platform accounts
  id, businessId (fk), name, phone, panNumber
  index(businessId, phone)

orders                  -- status superset covers mart's simple flow + future restaurant state machine
  id, businessId (fk), customerId (fk, nullable), status (default 'placed'),
  subtotalCents, taxCents, totalCents (int), createdByUserId, sectorData (jsonb)
  index(businessId, status), index(businessId, createdAt)

order_items
  id, orderId (fk), businessId (fk, denormalized for the business_id-first-index rule),
  productId (fk), quantity (numeric), unitPriceCents, lineTotalCents
  index(businessId, orderId)

invoice_counters        -- compliance-critical gapless numbering, one row per business+fiscal year
  businessId (fk), fiscalYear (text, BS label e.g. '2082-83'), lastNumber (int, default 0)
  primary key (businessId, fiscalYear)

business_invoices       -- the business's own customer-facing invoice (distinct from any future platform_invoice)
  id, businessId (fk), orderId (fk), invoiceNumber (int, from invoice_counters),
  fiscalYear, customerId (fk, nullable), customerPan (snapshot, not fk'd),
  subtotalCents, vatCents (13% breakdown), totalCents,
  status (default 'issued'), printedCount (default 0),
  cbmsStatus ('pending'|'pushed'|'failed'), cbmsPushedAt,
  creditNoteForInvoiceId (self-fk, nullable), createdAt (immutable, no updatedAt)
  unique(businessId, fiscalYear, invoiceNumber), index(businessId, status)
  -- repository exposes no delete method; corrections only via credit-note insert

cbms_push_queue          -- retry queue; actual IRD polling worker stubbed/logged this phase
  id, businessId (fk), invoiceId (fk), attempts (default 0), lastError,
  status ('pending'|'succeeded'|'failed')
  index(businessId, status)

invoice_audit_log        -- immutable trail: issued/printed/credit_note_issued/cbms_pushed/cbms_failed
  id, businessId (fk), invoiceId (fk), action, actorUserId, metadata (jsonb), createdAt
  index(businessId, invoiceId)
```

Type exports follow `schema/auth.ts`'s convention: `export type Business = typeof businesses.$inferSelect`, `NewBusiness = typeof businesses.$inferInsert`, per table.

Not created this phase: `platform_invoices`/`platform_invoice_lines`, `payment_methods`/wallet — see Phase 5.

## 2. Auth prerequisite — extend Better Auth org roles via its real access-control API

`apps/api/src/auth/auth.config.ts`'s `organization({ allowUserToCreateOrganization: true, creatorRole: 'owner' })` only has Better Auth's default roles (`owner`/`admin`/`member`, from `better-auth/plugins/organization/access`'s `defaultStatements`/`defaultRoles`). Mart needs `manager`/`cashier` (per `sector-feature-spec.html`'s mart roles). Use Better Auth's actual access-control primitives, not a hand-rolled role string list — confirmed against the installed `better-auth@1.6.27` package (`dist/plugins/access/access.d.mts`, `dist/plugins/organization/access/statement.d.mts`, `dist/plugins/organization/types.d.mts`):

```ts
// apps/api/src/auth/access-control.ts (new file)
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

export const statement = {
  ...defaultStatements, // keep organization/member/invitation/team/ac defaults
  business: ['manage'],       // owner/manager-level business settings
  product: ['create', 'update', 'delete'],
  order: ['create', 'refund'],
  invoice: ['issue', 'print', 'credit-note'],
} as const;

export const ac = createAccessControl(statement);

// `owner` MUST re-declare Better Auth's own default statements. `roles` REPLACES
// the matching default role rather than merging with it (see the correction note
// below), so omitting these leaves an owner unable to invite staff.
export const ownerRole = ac.newRole({ organization: ['update','delete'], member: ['create','update','delete'], invitation: ['create','cancel'], team: ['create','update','delete'], ac: ['create','read','update','delete'], business: ['manage'], product: ['create','update','delete'], order: ['create','refund'], invoice: ['issue','print','credit-note'] });
export const managerRole = ac.newRole({ product: ['create','update','delete'], order: ['create','refund'], invoice: ['issue','print','credit-note'] });
export const cashierRole = ac.newRole({ order: ['create'], invoice: ['issue','print'] });
// reserved now, unused until Phase 2/3 — avoids a second Better Auth regen later
export const pharmacistRole = ac.newRole({ order: ['create'], invoice: ['issue','print'] });
export const waiterRole = ac.newRole({ order: ['create'] });
export const chefRole = ac.newRole({});
```

Wire into `auth.config.ts`:

```ts
organization({
  allowUserToCreateOrganization: true,
  creatorRole: 'owner',
  ac,
  roles: { admin: orgAdminAc, member: orgMemberAc, owner: ownerRole, manager: managerRole, cashier: cashierRole, pharmacist: pharmacistRole, waiter: waiterRole, chef: chefRole },
})
```

**Correction, verified against the installed package during implementation:** `roles` is **not** additive — it replaces `defaultRoles` wholesale. `dist/plugins/organization/has-permission.mjs` does `let acRoles = { ...input.options.roles || defaultRoles }`, so once `roles` is passed the defaults are never merged in, and `dist/plugins/admin/has-permission.mjs` has the same shape. Consequences, both handled above: `admin`/`member` must be re-exported explicitly from `better-auth/plugins/organization/access`, and `owner` must re-declare the default organization statements or a business owner silently loses `invitation:create` — which would break this section's own "staff onboarding uses `inviteMember`" design.

`bun run db:generate` is **not** required for this change: no new tables and `member.role` stays `text` (the `organizationRole` table only appears with `dynamicAccessControl` enabled, which Phase 1 does not use). Running it would overwrite the hand-maintained relations and type exports in `schema/auth.ts`.

**Also set `organizationLimit` and `membershipLimit`** on the same `organization()` config — both accept a plan-aware function, not just a static number, which is exactly what this system needs: `membershipLimit: async (user, organization) => { const business = ...; const plan = await getActivePlan(business); return plan.featureFlags.maxStaff ?? 5; }` ties Better Auth's own member-count enforcement directly to §1's `plans.featureFlags` instead of re-implementing a staff-count check inside `modules/subscriptions/`. `organizationLimit` should stay conservative (e.g. `5`) since one account owning many businesses is the product's core premise, not something to leave unbounded.

**Staff onboarding uses Better Auth's invitation system, not a custom "add staff" endpoint.** `modules/businesses/` doesn't need its own member-management routes — `authClient.organization.inviteMember({ email, role: 'cashier', organizationId })` (client) and the matching `sendInvitationEmail` callback in `auth.config.ts` (wired through the existing `EmailService`, same pattern as the current `sendResetPassword`/`emailOTP` callbacks) cover it. This also means the mart roles from §2 (`manager`/`cashier`) are usable immediately for invitations once the role extension lands — no separate module needed for "invite a cashier."

**Owner-protection is enforced by Better Auth itself, not app code**: the last `owner` of an organization cannot be removed, cannot leave, and cannot be demoted — confirmed as a built-in guarantee, so `modules/businesses/` never needs to hand-roll an "at least one owner" check. Any UI/flow for transferring ownership (e.g. before an owner account is deactivated) goes through `updateMemberRole` to promote a new owner first, same as Better Auth's own documented pattern — not a custom transfer endpoint.

**Client parity is required, not optional.** `apps/admin/src/lib/auth-client.ts` already has `organizationClient()` with no `ac`/`roles` passed — per this skill's Client section, plugin config must mirror the server. Update it to `organizationClient({ ac, roles: { owner: ownerRole, manager: managerRole, cashier: cashierRole, pharmacist: pharmacistRole, waiter: waiterRole, chef: chefRole } })` importing the same `ac.ts` module (or a client-safe re-export, since `apps/admin` can import server workspace code directly in this monorepo) so the client's local, synchronous `authClient.organization.checkRolePermission()` (see below) evaluates against the same statement shape as the server. Any future business-owner-facing client (tenant app, mobile) needs the same.

**Use Better Auth's built-in permission check, not a hand-rolled role-string comparison.** The org plugin ships two distinct checks, confirmed against the installed package's type definitions — don't conflate them: `auth.api.hasPermission` (server-side, `dist/plugins/organization/organization.d.mts`'s `createHasPermission`) does an authoritative check against the current session + `organizationId`, with an opt-in in-memory cache (`useMemoryCache`); `authClient.organization.checkRolePermission()` (client-side, `dist/plugins/organization/client.d.mts`) is a **synchronous, local** check against a role/statement pair with no network round-trip — useful for optimistically hiding UI the user can't act on, but never a substitute for the server check on any mutating action. §4's guard design calls the server-side `hasPermission`; the admin UI (§6) can use `checkRolePermission` for conditional rendering (e.g. hiding a "create business" action from a `member`-role user) but every actual mutation is still enforced server-side regardless of what the UI shows.

This is step 1 in the build order below — everything else depends on roles being resolvable.

## 2.5 Super admin — platform-wide control via the existing `admin()` plugin

`auth.config.ts` already has Better Auth's `admin()` plugin installed (used today for the `seed-admin.ts` bootstrap user), which natively covers *user-account* administration (ban, impersonate, force password/email reset, session revocation) via its own `defaultStatements`/`adminRoles`. That plugin knows nothing about businesses, plans, or subscriptions — those are this system's own domain — so a super admin who needs to suspend a business, reassign a plan, or read another business's audit trail needs a **second statement set on the same `admin()` plugin**, not a parallel authorization system:

```ts
// apps/api/src/auth/access-control.ts — same file as §2's ac/roles, additional exports
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements as adminDefaultStatements } from 'better-auth/plugins/admin/access';

export const platformStatement = {
  ...adminDefaultStatements, // keep user/session control (ban, impersonate, etc.)
  business: ['list-all', 'suspend', 'close', 'view-any'],
  plan: ['create', 'update', 'archive'],
  subscription: ['assign', 'cancel', 'view-any'],
  audit: ['view-all'],
} as const;

export const platformAc = createAccessControl(platformStatement);
export const superAdminRole = platformAc.newRole({
  user: ['create','list','set-role','ban','impersonate','delete','set-password','set-email','get','update'],
  session: ['list','revoke','delete'],
  business: ['list-all','suspend','close','view-any'],
  plan: ['create','update','archive'],
  subscription: ['assign','cancel','view-any'],
  audit: ['view-all'],
});
```

Wired into the **same** `admin()` call already in `auth.config.ts` (not a new plugin):

```ts
admin({ ac: platformAc, roles: { admin: superAdminRole } })
```

Every place this plan currently says `user.role === 'admin'` as the platform-operator gate (`modules/businesses/`'s `GET /v1/businesses`, `modules/plans/`'s writes, `modules/subscriptions/`'s assign/cancel) should call `auth.api.hasPermission` against `platformStatement` instead of a raw string comparison — same principle as §4's `@RequirePermission` for organization-scoped actions, just against the platform statement set. A super admin does **not** get automatic membership in every business's `organization` — platform control (suspend, reassign plans, read audit trails) is deliberately kept separate from being a member of a business, so the tenant-isolation boundary (§8 of `docs/system-design.md`) never gets a silent bypass. If a support scenario genuinely needs to act *as* a specific business, that's an explicit, audited grant — not designed this phase, flagged as a gap rather than assumed away.

**One thing worth stating explicitly**: Better Auth's org plugin has *no* built-in "list every organization across every user" endpoint — its `listOrganizations` (confirmed in `organization.d.mts`) is inherently scoped to the current session's own memberships, since that's the org plugin's whole worldview (a user sees the orgs they belong to). `GET /v1/businesses` (platform-wide list) is therefore correctly **hand-built in `modules/businesses/`**, querying the `businesses` table directly rather than calling any Better Auth org endpoint — this is not a gap, it's the expected shape given the org plugin's design, but worth stating so nobody later "simplifies" that endpoint into a Better Auth call that doesn't exist.

### Does this two-tier model (super admin + per-business roles) scale?

Two different questions hide inside "will this scale," worth separating:

**1. Does the permission *model* stay correct as tenant/member count grows?** Yes — nothing in this design gets structurally worse with more businesses or more staff. `hasPermission` is always evaluated against exactly two facts: the acting user's role *within the one organization in scope* (never a cross-organization computation) and, separately, the acting user's platform role (a flat, global `user.role`/`superAdminRole` check, also independent of tenant count). Neither check's cost or correctness depends on how many *other* businesses or members exist — there's no "loop over all organizations" anywhere in the guard chain (§4 of `docs/system-design.md`). This is exactly why the two-tier split (organization-scoped `ac`/`roles` vs. platform-scoped `platformAc`/`roles`, two separate statement sets on two separate Better Auth plugin instances) was chosen over a single flattened role system — a flattened "one role enum covering both business-staff and platform-operator concerns" would eventually need per-tenant-aware platform logic (e.g. "is this admin allowed to manage *this specific* business") that doesn't exist today and isn't needed, since platform admin is intentionally all-or-nothing per §2.5's non-goal (no partial/scoped super-admin this phase).

**2. Does it scale as *data volume/query load*, independent of the permission model?** This is the real limiting factor, not the roles/statements design:
- **`GET /v1/businesses` (platform list)** is a plain paginated query over `businesses` — scales the same way `modules/users`' existing list endpoint already does (server-driven `DataTable` pagination, per §6). No different at 100 businesses vs. 100,000; the usual index/pagination discipline applies, nothing special to this feature.
- **`membershipLimit`'s plan-aware function** (§2) runs a `subscriptions ⋈ plans` join per member-add — cheap and already scoped to one business, not global, so it doesn't degrade with total platform size, only (negligibly) with staff-add frequency on one business.
- **`hasPermission`'s `useMemoryCache`** (§4) is scoped to a single request's lifecycle, not a persistent cross-request cache — so unlike `EntitlementsService`'s in-process TTL cache (§4, explicitly flagged as breaking down across horizontally-scaled API instances), `hasPermission`'s cache has no multi-instance consistency problem to begin with, since it never outlives one request.
- **The one place that doesn't scale linearly with load is `invoice_counters`' row lock** (§6.1 of `docs/system-design.md`) — but that's a *per-business* serialization point (one very busy business's checkout throughput has a ceiling), not a cross-tenant or permission-model bottleneck, and it's correct behavior for compliance, not a flaw.

**Conclusion**: the super-admin + org-role split scales cleanly because neither permission check is tenant-count-aware by design — the actual scaling questions for this system live in §4's Redis/RLS follow-ups and standard pagination/indexing discipline, not in the access-control architecture itself. The one thing to keep an eye on as the platform grows is **out of scope for the permission model but real**: if a future requirement needs a *scoped* platform admin (e.g. "regional admin who can only manage businesses in one district"), that's a different, not-yet-designed axis — `dynamicAccessControl` (already noted as deferred in §7) or a `platformStatement` extension would be the mechanism, not a redesign of what's built here.

## 3. NestJS modules — `apps/api/src/modules/{businesses,plans,subscriptions,entitlements,products,orders,invoices}`

Each follows the existing `modules/users` 4-file pattern exactly: `*.module.ts` (controllers/providers/exports) → `*.controller.ts` (`@Controller({path,version:'1'})`, class-level `ClassSerializerInterceptor`) → `*.service.ts` (thin, throws `NotFoundException`) → `*.repository.ts` (`@InjectDatabase()`, raw Drizzle, returns `T | undefined`, never throws) → `dto/` (class-transformer response DTOs, class-validator query/body DTOs). Register each new module in `apps/api/src/app.module.ts` alongside `UsersModule`.

**Sector plugin: branch on `business.sector` for now, not a real plugin registry.** The design doc's `SectorPlugin` interface (hooks: `beforeCreate`/`onLineItemAdd`/`beforeCheckout`/`invoiceLineBuilder`) is the target shape, but with only mart implemented there's no second data point to validate it against. Name mart's service methods to match those hook names so extracting a real interface later (once medical/restaurant exist) is a mechanical lift, not a redesign. Document this as a deferred refactor, not a missing feature.

- **`modules/businesses/`** — CRUD on `businesses`. Creation flow uses Better Auth's native `organizationHooks.afterCreateOrganization` hook (in `auth.config.ts`'s `organization()` options — confirmed in the installed package's `OrganizationOptions.organizationHooks`) rather than a manual two-call sequence with ad-hoc compensation: the hook receives `{ organization, member, user }` after Better Auth has already created the org + seeded the creator's `owner` member row, and inserts the matching `businesses` satellite row inside that callback (needs `sector` — pass it through via `organization.metadata` at creation time, since `createOrganization` accepts arbitrary metadata, then read it back in the hook). This makes org-creation and business-row-creation atomic from the caller's perspective without a hand-built saga/rollback — Better Auth's hook only resolves once the org is durably created, so the hook firing is itself the signal it's safe to insert the satellite row. `GET /v1/businesses` and `PATCH /v1/businesses/:id/status` (suspend/close) are gated via §2.5's `platformStatement` (`business: ['list-all','suspend','close']`) through `auth.api.hasPermission`, not a raw `user.role === 'admin'` check. `GET /v1/businesses/me` joins through `member` on the current session user. `PATCH /v1/businesses/:id` (sector-agnostic field edits) uses the org-scoped `@RequirePermission({ business: ['manage'] })` from §4, since that's the business owner's own action, not a platform one. **No staff-management endpoints in this module** — inviting a manager/cashier goes through Better Auth's own `inviteMember`/invitation-accept flow (see §2), not a custom "add staff to business" route; `modules/businesses/` only owns the sector-agnostic satellite fields. Business `status: 'suspended'|'closed'` (§1) is a Phase 1 app-level flag checked by `BusinessAccessGuard`/`EntitlementsService`, deliberately separate from actually deleting the underlying Better Auth `organization` — `disableOrganizationDeletion: true` should be set on the `organization()` config this phase, since Phase 1 has no data-retention/archival design yet and an accidental org delete would cascade through every `businesses`-FK'd table.
- **`modules/plans/`** — CRUD on `plans`. Writes gated to platform operator; reads open (`GET /v1/plans?sector=mart`) so owners can see what's purchasable.
- **`modules/subscriptions/`** — `POST /v1/businesses/:businessId/subscriptions` assigns a plan (no gateway charge this phase — just activates the row with computed period dates), `GET .../current`, `PATCH .../cancel`.
- **`modules/entitlements/`** — no real controller (maybe a thin debug endpoint). Its product is `EntitlementsService.hasFeature(businessId, key)` (joins `subscriptions` ⋈ `plans.featureFlags`, requires `status === 'active'`) and the `BusinessAccessGuard` (§4). Build and unit-test this in isolation before any sector logic depends on it — highest-leverage piece in the whole phase.
- **`modules/products/`** — tenant-scoped CRUD, mart-specific validation (unit_type enum, sku uniqueness per business) since mart is the only sector implemented.
- **`modules/orders/`** — mart checkout. The core piece: a single `db.transaction()` that (1) decrements `products.stockQty`, (2) inserts `orders`/`order_items`, (3) calls into `modules/invoices/` for atomic numbering + `business_invoices` insert, (4) enqueues a `cbms_push_queue` row **only if `business.cbmsRequired` is true** (see the Nepal market research findings above — CBMS push isn't universal, it's turnover/sector-gated) — all-or-nothing. Guarded by `@RequirePermission({ order: ['create'] })` (owner/manager/cashier all have this per §2's role definitions) via Better Auth's `hasPermission`, not a manual role-string check.
- **`modules/invoices/`** — owns `invoice_counters`/`business_invoices`/`cbms_push_queue`/`invoice_audit_log`. Core method `issue(businessId, order, tx)` takes the caller's transaction (never opens its own), does the atomic increment:
  ```sql
  UPDATE invoice_counters SET last_number = last_number + 1
  WHERE business_id = $1 AND fiscal_year = $2
  RETURNING last_number
  -- (ON CONFLICT DO UPDATE upsert if the counter row doesn't exist yet)
  ```
  then inserts `business_invoices` with that number, then writes `invoice_audit_log`. No `DELETE` anywhere in this module — corrections only via `POST .../credit-note`, which inserts a new invoice row referencing the original and draws its own number from the same counter. `POST .../print` increments `printedCount` (client renders "COPY" watermark when `> 1`) and also audit-logs. Needs a Gregorian→Bikram Sambat fiscal-year conversion utility — no such library exists in the repo yet; add one (verify license/accuracy) as a new dependency.
  Test this module hardest: a concurrent-increment test (N parallel `issue()` calls against the same business+fiscal-year) asserting N distinct, gapless numbers is essential given the atomic-update approach is the entire safety guarantee.
  **Addition from Nepal market research**: `GET /v1/businesses/:businessId/invoices/registers?fiscalYear=...&format=xlsx` — an Annexure 13 / sales-register export (Excel, matching IRD's prescribed columns) built from `business_invoices`. This is explicitly what lets a business skip maintaining a physical Kharid/Bikri Khata under IRD's own rules, so it's cheap to add given the invoicing engine already exists and materially strengthens the compliance story — a purchase-register equivalent isn't needed yet since Phase 1 has no purchasing/supplier module.

## 4. `X-Business-Id` + entitlement guard

The existing global `AuthGuard` (from `@thallesp/nestjs-better-auth`, installed via `AuthModule.forRoot()`) only resolves *who* the user is (`request.session.user`). A new, locally-applied `BusinessAccessGuard` resolves *which business* and *whether they're a member*:

- Reads `X-Business-Id` header (also accept a `:businessId` route param for nested REST routes like `/businesses/:businessId/orders`; if both present, require they match).
- Looks up `businesses.organizationId` for that id, then queries `member` (`organizationId`, `userId = session.user.id`).
- No membership → **404**, not 403, matching the design doc's policy of not leaking existence to non-members (also matches "mart route called on a restaurant business → 404" from the design doc).
- Attaches `{ business, membership }` to the request; a paired `@CurrentBusiness()` decorator (mirrors the existing `@CurrentUser()`) exposes it.
- **Role/permission checks go through Better Auth's own server-side `hasPermission` API, not a hand-rolled `membership.role` string comparison.** A `@RequirePermission({ order: ['create'] })`-style decorator/guard calls `auth.api.hasPermission({ body: { organizationId: business.organizationId, permissions: {...} } })` (server-side; confirmed present as `createHasPermission` in the installed package's `organization.d.mts`, backed by the `ac`/`roles` statements defined in §2) with `useMemoryCache: true` to avoid a DB round-trip on every request within the guard's own request lifecycle. This keeps "can act as this business" (membership existence) and "does their role permit this specific action" (permission check against §2's statements) as two separate, independently testable guard layers, but neither reimplements role logic Better Auth already owns.

`hasFeature()` (subscription/plan entitlement) caching is a **separate concern from the above** — it has nothing to do with Better Auth's org roles, it's Phase 1's own `subscriptions ⋈ plans.featureFlags` check. **In-process TTL cache this phase, not Redis.** No Redis/`ioredis` exists anywhere in the stack today (confirmed: not in `env.schema.ts`, no service registered) — adding it just to cache a cheap two-table join is disproportionate. Use a small in-memory TTL cache (or `@nestjs/cache-manager`'s default in-memory store) in `EntitlementsService`, ~30–60s TTL, invalidated on subscription/plan mutation. Explicitly note this won't stay consistent once the API scales beyond one instance — Redis promotion is a follow-up once that's a real constraint, not before. (Better Auth's own `hasPermission` memory cache, above, is unrelated and doesn't need this same caveat since it's scoped per-request via `useMemoryCache`, not a persistent cross-request cache.)

## 5. Build order

1. Write `apps/api/src/auth/access-control.ts` (§2's org-scoped `ac`/statements/roles **and** §2.5's `platformAc`/`superAdminRole`), wire the org-scoped ones into `auth.config.ts`'s `organization()` (`ac`, `roles`, `organizationHooks.afterCreateOrganization`, `organizationLimit`, `membershipLimit`, `disableOrganizationDeletion: true`, `sendInvitationEmail` via the existing `EmailService`) and the platform ones into the existing `admin()` call (`ac: platformAc`, `roles: { admin: superAdminRole }`), and mirror both in `apps/admin/src/lib/auth-client.ts`'s `organizationClient({ ac, roles })`/`adminClient({ ac: platformAc, roles })` → `bun run db:generate`.
2. Write `schema/billing.ts` → `db:push` in dev, review generated SQL for the business_id-first-index rule before ever running `db:migrate`.
3. `modules/businesses/` (unlocks everything downstream — every tenant table FKs to it; creation flow relies on step 1's `afterCreateOrganization` hook; staff invites use Better Auth's own `inviteMember` flow, no custom endpoint needed; includes the `PATCH /:id/status` suspend/close endpoint gated by §2.5's platform statements).
4. `modules/plans/` + a `seed-plans.ts` script (mirror `apps/api/src/database/seed-admin.ts`'s pattern: reads env or hardcoded seed data, uses `getDb()` directly, `process.exit()` on completion/error) seeding `mart-basic`/`mart-pro`.
5. `modules/subscriptions/` — once this exists, revisit step 1's `membershipLimit` to key off the business's actual active plan (`plans.featureFlags.maxStaff`) instead of a static number.
6. `BusinessAccessGuard` + `@CurrentBusiness()` + `@RequirePermission()` (calling Better Auth's `hasPermission`, both org-scoped from §4 and platform-scoped from §2.5) + `modules/entitlements/` — build and unit-test standalone against steps 3–5 before any sector logic is written on top.
7. `modules/invoices/` — build and test standalone (a synthetic order/business is enough, doesn't need `modules/orders/` to exist first). Isolate and stress the concurrent-increment path hardest.
8. `modules/products/` + `modules/orders/` (mart) — the checkout transaction, composing steps 6+7.
9. `apps/admin` UI slice (§6, the super-admin dashboard: Overview home + Businesses list/detail with suspend/close + Plans) — built last, lowest-risk, most mechanical, benefits from a stable API.

## 6. Frontend slice — `apps/admin` is the super-admin dashboard

`apps/admin` **is** the super-admin dashboard — not a separate app. It already exists, is already gated by Better Auth's `admin()` plugin, and already has the `DashboardShell`/`DataTable`/`features/users` pattern this phase extends rather than replaces. Every screen below is reachable only by a `user.role === 'admin'` session whose admin-plugin role carries §2.5's `platformStatement` permissions — enforced server-side by each endpoint's `hasPermission` check, with the UI using `checkRolePermission` only to hide actions the session can't perform (never as the actual gate, per §2's client/server permission-check distinction).

Reuses `@repo/ui`'s `DashboardShell` and `DataTable` (already server-driven, `manualSorting`/`manualFiltering`/`manualPagination`) and mirrors `apps/admin/src/features/users/`'s feature-folder convention exactly — no new UI primitives needed.

**Nav additions** in `apps/admin/src/app/(dashboard)/layout.tsx`'s `navItems`, appended after the existing `Overview`/`Users`: `Businesses` (`/businesses`), `Plans` (`/plans`). Subscriptions surfaced within a business's detail page, not top-level nav (no consolidated platform-invoice view yet to justify one, per §7's deferral of Phase 5).

**`Overview` (`/`, already exists as a placeholder) becomes the actual super-admin home** — the one screen a super admin looks at first, so it should answer "is anything on fire" at a glance rather than staying a stub:
- Stat tiles (reusing `@repo/ui`'s `chart-card`/stat-tile composed components already in the package): total active businesses, businesses by sector (mart/medical/restaurant split), active subscriptions by status (`trialing`/`active`/`past_due`/`canceled` counts — cheap aggregate query over Phase 1's `subscriptions` table), and a CBMS health tile (count of `cbms_push_queue` rows in `failed` status, across all `cbmsRequired` businesses — the one number that should never silently creep up unnoticed, per §6.5 of `docs/system-design.md`'s CBMS-gating design).
- A short "recent businesses" list (last 5–10 created, name + sector + status) linking into the `/businesses` detail pages — enough to spot a burst of signups or a suspicious pattern without a dedicated activity-log page this phase.
- **Not built this phase**: full charting/trend graphs, revenue dashboards (no platform billing exists yet — Phase 5), or a general activity feed. The overview page is data the platform operator can act on immediately (stuck subscriptions, failed CBMS pushes), not a vanity metrics dashboard — matches the "foundation first" principle of not building UI ahead of the data that would make it meaningful.

**`Businesses` (`/businesses`)** — list + detail, the core super-admin business-control surface:
- `app/(dashboard)/businesses/page.tsx` — `DataTable` list, server-driven pagination/filtering matching the `users` list pattern, filterable by sector and status. Row actions (via `@repo/ui`'s `ConfirmDialog`): **Suspend**, **Close**, both calling `PATCH /v1/businesses/:id/status` (§3's platform-gated endpoint) — this is the concrete "super admin controls all" action, letting the operator take a business offline independent of that business's own owner, e.g. for a compliance violation or non-payment.
- `app/(dashboard)/businesses/[id]/page.tsx` — detail: business info (sector, PAN, VAT/CBMS flags — including toggling `cbmsRequired` per business, since §1's schema made this operator-settable rather than purely computed), current subscription with a **change-plan** action (`modules/subscriptions/`'s assign endpoint), and a read-only **audit trail** tab showing that business's `invoice_audit_log` (via §2.5's `audit: ['view-all']` platform statement) — the concrete "read another business's audit trail for support/compliance" capability from `docs/system-design.md` §3.5.

**`Plans` (`/plans`)** — catalog table with a sheet+form for create/edit/archive, no dedicated `[id]` page needed given low write frequency.

New `apps/admin/src/features/businesses/` and `.../plans/`, each with `components/`, `queries.ts`, `mutations.ts`, `search-params.ts` (nuqs), `services.ts`, `types.ts`, `views/*-view.tsx` — copy the shape of `features/users/` file-for-file.

- **Not built this phase**: any tenant-facing mart POS/checkout screen (that's a different product surface — new app or route group — for a later phase per the "who uses apps/admin" decision above), the explicit audited "support access" grant flow flagged as a gap in `docs/system-design.md` §3.5, and any cross-business bulk-action tooling beyond single-row suspend/close.

## 7. Not in this phase (see other phase docs)

- Medical sector, restaurant sector — Phase 2 and Phase 3 docs.
- Offline sync architecture — Phase 4 doc.
- Platform invoice consolidation, Wallet/payment gateway, nightly subscription-charge cron — Phase 5 doc.
- Redis-backed entitlement cache — revisit once horizontal scaling is a real requirement (in-process TTL cache used instead this phase).
- Postgres RLS — defense-in-depth on top of app-layer `business_id` scoping, which is Phase 1's sole enforcement mechanism.
- A real pluggable `SectorPlugin` registry — Phase 1 hard-codes mart with hook-shaped method names as a migration path; extract once a second sector exists to validate the interface against.
- Real IRD CBMS push worker — queue table + enqueue built this phase; outbound polling stubbed/logged pending IRD API credentials.
- Tenant-facing mart UI (POS/checkout/staff screens beyond what `member`/`invitation` already provide).
- Better Auth's `organization` plugin `teams` sub-feature — not enabled this phase. A team would be the natural fit for a business's multiple physical locations/branches (still one `organization`/`businesses` row, multiple teams under it), but Phase 1 has no multi-branch requirement. Flag as the mechanism to reach for if/when a business needs more than one location, rather than inventing a parallel "branch" table.
- Better Auth's `dynamicAccessControl` (org-scoped custom roles created via API/DB rather than static config) — Phase 1 uses static `ac`/`roles` in `auth.config.ts` since the full role set (owner/manager/cashier + reserved pharmacist/waiter/chef) is known upfront and doesn't need to vary per business.
- **Nepal server-residency decision** — where `apps/api`/Postgres actually get deployed (Nepal-based hosting vs. a foreign-hosted cloud with a Nepal-based audit-log server) is a real compliance constraint per the market research above, but it's an infra/hosting decision outside this plan's engineering scope. Needs to be resolved before or alongside Phase 1 build-out, not deferred indefinitely.
- **IRD software approval application** — not an engineering task, but a prerequisite business/legal workstream (application letter, sample invoices, documented format, business registration certs) that should start in parallel with Phase 1 rather than after it ships, since approval isn't instant and every competitor markets it as a trust signal.
- **Multi-branch/multi-location per business** — flagged in the market research above as also affecting invoice-number prefix design (IRD recommends branch-aware prefixes). Deferred alongside Better Auth `teams` (already noted above as the mechanism), but worth remembering the numbering scheme may need a prefix segment reserved for it later rather than retrofitted.

## Verification

**Run and passing:**

- `bun run check-types` and `bun run lint` repo-wide (apps/api uses its own ESLint+Prettier, not Biome). `mobile#check-types` fails on pre-existing CSS-module declarations, unrelated to this phase.
- `apps/api`'s Jest suite: 18 unit tests covering BS fiscal-year conversion (including timezone independence at the year boundary), VAT rounding, and billing-period month clamping.
- NestJS boot check: the DI graph resolves and all 36 routes map under `/api/v1`.
- `apps/admin` production build. Note this also **fixed a pre-existing failure**: `/users` did not build, because nuqs' `useQueryStates` calls `useSearchParams` and Next 16 requires a Suspense boundary around it. All three list views are now wrapped.

**Not run — needs a Postgres the developer has `CREATEDB` on:**

- The **concurrent-invoice-numbering stress test** (`src/modules/invoices/invoice-numbering.integration.spec.ts`). It skips unless `TEST_DATABASE_URL` is set. This is the entire safety argument for gapless numbering, so treat that guarantee as unproven until it has run:
  ```sh
  TEST_DATABASE_URL=postgresql://... bun run test
  ```
- Everything in the manual/end-to-end list below.
- The admin UI has never rendered against live data, so mismatches between its HTTP calls and the API's response shapes are still possible.
- Manual end-to-end: seed a mart plan, create a business via API, assign the plan, hit `POST /v1/businesses/:id/orders` with a product + line items, confirm stock decrements, an invoice with a gapless number is issued, and `invoice_audit_log`/`cbms_push_queue` rows are written — all inside one transaction (verify by forcing a mid-transaction failure and confirming full rollback).
- `bun run dev --filter=admin`, log in as the seeded admin (`seed-admin.ts`), visit `/businesses` and `/plans`, confirm `DataTable` pagination/sorting round-trips against the new server-driven endpoints, create a business + assign a plan through the UI.
- **Super-admin permission boundary**: create a second, non-admin user, add them as `owner` of a business, and confirm they get 403/404 (not a rendered page) hitting `GET /v1/businesses` (platform-only) and `PATCH /v1/businesses/:id/status`, while the seeded admin succeeds on both — this is the concrete test that §2.5's `platformStatement` gate is actually enforced server-side, not just hidden client-side. Also verify a suspended business's `BusinessAccessGuard` (§4) correctly blocks that business's own owner from further writes, confirming `status` actually has teeth.
