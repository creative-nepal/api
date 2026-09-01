# Multi-Sector Billing SaaS — Phase 4: Offline Sync (outline)

## Context

Mobile/desktop offline-first architecture for the Multi-Sector Billing SaaS, implementing `docs/offline-sync-architecture.html` in full. Builds on the invoicing engine delivered in `2026-08-14-billing-phase1-foundation-mart.md`.

This phase should only be picked up once at least one sector has a real mobile UI to sync — currently none does (`apps/mobile` has only template tab screens: `index`/`explore`/`account`; auth wiring via Better Auth's Expo client already exists in `apps/mobile/src/lib/auth-client.ts`, but no domain/sector screens).

This is an outline only — not yet fully designed.

## Known scope

- SQLite local schema on mobile/desktop mirroring the design doc's pseudocode: `products` (read cache), `stock_movements_outbox` (offline sales/adjustments as deltas, never absolute values), `orders_outbox`, `invoices_outbox`, `sync_log` (audit trail per device).
- Auth continuity: cached JWT read once at app open, silent background refresh when online, offline grace period that allows continued use of cached data but blocks new server-bound writes once the token actually expires. Layers on top of the existing Better Auth Expo client wiring.
- Product sync: delta pull every 15 min + manual "Sync now" button (`GET /products?business_id=..&updated_since=...`); delta push of stock movements (deltas, not snapshots, so two offline devices adjusting the same product don't clobber each other).
- Orders/invoices: attempted against the server directly first (real-time IRD/CBMS push needs this), falling back to the local outbox only on failure. Idempotent via client-generated UUIDs on every outbox row.
- **Invoice number leasing** — the hardest piece. Devices lease a block of official invoice numbers from Phase 1's `invoice_counters` while online, issue numbers from the lease while offline (real numbers, not locally invented), fall back to a "provisional" local draft receipt if the lease runs out while still offline, and reconcile unused leased numbers on reconnect (carry forward or explicitly void with a reason — no unexplained gaps). This extends, not replaces, Phase 1's `modules/invoices/` atomic-increment design; needs its own atomic "lease N numbers" endpoint using the same row-lock pattern as the existing `UPDATE invoice_counters ... RETURNING`.
- Sync/queue engine internals: background worker (15-min cadence, mobile WorkManager/BackgroundTasks or a desktop timer/daemon), network-state listener for immediate reconnect-triggered sync, idempotency keys, conflict resolution rules (server always authoritative for absolute values, devices only send deltas; server-assigned invoice numbers always win).
- Sync status UI: persistent connection indicator, pending-sync count, manual sync button, last-synced timestamp, per-record "pending sync" badge.

## Deferred from this outline

Full local schema DDL, sync worker implementation details, lease-endpoint API design, mobile screen inventory, and verification plan — to be written when this phase is picked up, following the same structure as `2026-08-14-billing-phase1-foundation-mart.md`.
