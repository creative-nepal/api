# Product Features — Multi-Sector POS

> [!IMPORTANT]
> **Superseded — not the built model.** This document describes a
> *sector-as-subscription* tenancy model (one sector-less organization holding
> several sector subscriptions). What is actually built is the
> *sector-as-tenant* model: **one business = one Better Auth organization = one
> sector**, per `docs/system-design.md` and
> `docs/plans/2026-08-14-billing-phase1-foundation-mart.md`, which are
> authoritative wherever they disagree with this file.
>
> This is retained as product intent — the sector coverage, purchase cycle
> (§4), stock movements (§5) and credit/debit notes (§6) are still the target
> feature set, and §4–§6 have **no implementation yet** in any phase.
>
> Two things here are known to be unbuildable as written:
>
> 1. **§1.6's team-scoped sector roles do not exist in Better Auth.**
>    `teamMember` is `{ id, teamId, userId, createdAt }` — no `role` column —
>    and `hasPermission({ organizationId, ... })` takes no `teamId`. A user has
>    exactly one role per organization, so "`cashier` scoped to the mart team"
>    would make them a cashier in every sector. Adopting §1.2/§1.4's model would
>    require a hand-rolled `sector_membership` table and a custom guard,
>    abandoning Better Auth's access control.
> 2. **§1.4's `unique(organizationId, sectorId, active)` is not a constraint** —
>    there is no `active` column, and `status` has four values. It needs a
>    partial unique index with the live statuses named explicitly.
>
> Reconciling this file with the built model is its own pass. Fuller list of
> gaps in the analysis that produced this banner.

**This phase set:** POS, inventory, purchasing, multi-sector subscriptions.
**Deferred:** accounting — §8.

---

## 1. Account, Organization, Sector, Subscription

### 1.1 Account

| Field | Notes |
|---|---|
| `id` | |
| `email` | |
| `createdAt` | |

### 1.2 Organization

| Field | Notes |
|---|---|
| `id` | |
| `name` | legal/registered name |
| `panNumber` | |
| `vatRegistered` | bool |
| `address` | |
| `contact` | |
| `createdByAccountId` | fk → Account |
| `createdAt` | |

### 1.3 Sectors (catalog)

| Field | Notes |
|---|---|
| `id` | |
| `key` | `mart` \| `medical` \| `restaurant` |
| `name` | |

### 1.4 Subscriptions

One row = one organization's subscription to one sector.

| Field | Notes |
|---|---|
| `id` | |
| `organizationId` | fk → Organization |
| `sectorId` | fk → Sectors |
| `planId` | fk → Plans |
| `teamId` | fk → Better Auth team (staff scoping, §1.6) |
| `status` | `trialing` \| `active` \| `past_due` \| `canceled` |
| `currentPeriodStart` | |
| `currentPeriodEnd` | |
| `cancelAtPeriodEnd` | bool |

- unique(`organizationId`, `sectorId`, active) — one active subscription per org per sector.
- One organization can hold multiple subscriptions (mart + restaurant), each independent.

### 1.5 Plans

| Field | Notes |
|---|---|
| `id` | |
| `sectorId` | fk → Sectors |
| `key` | slug |
| `name` | |
| `priceCents` | |
| `currency` | |
| `billingCycle` | `monthly` \| `yearly` |
| `featureFlags` | jsonb |
| `isActive` | |

unique(`sectorId`, `key`).

### 1.6 Staff & Roles

| Field | Notes |
|---|---|
| Team | one per Subscription (org + sector), Better Auth `team` |
| Org owner | full access across all sectors |
| Sector roles | `owner` / `manager` / `cashier` + sector extras (`pharmacist`, `waiter`, `chef`), scoped to that sector's team |

- Invite: `inviteMember({ email, role, organizationId, teamId })`.
- Permission checks: Better Auth `hasPermission`, server-side.

---

## 2. Product Catalog

| Field | Notes |
|---|---|
| `id` | |
| `organizationId` | fk → Organization |
| `sectorId` | fk → Sectors |
| `name` | |
| `sku` | |
| `category` | |
| `image` | |
| `price` | |
| `costPrice` | system-maintained, §4.3 |
| `barcode` | |
| `stockQty` | |
| `unit` | `pcs` \| `kg` \| `gm` \| `ml` \| `l` |
| `isVatable` | bool |
| `isActive` | |
| `createdAt`, `updatedAt` | |

index(`organizationId`, `sectorId`) first.

### 2.1 Field requirement per sector

| Field | Mart | Medical | Restaurant |
|---|---|---|---|
| `barcode` | Required | Required | Optional |
| `unit` | Full range | Full range | Mostly `pcs` |
| `category` | Product category | Product category | Menu category |

---

## 3. Sales / POS

- cart → order (`pending` → `confirmed`) → invoice.
- One order → one invoice.
- Invoice number: unique, sequential, gapless — scoped per `organizationId` + `sectorId` + fiscal year.
- Order confirm: stock decreases per line item, same transaction as invoice issue.
- Invoice immutable — corrections via credit note only (§6).

---

## 4. Purchase Cycle

Supplier → Purchase Order (place → confirm → receive) → Stock In → Purchase Bill (independent timing).

### 4.1 Suppliers

| Field | Notes |
|---|---|
| `id` | |
| `organizationId` | |
| `sectorId` | |
| `name` | |
| `panNumber` | |
| `address` | |
| `contact` | |

### 4.2 Purchase Order

| Field | Notes |
|---|---|
| `id` | |
| `organizationId`, `sectorId` | |
| `supplierId` | fk → Supplier |
| `status` | `pending` → `confirmed` → `received` |
| `createdAt` | |

Status meaning:

| Status | Meaning | Stock effect |
|---|---|---|
| `pending` | order drafted/placed, not yet agreed | none |
| `confirmed` | agreed with supplier (qty/price locked) | none |
| `received` | goods physically arrived | stock increases (§4.4) |

### 4.2.1 Purchase Order Items

| Field | Notes |
|---|---|
| `id` | |
| `purchaseOrderId` | fk → Purchase Order |
| `productId` | fk → Product — what's actually being bought |
| `orderedQty` | |
| `receivedQty` | defaults 0, set on `received` |
| `purchasePrice` | per unit |
| `lineTotal` | |

### 4.3 Purchase Bill — separate from the Purchase Order

Supplier's bill/invoice for the goods. Decoupled because it can arrive **before, with, or after** goods receipt — not auto-generated at `received`, entered independently and linked back.

| Field | Notes |
|---|---|
| `id` | |
| `organizationId`, `sectorId` | |
| `supplierId` | fk → Supplier |
| `purchaseOrderId` | fk → Purchase Order (nullable — a bill can reference a PO or stand alone) |
| `billNumber` | supplier's own invoice/bill number |
| `billDate` | |
| `amount` | |
| `createdAt` | |

### 4.4 On PO status = `received`

- `stockQty` += `receivedQty` per line item.
- `costPrice` recalculated — weighted average:

  ```
  newCostPrice = (existingQty × existingCost + receivedQty × purchasePrice)
                 / (existingQty + receivedQty)
  ```

- Sale never changes `costPrice` — only `stockQty`.
- `price` never auto-adjusted by purchase.

---

## 5. Stock Movements

| Field | Notes |
|---|---|
| `productId` | |
| `organizationId`, `sectorId` | |
| `delta` | |
| `reason` | `sale` \| `purchase` \| `credit_note` \| `debit_note` \| `adjustment` |
| `referenceId` | |
| `createdAt` | |

---

## 6. Credit Notes / Debit Notes

| Type | Against | Effect |
|---|---|---|
| Credit note | Invoice | References original; own number from same sequence; optional restock |
| Debit note | Purchase bill | References original; optional destock; no retroactive cost recompute |

---

## 8. Accounting (Future Phase)

Deferred, not excluded. Source documents: invoices, purchase bills, credit/debit notes (§3, §4, §6).

- General ledger, double-entry journal postings.
- Chart of accounts per organization/sector.
- AR/AP, aging reports.
- Trial balance, P&L, balance sheet.
- Tax reports on top of §3's VAT data.
- Payment/receipt reconciliation.

Schema/module design deferred to its own pass.

---

## 9. Deliberate Scope Boundaries

- Organization-level bundled subscription — not built.
- Multi-warehouse stock within one sector — single stock pool.
- FIFO/LIFO/batch costing — weighted average only.
- Partial PO receiving / partial invoice payment — binary confirmed only.
