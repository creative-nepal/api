# Multi-Sector Billing SaaS — Phase 3: Restaurant Sector (outline)

## Context

Third sector plugin for the Multi-Sector Billing SaaS, building on the tenancy/subscription/entitlement/invoicing foundation delivered in `2026-08-14-billing-phase1-foundation-mart.md`. Implements `docs/sector-feature-spec.html` §rest-flow, §rest-menu, §rest-kitchen, §rest-billing, §rest-analytics.

This is an outline only — not yet fully designed. Design it in its own pass once Phase 1 (and likely Phase 2) has shipped.

## Known scope

- `tables` and `menu_items` tables (new). `orders.status` already carries the superset state machine reserved in Phase 1's schema (`placed → confirmed → in_kitchen → preparing → ready → served → billed`) specifically for this sector.
- Table-scoped QR ordering session: customer-originated orders with no login, bound to a `table_id` via a short-lived session token — a new auth surface distinct from Better Auth's normal authenticated session.
- KOT (kitchen order ticket) generation/routing to a kitchen display or printer, grouped by station if needed. Chef role scoped to KOT status only (no pricing/billing visibility) — `chef` role slug already reserved in Phase 1's `auth.config.ts` org-role extension.
- Split-bill by item or by guest count in the billing flow, reusing Phase 1's `modules/invoices/` invoicing engine unchanged (same gapless numbering, VAT breakdown, CBMS push queue).
- Waiter role: confirm/serve orders, take manual (walk-in/phone) orders, table status management. `waiter` role slug already reserved in Phase 1.
- Analytics: table turnover, item performance, waiter/kitchen performance, peak-hour heatmap — extends Phase 1's analytics patterns.
- **Note from Nepal market research** (see `2026-08-14-billing-phase1-foundation-mart.md`'s "Nepal market research findings" section): restaurants with a bar license are on IRD's mandatory-VAT-registration list regardless of turnover. Phase 1's `businesses.cbmsRequired` flag is operator-settable, not purely turnover-derived, specifically so a bar-licensed restaurant can be flagged compliant from day one rather than needing a manual fix later — this phase should make bar-license status a visible field on the business record, not just leave the flag unexplained in the admin UI.

## Deferred from this outline

Full schema design, module breakdown, guard/entitlement integration details, build order, frontend slice, and verification plan — to be written when this phase is picked up, following the same structure as `2026-08-14-billing-phase1-foundation-mart.md`.
