# Gap Analysis — Existing Nepal Billing Software vs. This Plan

> [!NOTE]
> **Re-assessed 2026-08-18, after Phases 1–6 were built.** This document was
> written against *plans*; much of it now describes shipped code. Current status
> of §1's gaps:
>
> | Gap | Status |
> |---|---|
> | Purchasing / GRN / supplier ledger | **Closed** — Phase 6 (`2026-08-18-billing-phase6-purchasing.md`): suppliers, purchase orders, partial receiving, weighted-average costing, decoupled bills with line items, and the Kharid Khata purchase register. `products.costPriceCents` now exists, so margin is reportable for the first time. |
> | Transaction-volume pricing | **Closed** — `plans.featureFlags.maxInvoicesPerPeriod`, enforced at issue time by `EntitlementsService`. |
> | Barcode checkout for medical | **Closed in practice** — medical products carry `sku` and the POS searches name-or-SKU, so strip-level codes work. The original "no barcode" assumption was indeed too strong. |
> | Multi-branch consolidated reporting | Still open. `teams` remains unused; Phase 3 did not consume it. |
> | TDS | **Closed** — withholding on purchase bills (rate entered, not hardcoded), payable netted against it, and a filable TDS return export. |
> | General ledger / double-entry | **Decided non-goal**, now recorded in `system-design.md` §10 with its reasoning and its cost, per §4 item 5's request for a deliberate decision rather than a silent absence. |
> | Payroll | **Decided non-goal**, same place. Shares almost no machinery with anything here. |
>
> §2 is now almost entirely shipped rather than scheduled: batch/expiry + FEFO
> (Phase 2), KOT/tables/split-bill (Phase 3), multi-payment and the gateway seam
> (Phase 5), low-stock alerts, and the "bare stock-in adjustment, never schema'd"
> complaint (Phase 2's `stock_adjustments` ledger, extended by Phase 6).

Feature-by-feature comparison of real, currently-marketed Nepal billing/POS/accounting software against `docs/system-design.md` and the `docs/plans/2026-08-14-billing-phase{1..5}-*.md` plan set. Purpose: identify what competitors ship that isn't in the plan anywhere (not even a later phase), versus what's already covered but just scheduled for a later phase, versus genuine differentiation. This is a planning input, not a plan itself — where it recommends adding scope, that belongs in a phase doc, not here.

## Competitors researched

| Product | Segment | Sources |
|---|---|---|
| RestroX | Restaurant POS | [restrox.com/np](https://www.restrox.com/np) |
| Hamro SAN | Retail + restaurant all-in-one | [hamrosan.com](https://hamrosan.com/), [Help Center](https://sansolution.tawk.help/article/hamro-san-nepal%E2%80%99s-most-trusted-all-in-one-business-software-for-restaurants-and-retail), [SoftwareSuggest listing](https://www.softwaresuggest.com/hamro-san) |
| Pharma Care | Pharmacy/medical | [pharmacarenepal.com](https://www.pharmacarenepal.com/) |
| OneFlow | Accounting + IRD e-billing | [oneflowerp.com](https://oneflowerp.com/2025/08/06/oneflow-nepals-ird-approved-e%E2%80%91billing-accounting-software-for-2025/), [oneflow.pro](https://www.oneflow.pro/) |
| Tigg | Cloud accounting + billing + inventory + POS | [tiggapp.com](https://tiggapp.com/) |
| BUSY Software Nepal | IRD-verified billing, comparison hub | [busysoftwarenepal.com](https://busysoftwarenepal.com/blog/best-ird-billing-software-nepal-2026/) |
| M AND R Solution (MrSolution) | Trading/wholesale ERP | [mrsolution.com.np](https://mrsolution.com.np/) |
| Lekhapal | Web accounting, VAT/TDS | [lekhapalaccount.com](https://lekhapalaccount.com/accounting-software-in-nepal) |
| Nepal E-Billing, Nepazon, Smart POS | Pricing/tiering reference | [Nepal E-Billing pricing](https://busysoftwarenepal.com/blog/best-ird-billing-software-nepal-2026/), [Nepazon](https://nepazon.com/), [Smart POS](https://smartpossoftware.com/pages/tag/nepal/) |

---

## Summary verdict

The plan's **core invoicing/compliance engine is at parity or ahead** of what's marketed (gapless numbering with a real atomic-lock implementation, full audit trail, credit-note-only corrections — most competitor marketing copy doesn't go into this level of implementation detail, so this plan's rigor here is a genuine strength, not just a match). The **sector feature depth for mart/medical/restaurant is comparable** once Phases 2–3 land. The real gaps are almost entirely **outside the sector modules**: full double-entry accounting, purchasing/supplier-side workflows, payroll, and the business model (pricing/packaging) — none of which exist anywhere in the plan set, not even as a deferred phase.

---

## 1. Features competitors have that this plan has nowhere (not even a later phase)

These are missing from `docs/system-design.md` §10 and all five phase docs entirely — not deferred, just absent.

| Feature | Who has it | Why it's a real gap |
|---|---|---|
| **General ledger / double-entry accounting** | OneFlow, Tigg, Lekhapal, MrSolution — every full-suite competitor | This plan's `business_invoices` records sales but there's no chart of accounts, journal entries, trial balance, or P&L. Competitors position billing as *one module of* an accounting suite, not a standalone POS. A business using this system would still need separate accounting software or a bookkeeper doing manual entry from invoice exports — a real adoption friction. |
| **TDS (Tax Deducted at Source) calculation/reporting** | MrSolution, Lekhapal, BUSY — explicitly listed as required alongside VAT/Annexure 13 | The plan covers VAT (13%) thoroughly but has zero mention of TDS anywhere, despite it being bundled with VAT/Annexure-13 reporting in every competitor's compliance pitch. This is a real IRD-adjacent compliance surface, not a nice-to-have feature. |
| **Purchasing side: GRN (Goods Receipt Note), purchase orders, supplier ledger** | Pharma Care ("GRN and sales aligned"), MrSolution, Tigg (warehouse transfers) | This plan only models the sales side (`orders`/`business_invoices`). There's no `suppliers`, `purchase_orders`, or `goods_receipts` table anywhere, and `products.stockQty` has no documented mechanism for how stock *enters* the system other than a bare "stock-in" adjustment mentioned in the original HTML design doc — never schema'd. Pharma Care markets GRN↔sales alignment as core to avoiding "stock surprises"; this plan has no equivalent. |
| **Payroll** | Oneflow ("payroll processing" listed as a core accounting feature) | Not mentioned anywhere in this plan set. Given staff/role management already exists via Better Auth `member`, payroll is a plausible adjacent module competitors bundle that isn't even flagged as a non-goal. |
| **Multi-branch consolidated reporting** | OneFlow ("multiple branch management... combined reports"), MrSolution, Tigg ("track inventory at different locations, transfer between warehouses") | Partially addressed — `docs/system-design.md` flags multi-branch as future work via Better Auth `teams`, and the invoice-numbering-prefix implication is noted. But *reporting* across branches (a combined P&L/sales view) isn't mentioned at all, only the tenancy mechanism. |
| **Barcode/QR-based checkout as a cross-sector default** | Hamro SAN, Pharma Care ("scan packs and strip codes"), RestroX (QR menus) | The plan has barcode scanning for mart only (`products.sku`); Pharma Care explicitly does barcode-friendly checkout for medical too (strip-level codes), which contradicts this plan's Phase 2 assumption ("medical sale is stock lookup by name/batch, not scan" — inherited from the original HTML spec). Worth re-checking that assumption against real pharmacy workflows before Phase 2 is designed in full. |
| **Explicit pricing/packaging model** | Nepal E-Billing, Tigg, Nepazon — all publish tiered annual pricing keyed to **transaction volume** (e.g. Tigg: 30k/50k/200k transactions per year across three tiers), not just feature-flag tiers | `plans.featureFlags` (Phase 1 schema) only gates *features* (maxStaff, etc.) — there's no transaction-volume dimension anywhere in the plan, despite every researched competitor pricing primarily on transaction volume, not (or not only) feature access. This is a business-model gap, not just a technical one. |

---

## 2. Features competitors have that this plan already covers (just scheduled later)

No action needed here beyond confirming the phase docs still account for them — listed for completeness so nothing gets rediscovered as "missing" later.

| Feature | Competitor | Plan coverage |
|---|---|---|
| Batch/expiry tracking, FEFO | Pharma Care | Phase 2 (medical sector) — `sector-feature-spec.html` §medical-*, already detailed in the Phase 2 outline. |
| KOT, table management, split-bill | RestroX, Hamro SAN | Phase 3 (restaurant sector) — already detailed in the Phase 3 outline. |
| Low-stock / expiry alerts | Pharma Care, Hamro SAN | `sector-feature-spec.html` §mart-analytics / §medical-extra; not yet schema'd into a Phase 1 module but the trigger data (`lowStockThreshold`, `expiry_date` in `sectorData`) exists. |
| Multi-payment method (cash/card/QR/wallet) | Hamro SAN, RestroX | `orders`/`business_invoices` schema is payment-method-agnostic already; actual gateway integration (eSewa/Khalti) is correctly scoped to Phase 5. |
| Multi-branch/location | OneFlow, MrSolution, Tigg | Explicitly flagged in `docs/system-design.md` §10 as future work via Better Auth `teams` — not built, but not forgotten either. |
| IRD-approved / CBMS-compliant billing | Every competitor markets this as a headline claim | This plan's invoicing engine (§6 of system-design.md) is arguably more rigorous than most competitor marketing copy discloses — the gap here is the **formal IRD approval process**, already flagged as a non-engineering prerequisite in Phase 1's plan and system-design.md §10. |
| Nepali calendar / Bikram Sambat throughout UI | OneFlow, Hamro SAN | Fiscal-year BS handling is designed into `invoice_counters`; broader BS-calendar UI conventions (date pickers, etc.) aren't explicitly called out but `packages/utils` already has `date-fns`-based formatters as a base to extend. |

---

## 3. Where this plan is ahead of what's marketed

Worth stating explicitly, not just gaps in one direction:

- **Atomic, row-locked invoice numbering** (`UPDATE invoice_counters ... RETURNING`, inside the checkout transaction) — competitor marketing copy claims "sequential, gapless" numbering universally, but none publish *how* they guarantee it under concurrent checkouts. This plan's mechanism is specified precisely enough to actually verify (the concurrent-increment stress test called out in Phase 1's plan).
- **No-hard-delete + credit-note-only correction model with a full audit log** — a specific, auditable design, not just a marketing claim.
- **Turnover/sector-gated CBMS logic** (`cbmsRequired` flag) — this plan is more *correct* than the implicit assumption in the original design docs (and arguably than some competitor messaging, which tends to blanket-market "CBMS integrated" without clarifying it's threshold-gated by IRD rule).
- **Multi-tenant account→business model** (one login, many businesses, shared wallet) — none of the researched competitors appear to offer this Google-Workspace-style structure; they're single-business-per-account tools. This is a genuine differentiator, not just parity.

---

## 4. Recommended follow-ups (not decided here — for discussion)

These are gap-analysis outputs, not commitments. Given the "foundation first" phasing already chosen, most of these should become **new phase docs** rather than retrofitted into Phase 1:

1. **A new phase for purchasing/supplier-side workflows** (GRN, purchase orders, supplier ledger) — currently the biggest structural gap, since `products.stockQty` has no documented "how does stock get in" path beyond a vague manual adjustment.
2. **Revisit pricing model** — whether `plans` should gain a transaction-volume dimension alongside `featureFlags`, matching how every researched competitor actually prices. This affects Phase 5 (platform billing) design, not Phase 1's schema, so it's low-cost to decide later — but worth deciding before Phase 5 is fully designed, not after.
3. **TDS reporting** — likely belongs alongside the Annexure 13/register export already added to Phase 1's `modules/invoices/`, since it shares the same underlying data and export mechanism.
4. **Re-verify the medical "no barcode" assumption** (inherited from `sector-feature-spec.html`) against Pharma Care's barcode-at-strip-level checkout before Phase 2 is designed in full — the assumption may be wrong, not just incomplete.
5. **Accounting/ledger and payroll** — the largest scope additions here, and likely out of scope for this product's positioning entirely (a billing/POS system vs. a full accounting suite is a legitimate product-scope choice) — but should be a deliberate "we are not building this, here's why" decision, not a silent absence, given every full-suite competitor bundles it.

Items 1 and 3 are the two with the clearest case for near-term action, since they sit directly adjacent to work Phase 1 is already doing. Items 2, 4, and 5 are product-strategy decisions this analysis surfaces but doesn't resolve.
