# Tenant Workspace — the business-facing UI

Phase 1 deferred this explicitly: "Tenant-facing mart POS/checkout UI (for business owners/cashiers) is a separate product surface... mixing platform-ops and tenant-facing UI into one app mid-phase is its own design decision that deserves its own plan." This is that plan.

## Context

Phases 1, 2, 3 and 5 built a complete API: three sectors, one invoicing engine, platform billing. **No business owner, cashier, pharmacist or waiter has a screen.** `apps/admin` is the platform-operator dashboard — it manages businesses, it is not one.

This is also what unblocks Phase 4: offline sync "should only be picked up once at least one sector has a real mobile UI to sync", and a web POS is the shape that mobile screen will mirror.

## 1. It goes in `apps/web`, not a new app

`apps/web` already carries the whole account surface a business owner uses: register, login, forgot/reset password, and a session. Adding a `(dashboard)` route group there gives the owner one continuous journey — sign up, create a business, start selling — rather than bouncing between two deployments.

The alternative, a fourth app, buys isolation nobody needs: the tenant workspace and the public marketing page share auth, theme, and API client, and splitting them would duplicate all three. `apps/admin` stays separate for the reason Phase 1 gave — platform-operator and tenant concerns are genuinely different audiences with different authorization axes.

## 2. The central problem: business context

Every tenant API route is `/v1/businesses/:businessId/...` or requires `X-Business-Id`. An account may own several businesses across different sectors. So the workspace needs, before any screen works:

1. **A resolved current business**, from `GET /v1/businesses/me`.
2. **Persistence across reloads**, so a cashier does not re-pick a shop every morning.
3. **Automatic header injection**, so no feature has to remember it.
4. **A switcher**, since the multi-business account is the product's differentiator.

Injection belongs in the axios instance, not in each query. A feature that forgets the header gets a 400 from `BusinessAccessGuard`; one that hardcodes it breaks switching. Neither should be possible.

**Sector drives navigation.** A mart shows Products and POS; a pharmacy adds Batches and the controlled register; a restaurant shows Tables, Menu, and the kitchen instead of a POS. Rendering all three and hiding two would leak the product's shape and confuse the nav.

## 3. Roles drive what renders

The API enforces permissions server-side — that is settled and tested. The UI's job is to not show a cashier a button that will 403.

`authClient.organization.checkRolePermission()` is local and synchronous, evaluating the same statements the server holds (that is why `apps/admin` mirrors `ac`/`roles`, and why `apps/web` now must too). It is an affordance, never a gate: every mutation is still enforced by the API regardless of what rendered.

## 4. Screens

Grouped by who needs them daily:

| Screen | Sector | Role |
|---|---|---|
| **POS / checkout** | mart, medical | cashier, pharmacist, manager, owner |
| Products | mart, medical | manager, owner |
| Batches + expiry | medical | pharmacist, manager, owner |
| Tables | restaurant | waiter, manager, owner |
| Menu | restaurant | manager, owner |
| Kitchen (KOT) | restaurant | chef, waiter |
| Invoices + registers | all | manager, owner |
| Staff (invite) | all | owner |
| Settings / billing | all | owner |

**POS is the one that matters.** It is the screen a shop has open all day, and the only one where a slow or fiddly interaction costs the business money. Everything else is periodic.

## 5. POS design

One screen, no navigation mid-sale:

- **Search-first.** A cashier types or scans; the product list filters live. No category drilling.
- **Cart on the right**, always visible, showing line totals, VAT, and the grand total as they change — the numbers the customer will be told.
- **Buyer capture only when required.** Phase 1 enforces name + PAN above NPR 10,000; the field appears at that threshold rather than sitting on screen for every sale.
- **Medical**: FEFO is automatic server-side, so the cashier picks a product, not a batch. Prescription and buyer-identity fields appear only when the cart contains a `prescription` or `controlled` item — the same rule the API enforces, surfaced early so the sale is not rejected at the end.
- **After checkout**: the invoice number, and a print action. `printedCount > 1` renders the COPY watermark Phase 1 records.

Stock and price come from the server on every load; the client never computes a total it will not be charged. The API returns the authoritative totals on checkout, and the UI shows those, not its own arithmetic.

## 6. Build order

1. `auth-client` mirrors `ac`/`roles`; business context store + provider; axios interceptor.
2. `(dashboard)` route group, shell, sector-aware nav, business switcher.
3. Products list (mart/medical).
4. **POS checkout**, both catalogue sectors.
5. Invoices list + register export.
6. Restaurant: tables, menu, kitchen.
7. Staff invitations, settings, billing.

## 7. Status

> **All seven build-order steps complete.**
>
> Screens: POS (mart/medical), Products, Batches (medical expiry dashboard),
> Tables, Menu with the 86 switch, Kitchen display, Invoices with credit notes
> and the Annexure 13 export, Purchasing (suppliers, orders, goods receipt,
> bills, Kharid Khata and the TDS return), Staff invitations, and Settings with
> the plan and account billing. Navigation is sector-aware and lists only routes
> that exist.
>
> `apps/admin` gained the operator's **Platform billing** screen — accruing,
> unpaid and paid totals across every account, plus the idempotent billing run
> and consolidation. That needed a new cross-account endpoint
> (`GET /v1/billing/platform/invoices`); the existing one is account-scoped by
> design and would have shown an operator only their own bills.
>
> Verified against a live API: every screen's primary call returns 200, and the
> flows behind them work — 86'ing an item, a partial goods receipt landing in a
> batch with cost recomputed, the batches screen seeing it, and register
> downloads arriving with a filename header.
>
> **A real bug surfaced doing this**: the menu screen requested 200 items while
> the shared `PaginationQueryDto` caps at 100, so a restaurant's menu returned
> 400 and never loaded. `ListMenuQueryDto` now raises its own ceiling — a menu is
> read whole rather than paginated, and silently truncating one is worse than a
> larger read.

## 8. Not in this plan

- **Mobile.** `apps/mobile` mirrors the POS once the web one is proven; that is Phase 4's prerequisite, not this plan's scope.
- **Offline.** Phase 4 owns it. The POS assumes connectivity and should fail loudly rather than pretend.
- **Business creation onboarding.** `authClient.organization.create` with sector metadata already works; a guided flow is a later refinement.
