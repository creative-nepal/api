# Multi-Sector Billing SaaS — Phase 5: Platform Billing (outline)

## Context

Platform-level (account-facing, not business-facing) billing for the Multi-Sector Billing SaaS — the layer that charges businesses for their subscriptions, as opposed to Phase 1's `business_invoices` (what a mart charges its own customers). Implements `docs/multi-sector-billing-system-design.html` §07 (subscription & billing engine's async billing cycle) and the `platform_invoices`/`payment_methods`/Wallet concepts from §03/§05, deferred out of Phase 1.

This is an outline only — not yet fully designed. Depends on `2026-08-14-billing-phase1-foundation-mart.md`'s `subscriptions` table (already carries `currentPeriodEnd`/`status` fields this phase will act on).

## Known scope

- `payment_methods` table (account-scoped — not business-scoped — since a Wallet is shared across all of an account's businesses per the design doc). Stores gateway tokens only, never raw card data.
- Wallet concept: the account's default payment method, shared across businesses.
- Payment gateway integration — **correction from Nepal market research** (see `2026-08-14-billing-phase1-foundation-mart.md`'s "Nepal market research findings" section): the original design doc suggested Stripe/Razorpay, but neither is relevant in the Nepal market. Every surveyed competitor (RestroX and others) integrates **eSewa and Khalti**, Nepal's dominant digital wallets, alongside standard bank/QR payment — use these instead. Requires new env vars in `apps/api/src/config/env.schema.ts` (none exist yet; `env.schema.ts` currently has no payment-provider keys).
- Nightly cron: find subscriptions with `current_period_end <= today` (Phase 1's `subscriptions` table already has this column), charge the account's default payment method via the gateway. On success: extend period, mark `active`, append a line item to that month's `platform_invoice`. On failure: mark `past_due`, trigger dunning, then downgrade/suspend *that business only* — other businesses under the same account keep working.
- `platform_invoices`/`platform_invoice_lines` tables (consolidated per account, itemized per business/subscription) + a monthly consolidation job + PDF rendering (object storage for the PDF, per the design doc's suggested S3-compatible storage).
- Platform-level audit log for subscription/plan/staff changes — distinct from Phase 1's per-business `invoice_audit_log`, which covers business-invoice state changes only.

## Deferred from this outline

Full schema design (`payment_methods`, `platform_invoices`, `platform_invoice_lines`), module breakdown, cron/worker implementation, gateway integration details, admin UI for platform invoices, and verification plan — to be written when this phase is picked up, following the same structure as `2026-08-14-billing-phase1-foundation-mart.md`.
