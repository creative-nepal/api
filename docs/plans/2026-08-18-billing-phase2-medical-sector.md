# Multi-Sector Billing SaaS — Phase 2: Medical Sector

Supersedes the outline in `2026-08-14-billing-phase2-medical-sector.md`, which deferred "full schema design, module breakdown, guard/entitlement integration details, build order, frontend slice, and verification plan" to this pass.

## Context

Second sector on the foundation delivered by Phase 1 (`2026-08-14-billing-phase1-foundation-mart.md`, built and verified end to end). Implements `sector-feature-spec.html` §medical-product, §medical-extra, §medical-roles.

Phase 1 is deliberately mart-only: `OrdersService.beforeCreate` throws for any sector other than `mart`. This phase makes that branch real.

**What Phase 1 already provides and this phase does not touch**: tenancy, subscriptions/entitlements, the guard chain, and — critically — the whole invoicing engine. Gapless numbering, VAT breakdown, the audit log, credit notes, and CBMS enqueueing are sector-agnostic and are reused unchanged. A pharmacy invoice is the same `business_invoices` row a mart invoice is.

## 1. The decision Phase 1 deferred: batches are a real table, not jsonb

Phase 1 put sector-specific fields in `products.sectorData jsonb` and explicitly flagged batches as the thing to revisit "once Phase 2 exists, particularly if `batches[]` querying (FEFO sorting, expiry filtering) proves painful as jsonb". It does. **Batches get their own table.** Three reasons, in order of weight:

1. **Concurrency.** Phase 1's oversell safety is a single conditional `UPDATE products SET stock_qty = stock_qty - $qty WHERE ... AND stock_qty >= $qty RETURNING`. The row lock *is* the guarantee. There is no equivalent for one element inside a jsonb array — two pharmacists dispensing the same batch would read-modify-write the whole array and one would silently clobber the other. FEFO makes this worse, not better: both are steered to the *same* nearest-expiry batch.
2. **FEFO is a sort, and expiry is a filter.** `ORDER BY expiry_date` across every batch of a product, with `expiry_date > now()` excluded, is an index lookup against a real column and a sequential scan plus per-row jsonb parsing against a jsonb array.
3. **The controlled-substance register must reference a specific batch by identity.** A jsonb array element has no stable identity to point at.

`sectorData` still carries the flat medical fields (`genericName`, `manufacturer`, `schedule`) — those are per-product scalars, queried rarely, and fit exactly the case jsonb was chosen for.

### Stock: batches are the source of truth, `products.stockQty` stays as a cached total

Medical stock lives in `product_batches.qty`. `products.stockQty` is **maintained as the sum of non-expired batch quantities, in the same transaction as every batch mutation**. It is not dropped, for three reasons: the low-stock query stays a single-table scan, mart and medical keep one uniform shape for reporting and the admin UI, and Phase 1's `ProductResponseDto.isLowStock` keeps working untouched.

The invariant — *every* batch mutation updates the parent total atomically — is the thing to hold the line on in review. It is the medical equivalent of Phase 1's business_id-first index rule.

## 2. Schema — `apps/api/src/database/schema/medical.ts`

Barrel-exported from `schema/index.ts` alongside `auth.ts`/`billing.ts`. Every table is tenant-scoped and indexes `business_id` first, per the repo-wide rule.

```
product_batches
  id, businessId (fk), productId (fk -> products, cascade)
  batchNo, expiryDate (date), qty (numeric), costPriceCents (int)
  isActive (bool)   -- set false on write-off, never deleted
  createdAt, updatedAt
  unique(businessId, productId, batchNo)
  index(businessId, productId, expiryDate)   -- the FEFO index

prescriptions
  id, businessId (fk), orderId (fk, nullable until checkout commits)
  doctorName, patientName, attachmentUrl (text — object-storage ref, not a blob)
  createdAt
  index(businessId, orderId)

controlled_substance_register        -- append-only, no update/delete at any layer
  id, businessId (fk), orderId (fk), invoiceId (fk), productId (fk), batchId (fk)
  quantity (numeric), buyerName, buyerIdType, buyerIdNumber
  prescriptionId (fk, nullable), dispensedByUserId (fk -> user)
  createdAt
  index(businessId, createdAt), index(businessId, productId)

insurance_claims
  id, businessId (fk), orderId (fk), invoiceId (fk, nullable)
  provider, policyNumber, claimedAmountCents (int)
  status ('draft'|'submitted'|'approved'|'rejected')
  createdAt, updatedAt
  index(businessId, status)

stock_adjustments                    -- append-only ledger, new in this phase
  id, businessId (fk), productId (fk), batchId (fk, nullable)
  delta (numeric), reason ('recount'|'damaged'|'expired_write_off'|'customer_return'|'stock_in')
  note, actorUserId (fk -> user)
  createdAt
  index(businessId, createdAt), index(businessId, reason)
```

**`stock_adjustments` fixes a Phase 1 hole, not just a medical requirement.** Phase 1's `PATCH /products/:id/stock` accepts a `reason` string and then discards it — the adjustment is unattributable after the fact. §medical-extra requires "returned by customer", "damaged" and "expired write-off" to be *distinguishable in reports* because they carry different regulatory and accounting treatment. Making the ledger real serves both, and it is the natural precursor to `docs/features.md` §5's `stock_movements`.

**One additive change to an existing table**: `order_items.batchId` (nullable fk). Mart leaves it null; medical records which batch was dispensed. Nullable and additive, so no migration risk to Phase 1 data.

## 3. Roles — dispensing needs its own statement

§medical-roles: "pharmacist — only role that can dispense prescription/controlled items", and explicitly, "a plain cashier role (fine for mart) isn't sufficient here."

Phase 1's `order: ['create']` is held by owner, manager **and** cashier, so it cannot express this. Add one statement to the organization-scoped set in `auth/access-control.ts`:

```ts
dispense: ['prescription', 'controlled']
```

Granted to `owner` and `pharmacist` only — deliberately **not** `manager` (inventory/staff authority is not dispensing authority) and not `cashier`. `pharmacist` otherwise keeps Phase 1's `order:['create']` + `invoice:['issue','print']`, so an OTC-only sale needs no new permission.

Enforcement is in the checkout service, not a route guard: whether a permission is required depends on the *contents of the cart*, which a guard cannot see. The service calls Better Auth's `hasPermission` with the acting session — the same authority the guards use, just invoked once the line items are known. Mirrored in `apps/admin/src/lib/access-control.ts` as always.

## 4. Sector plugins — extract the interface now

Phase 1 hard-coded mart and named its service methods after the target hook names precisely so this would be mechanical. With a second sector there is finally a second data point to validate the shape against.

```
modules/orders/sector-plugins/
  sector-plugin.interface.ts   beforeCreate / onLineItemAdd / beforeCheckout / afterCheckout
  mart.plugin.ts               Phase 1 behaviour, lifted verbatim
  medical.plugin.ts            FEFO allocation, expiry block, prescription + dispense gating
  registry.ts                  sector -> plugin
```

`OrdersService` resolves the plugin from `business.sector` and orchestrates the transaction; it stops containing sector logic itself. One hook is added beyond Phase 1's four: **`afterCheckout(ctx)`**, running inside the same transaction after the invoice is issued — medical needs the invoice id to write the controlled-substance register and the insurance claim, which is not available at `beforeCheckout`. Phase 1's `invoiceLineBuilder` stays a private helper on the service rather than becoming a hook; no sector has yet needed to vary it.

## 5. Checkout, medical path

Extends Phase 1's single transaction. The added steps, in order:

1. **`beforeCreate`** — reject if the business sector is not medical (unchanged shape).
2. **`onLineItemAdd`**, per line — resolve the product, then allocate from batches instead of decrementing `products.stockQty` directly:
   - Candidate batches: `WHERE business_id AND product_id AND is_active AND qty > 0 AND expiry_date > CURRENT_DATE ORDER BY expiry_date ASC` — the **expired-batch block is the SQL predicate**, so it cannot be bypassed by a caller that forgets a check.
   - Allocate FEFO across as many batches as the quantity needs, each via the same conditional `UPDATE ... WHERE qty >= n RETURNING` pattern Phase 1 uses. Insufficient total → 409, whole transaction rolls back.
   - A pharmacist may override the suggestion by passing an explicit `batchId` on the line; the expiry and quantity predicates still apply.
   - Decrement `products.stockQty` by the same total, in the same transaction.
3. **`beforeCheckout`** — cart-level rules:
   - any line with `schedule` of `prescription` or `controlled` → require `dispense:prescription` / `dispense:controlled` via `hasPermission`, else 403.
   - the same lines require an attached prescription (doctor name + patient name + attachment ref), else 400.
   - Phase 1's buyer-PAN-above-NPR-10,000 rule still applies, unchanged.
4. **`afterCheckout`** — with the invoice id in hand: append a `controlled_substance_register` row per controlled line, link the prescription to the order, and create an `insurance_claims` row when the order carries provider/policy.

Because all of this is inside Phase 1's existing `db.transaction`, a failure at step 3 or 4 rolls back the batch allocation too — the same property already verified for the PAN rule.

## 6. Modules

- **`modules/batches/`** — batch CRUD under `/v1/businesses/:businessId/products/:productId/batches`, plus `GET /v1/businesses/:businessId/batches/expiring?withinDays=` for the expiry dashboard. Guarded by `product:['create'|'update']`.
- **`modules/stock-adjustments/`** — `POST /v1/businesses/:businessId/stock-adjustments` with reason codes, writing the ledger and mutating batch/product quantities atomically. Phase 1's `PATCH /products/:id/stock` is re-pointed at this service so mart gets the ledger for free.
- **`modules/medical/`** — prescriptions, the controlled register (read-only listing; writes only via checkout), insurance claims, and the regulatory export.
- **Regulatory export** — `GET /v1/businesses/:businessId/medical/reports/batch-wise?fiscalYear=&format=xlsx|csv`, reusing `RegistersService`'s ExcelJS approach with batch/schedule/expiry columns added.

## 7. Build order

1. `schema/medical.ts` + `order_items.batchId` → review generated SQL for the business_id-first rule.
2. `access-control.ts`: `dispense` statement, granted to owner/pharmacist; mirror in `apps/admin`.
3. `modules/batches/` + the batch↔product total invariant, tested standalone.
4. Sector-plugin extraction: interface, `mart.plugin.ts` (behaviour-preserving — Phase 1's verified checkout must still pass unchanged), registry. **Do this before writing any medical checkout logic**, so the refactor is provably neutral.
5. `medical.plugin.ts`: FEFO + expiry block.
6. Prescription + dispense gating; controlled register; insurance claims.
7. `modules/stock-adjustments/`, re-pointing Phase 1's stock endpoint.
8. Regulatory export.

## 8. Verification

> **Status: all eight build-order steps complete, verified against a live Postgres.**
>
> Verified by driving the running API (all passing): FEFO split 3 units from the
> nearest-expiry batch then 1 from the next; `products.stockQty` tracked the
> batch total through every mutation; an expired batch holding 100 units stayed
> completely invisible to dispensing; a prescription item without an attached
> prescription 400'd **with batch quantities rolled back**; a `cashier` was
> refused a prescription sale (403) while still selling OTC (201); the controlled
> register and insurance claim were written with the correct buyer identity; and
> the Phase 1 mart flow reproduced its earlier results exactly after the plugin
> extraction.
>
> Steps 7–8 additionally verified: reason-coded adjustments write the ledger and
> move batch and product quantities together (20 → 18 → 16); an adjustment
> without a `batchId` is refused for a batch-tracked sector; Phase 1's
> `PATCH /products/:id/stock` still answers on its original URL but now routes
> through the ledger; and the batch-wise report exports valid `.xlsx`/CSV with
> dispensed/remaining quantities and invoice numbers per batch.
>
> **Automated coverage**: `medical-dispensing.integration.spec.ts` asserts FEFO
> ordering, exclusion of expired stock even when a batch is named explicitly,
> no-oversell under 10 concurrent dispenses of a 3-unit batch, and the
> batch↔product total invariant. Full suite: 24 passing with `TEST_DATABASE_URL`.

- Unit: FEFO ordering, expiry exclusion at the boundary date, multi-batch allocation arithmetic, the batch→product total invariant.
- Integration (needs Postgres — Phase 1's harness pattern, `TEST_DATABASE_URL`): concurrent dispensing of the same batch must not oversell, mirroring Phase 1's concurrent-numbering test; expired batches must be unsellable; a rejected prescription/dispense check must roll back batch allocation.
- Regression: Phase 1's verified mart flow must pass unchanged after the step-4 refactor.

## 9. Not in this phase

- Restaurant sector (Phase 3), offline sync (Phase 4), platform billing (Phase 5).
- Tenant-facing pharmacy UI. Admin gains nothing this phase; the medical surfaces are staff-facing and belong to the same deferred tenant app as mart's POS.
- Prescription image storage. `attachmentUrl` holds a reference; no object-storage integration exists yet, and inventing one here would prejudge Phase 5's storage decision.
- Insurance claim *submission* to any provider. The linkage and status field exist; there is no integration.
