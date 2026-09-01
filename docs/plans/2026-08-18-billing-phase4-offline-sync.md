# Multi-Sector Billing SaaS — Phase 4: Offline Sync

Supersedes the outline in `2026-08-14-billing-phase4-offline-sync.md`.

## Context

A Nepali shop loses connectivity routinely. The POS must keep selling through it — but every sale still has to end up with a **real, gapless, IRD-valid invoice number**, and that number is issued by a counter on the server.

That tension is the whole phase. Everything else — cached products, an outbox, a background worker — is ordinary offline plumbing. Invoice numbering is not, and it is where this design spends its care.

## 1. The problem with numbering offline

Phase 1's guarantee is that `business_invoices` numbers are **sequential, gapless, and never repeated**, enforced by an atomic `UPDATE invoice_counters ... RETURNING` inside the checkout transaction. A device that cannot reach the server cannot take that lock.

Three options, two of which are wrong:

1. **Invent numbers locally, renumber on sync.** Breaks immediately: the customer already walked out with a printed invoice bearing a number that no longer exists. An invoice is a legal document the moment it is handed over.
2. **Refuse to sell offline.** Honest, and what the current POS does. But it is the behaviour this phase exists to remove.
3. **Lease a block of numbers while online.** The device holds *real* numbers, issued by the same counter, and spends them offline. This is the only option where the printed number is genuine at the moment of printing.

So: leasing.

## 2. Leases, and the gap they create

A lease of 10 numbers that sees 3 sales leaves 7 numbers issued-but-unused. Left alone, that is exactly the gap Phase 1 forbids.

**A leased number that is never used must become a voided invoice row**, not disappear. The register then shows every number ever issued, some marked void with a reason — which is what an auditor expects and what "no unexplained gaps" means. A hole in the sequence is unexplainable; a voided row is explained.

This is why reconciliation is mandatory rather than best-effort, and why the lease carries an expiry: an abandoned device must not strand numbers forever.

```
invoice_leases
  id, businessId (fk), fiscalYear, deviceId
  firstNumber, lastNumber          -- the reserved block, inclusive
  usedThrough                      -- highest number actually consumed
  status ('open'|'reconciled'|'expired')
  expiresAt, reconciledAt, createdAt
  index(businessId, status), index(businessId, deviceId)
```

Leasing takes the block with the same atomic increment Phase 1 uses — `lastNumber = lastNumber + n RETURNING` — so a lease and a concurrent online sale can never collide.

### Reconciliation

On reconnect the device reports which numbers it used and submits the corresponding invoices. Then, for the remainder of the block, the server writes a voided `business_invoices` row per unused number, with `status: 'voided'` and an audit entry. The lease closes.

An **expired** lease is reconciled the same way by the server, unilaterally: every number in the block that never arrived becomes a voided row. The device losing its data does not get to leave a hole in a legal register.

## 3. Server-side surface

Four additions, all of which are testable without a mobile client:

- `POST /v1/businesses/:id/invoice-leases` — lease a block. Body: `{ deviceId, size }`, capped. Returns the block and its expiry.
- `POST /v1/businesses/:id/invoice-leases/:leaseId/reconcile` — submit used numbers; void the rest.
- `GET /v1/businesses/:id/sync/products?updatedSince=` — delta pull for the read cache.
- **Idempotent order ingestion** — `POST .../orders` accepts a client-generated `clientRequestId`; a replay returns the original order rather than creating a second one. This is what makes an outbox safe to retry, and it is useful to the *online* POS too: a double-tapped "Complete sale" over a flaky connection is the same failure mode.

## 4. Device side (not built here — see §6)

- **SQLite**: `products` (read cache), `orders_outbox`, `stock_movements_outbox` (deltas, never absolutes, so two devices adjusting the same product do not clobber each other), `sync_log`.
- **Server-first, outbox-on-failure**: try the real endpoint, fall back to the outbox only when it fails. Real-time CBMS push needs the online path taken whenever it is available.
- **Conflict rules**: the server is authoritative for absolute values; devices send only deltas; server-assigned invoice numbers always win.
- **Auth continuity**: cached session, silent refresh when online, and an offline grace period that permits continued use of cached data but blocks new server-bound writes once the token has genuinely expired.

## 5. What this does not attempt

- **Two devices sharing one lease.** Each device leases its own block. Simpler, and the cost is only some voided numbers.
- **Offline credit notes.** A correction against an invoice the server has not seen is a knot; credit notes stay online-only.
- **Offline for restaurant.** A restaurant order is not invoiced on creation (Phase 3), so it has no numbering problem — but its KOT flow is inherently multi-device and real-time. Out of scope.

## 6. Status

> **Built: §3's server-side surface. Not built: §4's device side.**
>
> The leasing engine, reconciliation, void-on-unused, lease expiry, delta sync
> and idempotent ingestion are implemented and verified against a live Postgres.
>
> The SQLite outbox, sync worker and mobile screens are **not** built.
> `apps/mobile` still has only template tabs, and the prerequisite this phase's
> own outline names — "at least one sector has a real mobile UI to sync" — is
> still unmet. What exists now is the half that a device integrates *against*,
> which is also the half that is genuinely hard: it is where the compliance
> guarantee lives, and it is testable without a device.
>
> Building the mobile client against an unverified leasing engine would have
> been the wrong order. Building it against this one is ordinary work.
>
> **Verified against a live Postgres**, including a bug the first run exposed:
> reconciliation originally trusted the device's `usedNumbers` list, so a device
> that claimed a number and never submitted its invoice left a **hole in the
> register** — precisely what leasing exists to prevent. The device's claim is
> now advisory: what counts as used is whether an invoice row actually exists,
> and any claimed-but-missing number is voided with that discrepancy named in
> the audit log.
>
> Confirmed: a lease advances the counter so a concurrent online sale cannot
> collide (block 2-6 leased, the online sale took #7); reconciling a block where
> nothing was submitted voids all five and the register runs 1-7 with no gaps;
> an outbox replay returns the original order and charges stock once; and delta
> sync returns a cursor that yields an empty second pull.
