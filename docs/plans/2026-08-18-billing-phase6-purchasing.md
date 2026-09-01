# Multi-Sector Billing SaaS — Phase 6: Purchasing & Supplier Side

Closes item 1 of `docs/gap-analysis.md` §4 — "the biggest structural gap, since `products.stockQty` has no documented 'how does stock get in' path". Implements `docs/features.md` §4 (purchase cycle) and the cost half of §2, with the corrections noted below.

## Context

Every phase so far models the **sales** side. Stock leaves — through checkout, FEFO dispensing, adjustments — but the only way it ever *enters* is a manual `stock_adjustment`. A shop cannot run on that: it buys from suppliers, against orders, and pays against bills that arrive on their own schedule.

Two consequences beyond the obvious:

1. **There is no cost anywhere.** `products` has a price but no `costPrice`, so the system cannot report margin — the number a shopkeeper actually cares about. Only `product_batches.costPriceCents` exists, and only for medical.
2. **There is no purchase register.** Phase 1 built the Annexure 13 *sales* register (Bikri Khata). IRD's rule covers both; the purchase side (Kharid Khata) needs purchase data that does not exist yet.

## 1. Corrections to `features.md` §4

The spec has four problems this design fixes rather than inherits:

**The weighted-average formula divides by zero.**

```
newCostPrice = (existingQty × existingCost + receivedQty × purchasePrice)
               / (existingQty + receivedQty)
```

With `existingQty = 0, receivedQty = 0` that is NaN; with `existingQty < 0` (oversold) it produces garbage. Guarded: when existing stock is zero or negative, the new cost **is** the purchase price. There is nothing to average against.

**`receivedQty` contradicts "binary receiving only".** §4.2.1 gives every line an `orderedQty` *and* a `receivedQty`; §9 says partial receiving is out of scope. Those cannot both hold — a `receivedQty` that is only ever `0` or `orderedQty` is a field that lies. **Partial receiving is supported**, because it is what the field means and what actually happens when a supplier ships short.

**A purchase bill with a single `amount` cannot produce a purchase register.** VAT input credit and Kharid Khata both need per-line taxable value and VAT. The bill gets line items.

**Nothing stops a supplier's bill being entered twice.** `unique(businessId, supplierId, billNumber)`.

Two things deliberately *not* fixed, and stated so they are choices rather than oversights: **landed cost** (freight, duty) is excluded from the weighted average — cost is the purchase price only; and **unit conversion** (buy a sack, sell by the kilo) is not modelled, so a purchase must be recorded in the product's own selling unit.

## 2. Receiving into batches, for medical

A pharmacy does not receive "50 units of Amoxicillin" — it receives a batch with a number and an expiry. So for a medical business, a received line **creates a `product_batches` row** rather than incrementing `products.stockQty` directly, and the batch total invariant from Phase 2 does the rest.

This is the integration point that makes purchasing real for medical rather than a parallel stock path. Purchase-order lines therefore carry optional `batchNo`/`expiryDate`, required when the business is medical.

## 3. Schema — `apps/api/src/database/schema/purchasing.ts`

```
suppliers
  id, businessId (fk), name, panNumber, address, contact, isActive
  index(businessId, isActive)

purchase_orders
  id, businessId (fk), supplierId (fk), reference
  status ('pending'|'confirmed'|'partially_received'|'received'|'canceled')
  orderedAt, expectedAt, receivedAt, createdByUserId
  index(businessId, status), index(businessId, supplierId)

purchase_order_items
  id, businessId (fk), purchaseOrderId (fk), productId (fk)
  orderedQty, receivedQty (default 0)
  purchasePriceCents, lineTotalCents
  batchNo, expiryDate            -- medical; required for that sector
  index(businessId, purchaseOrderId)

purchase_bills                    -- the supplier's own invoice
  id, businessId (fk), supplierId (fk)
  purchaseOrderId (fk, nullable)  -- a bill may arrive before, with, after, or
                                     without any PO
  billNumber, billDate, dueDate
  subtotalCents, vatCents, totalCents
  status ('unpaid'|'partially_paid'|'paid')
  paidCents
  unique(businessId, supplierId, billNumber)
  index(businessId, status)

purchase_bill_items               -- what makes the purchase register possible
  id, businessId (fk), purchaseBillId (fk), productId (fk, nullable)
  description, quantity, unitPriceCents, vatCents, lineTotalCents
  index(businessId, purchaseBillId)
```

Additive: **`products.costPriceCents`** (default 0), maintained by receiving, never by a sale. Phase 1's rule that a sale changes `stockQty` and nothing else still holds.

## 4. Receiving

`POST /v1/businesses/:id/purchase-orders/:poId/receive` with per-line quantities. In one transaction:

1. Increment `receivedQty` per line, rejecting more than was ordered.
2. **Medical**: create or top up the named batch, then re-sync `products.stockQty` from batches. **Otherwise**: increment `products.stockQty` directly.
3. Recompute `costPriceCents` as the weighted average, guarded per §1.
4. Write a `stock_adjustment` with reason `stock_in`, so Phase 2's ledger remains the single record of every stock change.
5. Move the PO to `partially_received` or `received`.

Step 4 matters: purchasing must not become a second, invisible stock path.

## 5. Purchase register

`GET /v1/businesses/:id/purchases/register?fiscalYear=&format=xlsx|csv` — the Kharid Khata counterpart to Phase 1's sales register, built from `purchase_bill_items`: date (BS and AD), supplier name and PAN, bill number, taxable purchase, VAT, exempt purchase. Same ExcelJS path as the sales register.

## 6. Status

> **Built and verified against a live Postgres.**
>
> Supplier → purchase order → confirm → **partial receive** → weighted-average
> cost → decoupled bill → payment → Kharid Khata export, plus the medical batch
> path.
>
> Confirmed: receiving 4 of 10 into an empty product sets cost to the purchase
> price (the formula in `features.md` §4.4 would divide by zero here); receiving
> the remaining 6 at a higher price gives **4@800 + 6@1000 = 920.00**, weighted
> by quantity rather than averaged evenly; over-receiving is rejected; every
> receipt writes a `stock_in` row to Phase 2's ledger so purchasing is not a
> second stock path; a duplicate supplier bill number is refused with 409;
> overpayment is refused; and the register exports valid `.xlsx`/CSV with
> Devanagari headers and correct taxable/VAT columns.
>
> Medical: a purchase line without `batchNo`/`expiryDate` is rejected, and
> receiving creates the batch, links it in the ledger, and re-syncs
> `products.stockQty` from batches — so purchasing feeds FEFO rather than
> bypassing it.
>
> `products.costPriceCents` now exists and the API returns `marginCents`
> (null until a cost is known, rather than a misleading zero).
>
> **TDS** (`gap-analysis.md` §1) shipped alongside: withholding on purchase
> bills, with the **rate entered rather than derived** — Nepal's TDS rates vary
> by payment type and change by IRD notice, so hardcoding a table would repeat
> the mistake `cbmsRequired` avoids. TDS is computed on the taxable base, not on
> VAT, since the deduction is against the supplier's income. Verified: a
> Rs 50,000 rent bill at 10% withholds Rs 5,000; **paying the full total is
> refused** because TDS is withheld rather than paid out; paying the net settles
> the bill; a bill with no TDS is unaffected; and the return exports only bills
> that actually withheld, with a payee missing a PAN marked `MISSING` rather
> than left blank.
>
> **Transaction-volume pricing** (`gap-analysis.md` §4 item 2) shipped alongside:
> `plans.featureFlags.maxInvoicesPerPeriod`, enforced in `InvoicesService.issue`
> — the one method every sector's invoice passes through. Verified: a 3-invoice
> plan issues 1, 2, 3 then returns 403 on the fourth, **with stock rolled back
> and the invoice counter not burned**.

## 7. Not in this phase

- **Supplier payments/ledger ageing.** `paidCents` and `status` exist; a payments table and AP ageing belong with accounting.
- **Landed cost, unit conversion** — §1.
- **Debit notes** (`features.md` §6's purchase-side correction). The sales-side credit note exists; the purchase-side mirror needs supplier-return semantics that are cleaner once payments exist.
- **Accounting, TDS, payroll** — `gap-analysis.md` §1 items that remain open after this phase.
