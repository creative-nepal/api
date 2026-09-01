# Multi-Sector Billing SaaS — Phase 3: Restaurant Sector

Supersedes the outline in `2026-08-14-billing-phase3-restaurant-sector.md`.

## Context

Third sector, on the foundation from Phase 1 (mart, built and verified) and the `SectorPlugin` interface extracted in Phase 2 (medical, built and verified). Implements `sector-feature-spec.html` §rest-flow, §rest-menu, §rest-kitchen, §rest-billing, §rest-analytics.

**This sector does not fit the shape the first two share, and pretending otherwise would be the main risk.** Mart and medical are both *staff creates the order, order is immediately billed*. The spec is explicit that restaurant "flips that". Four consequences drive the whole design:

1. **Order creation is decoupled from invoicing.** A customer places an order; it moves through a real state machine; billing happens later. Phase 1/2's checkout — allocate stock, insert order, issue invoice, all in one transaction — is the wrong shape here.
2. **Billing is per *table sitting*, not per order.** "Waiter or cashier opens the table → sees all orders/KOTs placed against it during the sitting", then bills them together. One invoice covers many orders.
3. **Menu items are not stock.** §rest-menu defines `menu_items` (name, category, price, modifiers, `is_available`, image) with no quantity. A burger is not stocked; its ingredients are, and ingredient-level inventory is not in this spec. So restaurant never touches `products`, and nothing is decremented at order time.
4. **Orders can originate from an unauthenticated customer.** A QR scan opens a table-bound session with no account. This is a genuinely new auth surface, not a Better Auth role.

## 1. Billing granularity: `order_items.invoiceId`

Phase 1's `business_invoices.orderId` is a single nullable FK — fine when one order maps to one invoice. A restaurant sitting is many orders to one invoice, and a *split* bill is one sitting to many invoices, divided **by item**. Split-by-guest-count is just a coarser partition of the same items.

So the link belongs at the line level: **`order_items.invoiceId` (nullable FK)**. `business_invoices.orderId` stays for mart/medical and is simply null on a table invoice.

This is additive. It is also the only workable place — an order-level link cannot express "these three dishes on invoice A, those two on invoice B" from the same order.

## 2. Order lines: menu items, not products

`order_items.productId` is currently `NOT NULL` referencing `products`. Restaurant lines reference `menu_items` instead. The change:

- `order_items.productId` → nullable.
- `order_items.menuItemId` → new, nullable FK.
- Exactly one of the two is set, enforced at the service layer (a Postgres CHECK is possible and worth adding later; the service is the layer that can produce a good error).

Relaxing `NOT NULL` is safe on existing data — every current row has a `productId`. `productName` stays required and keeps doing snapshot duty for both.

## 3. Schema — `apps/api/src/database/schema/restaurant.ts`

Tenant-scoped, `business_id` first, per the repo rule.

```
restaurant_tables
  id, businessId (fk), tableNo, seats (int), status ('empty'|'occupied'|'billed')
  assignedWaiterId (fk -> user, nullable), createdAt, updatedAt
  unique(businessId, tableNo)
  index(businessId, status)

menu_items
  id, businessId (fk), name, category, priceCents (int)
  modifiers (jsonb: [{ name, options: [{ label, priceDeltaCents }] }])
  isAvailable (bool)      -- the "86" switch
  imageUrl, station ('grill'|'drinks'|'dessert'|'main'|...) -- KOT routing
  createdAt, updatedAt
  index(businessId, category), index(businessId, isAvailable)

table_sessions          -- the QR surface; NOT a Better Auth session
  id, businessId (fk), tableId (fk)
  tokenHash (unique)     -- SHA-256 of a 32-byte random token; the raw token is
                            returned once and never stored
  expiresAt, revokedAt, createdAt
  index(businessId, tableId)

kitchen_tickets
  id, businessId (fk), orderId (fk), tableId (fk, nullable)
  station, status ('in_kitchen'|'preparing'|'ready'|'served')
  createdAt, updatedAt
  index(businessId, status), index(businessId, orderId)

kitchen_ticket_items
  id, businessId (fk), ticketId (fk), orderItemId (fk)
  status ('in_kitchen'|'preparing'|'ready'|'served')
  index(businessId, ticketId)
```

Additive to existing tables:

- `orders.tableId` (nullable FK), `orders.source` (`'staff'|'qr'`).
- `order_items.menuItemId`, `order_items.invoiceId`, `order_items.modifiers` (jsonb snapshot), `order_items.productId` relaxed to nullable.
- `orders.serviceChargeCents` and `business_invoices.serviceChargeCents` — §rest-billing requires a service charge line distinct from VAT. Defaults to 0, so mart/medical are unaffected.

**Service charge is applied before VAT**, matching Nepali restaurant practice (10% service charge, then 13% VAT on the total). The rate is a business-level setting, not hardcoded: `businesses.serviceChargePercent` (default 0).

## 4. The QR table session — a new auth surface, treated as one

A customer scans a table QR and orders with no account. That is an **unauthenticated write path into a tenant's data**, so it gets narrow, explicit limits rather than being folded into the existing guard chain:

- The QR encodes `businessId` + `tableId`. `POST /v1/public/table-sessions` exchanges those for a session: a 32-byte random token returned **once**, with only its SHA-256 stored.
- The token is short-lived (default 4 hours, a sitting) and revoked when the table is billed.
- A `TableSessionGuard` accepts it via `X-Table-Session` and attaches `{ business, table }`. It authorises **exactly three things**: read the menu, place an order on *its own* table, and read *its own* orders. Nothing else — no other table, no invoices, no products, no business settings.
- Rate-limited per table, and hard-capped on open orders per sitting, because this endpoint is reachable by anyone who can see the QR code.
- Orders from it carry `source: 'qr'` and `createdByUserId: null`; they are traceable to the table, which is what the spec asks for, not to a person.

The existing global `AuthGuard` is left alone — these routes are `@AllowAnonymous()` and guarded solely by `TableSessionGuard`.

## 5. Roles

Two new statement groups, granted per §rest-flow's role table:

```ts
table: ['manage']                  // waiter, manager, owner
kot:   ['view', 'update']          // chef, waiter, manager, owner
order: [..., 'confirm', 'serve']   // waiter, manager, owner
```

`chef` gets `kot: ['view','update']` and nothing else — the spec is explicit that "kitchen never sees pricing/billing". That is enforced by the KOT endpoints returning no money fields at all, not merely by hiding them in a UI.

`waiter` gets `order: ['create','confirm','serve']`, `table: ['manage']`, `kot: ['view']`.

## 6. Sector plugin: a billing-mode capability

The `SectorPlugin` interface gains one property rather than a new hook:

```ts
readonly billsOnCreate: boolean;   // mart/medical true, restaurant false
```

`OrdersService.checkout` already orchestrates: resolve lines → validate → insert order → issue invoice → `afterCheckout`. For restaurant it stops before issuing the invoice, leaving the order `placed` with no invoice. Billing is a separate flow (§7).

This keeps one code path rather than forking `OrdersService`, and it is honest about what actually differs: *when* the invoice is issued, not *how*.

## 7. Billing a table

`POST /v1/businesses/:businessId/tables/:tableId/bill`:

```
{ splits?: [ { orderItemIds: string[] } ] }   // omit for one bill for everything
```

For each split, in one transaction: sum its lines, apply the service charge, then VAT, call Phase 1's `InvoicesService.issue` **unchanged** (same gapless counter, same audit log, same conditional CBMS enqueue), and stamp `order_items.invoiceId`. Then flip the table to `billed` and revoke its session.

Guards: every referenced line must belong to that table's unbilled orders, and every line must be covered exactly once across splits — otherwise a split silently drops revenue.

## 8. KOT

Confirming an order generates one ticket per distinct `station` across its items. Chef moves a ticket (or an item) `in_kitchen → preparing → ready`; the waiter marks `served`. The order's own status is derived as the minimum across its tickets, so Phase 1's reserved superset state machine is finally used end to end.

## 9. Build order

1. `schema/restaurant.ts` + the additive columns; review generated SQL.
2. Roles (`table`, `kot`, extended `order`), mirrored in `apps/admin`.
3. `modules/tables/`, `modules/menu/` — plain tenant CRUD, including the 86 switch.
4. QR: `table_sessions` + `TableSessionGuard` + public menu/order endpoints. **Do this with the narrowest possible surface and test the negative cases first** — it is the only unauthenticated write path in the system.
5. Restaurant plugin: `billsOnCreate = false`, menu-item lines, modifier pricing.
6. KOT generation and status transitions.
7. Table billing with splits.
8. Analytics (§rest-analytics) and alerts.

## 10. Verification

> [!NOTE]
> **Status: all eight build-order steps complete, verified against a live Postgres.**
>
> A full sitting works end to end: QR scan seats the table, two orders across
> the sitting, confirm generates one KOT per station, the kitchen walks each
> ticket forward, a 2-way split produces two invoices from the shared gapless
> counter, every line is billed exactly once, the QR token stops working, and
> the table closes back to `empty`.
>
> **A real bug surfaced while verifying analytics and was fixed repo-wide.**
> `averageMinutes` came back as **-345** — exactly Nepal's UTC offset. Every
> `timestamp` column was naive: `defaultNow()` wrote the database session's wall
> clock while Drizzle's `$onUpdate` wrote UTC, so the two columns on the same row
> disagreed by the server's offset and any duration between them was wrong. This
> predates Phase 3 — it has been in the schema since Phase 1. All 58 timestamp
> columns across `auth.ts`, `billing.ts`, `medical.ts` and `restaurant.ts` are now
> `timestamptz`; durations are correct and the column type is verified as
> `timestamp with time zone`.
>
> Security negatives on the QR surface, all passing: an invalid token, a missing
> header, and an attempt to reach an authenticated business route all return 401;
> a QR body **cannot even carry `tableId`** (the global `forbidNonWhitelisted`
> rejects it outright), so the table always comes from the session; the raw token
> is never stored, only its SHA-256; and the token is revoked the moment the
> table is billed. Split validation rejects both an incomplete split and a
> duplicated line, and issues nothing in either case.
>
> Cross-sector regression: mart still bills on create with an independent gapless
> counter (mart #1 while restaurant was at #2), stock decrements, service charge
> stays 0. Full suite 24/24 with `TEST_DATABASE_URL`.

## 10. Verification

- Integration (`TEST_DATABASE_URL`, following Phase 1/2): a full sitting — QR session → two orders → confirm → KOT states → split bill → two invoices from the same gapless counter, with every line billed exactly once.
- Negative security tests for the QR session: cannot read another table, cannot bill, cannot touch products, expires, revoked on billing.
- Regression: mart and medical checkout must be unchanged by the `billsOnCreate` split.

## 11. Not in this phase

- Ingredient-level inventory / recipes. Menu items are not stocked; consuming ingredients when a dish sells is a real feature but is not in `sector-feature-spec.html` and would be its own design.
- Kitchen display *client* (screen/printer integration). The API exposes ticket state; rendering it is a device concern.
- Real-time push to kitchen/waiter (WebSocket/SSE). Polling is adequate at this stage; Phase 4's sync work is the natural place to revisit transport.
- Payment capture. Table flips to `billed` on invoice; confirming payment is Phase 5's gateway work.
