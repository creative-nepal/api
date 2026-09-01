# Multi-Sector Billing SaaS — Phase 2: Medical Sector (outline)

## Context

Second sector plugin for the Multi-Sector Billing SaaS, building on the tenancy/subscription/entitlement/invoicing foundation delivered in `2026-08-14-billing-phase1-foundation-mart.md`. Implements `docs/sector-feature-spec.html` §medical-product, §medical-extra, §medical-roles.

This is an outline only — not yet fully designed. Design it in its own pass once Phase 1 has shipped and its schema/module patterns are proven in practice.

## Known scope

- Extend `products.sectorData` jsonb with medical fields: `generic_name`, `manufacturer`, `schedule` (`otc`/`prescription`/`controlled`), `batches[]` (`batch_no`/`expiry_date`/`qty`/`cost_price`) — or promote batches to a real child table if jsonb querying proves painful in practice (Phase 1 explicitly flags this as a revisit point once a second sector exists).
- FEFO (First-Expire-First-Out) dispensing suggestion logic in the checkout flow, generalizing Phase 1's mart-specific `modules/orders/` — Phase 1 deliberately named mart's service methods after the design doc's `SectorPlugin` hook names (`beforeCreate`/`onLineItemAdd`/`beforeCheckout`/`invoiceLineBuilder`) specifically so this generalization is a mechanical lift, not a redesign.
- Prescription attach requirement for `schedule = prescription` items (photo/scan + prescribing doctor name) before checkout completes.
- Controlled-substance append-only register (new table) logging buyer ID/details for `schedule = controlled` sales.
- Expired-batch hard block at checkout (not just a warning — actually unsellable).
- New `pharmacist` role enforcement — only role permitted to dispense prescription/controlled items. Role slug already reserved in Phase 1's `auth.config.ts` org-role extension.
- Insurance claim linkage (provider + policy number tagged on order, claim status tracked against the invoice).
- Regulatory export: batch-wise sales/stock report, extending Phase 1's analytics with batch/schedule columns.
- Evaluate extracting Phase 1's "branch on `business.sector`" approach into a real `SectorPlugin` interface/registry now that a second sector exists to validate the interface shape against.

## Deferred from this outline

Full schema design, module breakdown, guard/entitlement integration details, build order, frontend slice, and verification plan — to be written when this phase is picked up, following the same structure as `2026-08-14-billing-phase1-foundation-mart.md`.
