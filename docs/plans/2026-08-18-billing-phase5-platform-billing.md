# Multi-Sector Billing SaaS — Phase 5: Platform Billing

Supersedes the outline in `2026-08-14-billing-phase5-platform-billing.md`.

## Context

The layer that charges **businesses for their subscriptions to this SaaS** — as opposed to Phase 1's `business_invoices`, which is what a mart charges its own customers. Builds on the `subscriptions` table Phase 1 already carries (`status`, `currentPeriodEnd`) and has been waiting for a biller to act on.

**The single most important constraint** is `docs/system-design.md` §1's two billing planes: platform billing and business billing "share invoicing-engine internals but are distinct entities. Conflating them is the single easiest way to corrupt compliance-critical numbering."

So this phase reuses the *discipline* of Phase 1's invoicing engine — atomic gapless numbering, no hard deletes, an audit trail — while sharing **none of its tables or counters**. `platform_invoices` gets its own sequence. A bug in platform billing must not be able to skip a number in a business's IRD-facing register.

## 1. What is blocked, and what is not

The outline treats this phase as gated on payment-gateway credentials. Most of it is not:

- **Blocked**: the actual eSewa/Khalti HTTP calls.
- **Not blocked**: the schema, the wallet, the nightly billing run, period extension, dunning and per-business suspension, consolidated invoices, and the platform audit log.

Phase 1 set the precedent — `cbms_push_queue` and its conditional enqueue were built while the outbound IRD worker stayed a stub pending credentials. This phase does the same: a `PaymentGateway` interface with a stub implementation that records an intent and returns a deterministic result. Swapping in eSewa/Khalti is then one class, not a redesign.

## 2. The account is the billing entity, not the business

`payment_methods` and `platform_invoices` are **account-scoped**, per `system-design.md` §1: "a shared payment wallet at the account level — the same relationship a Google Account has to Workspace/Cloud billing."

An account is a Better Auth `user`. One account may own up to `ORGANIZATION_LIMIT` businesses; one wallet funds all of them; one consolidated invoice itemises them. This is the product's stated differentiator, so getting the ownership axis right matters more than the convenience of hanging payment off the business.

**Failure is isolated to one business, though.** If a charge fails, that business goes `past_due` and eventually suspends; the account's *other* businesses keep working. Dunning follows the money (the account), suspension follows the service (the business).

## 3. Schema — `apps/api/src/database/schema/platform.ts`

```
payment_methods                 -- account-scoped
  id, userId (fk -> user, cascade)
  provider ('esewa'|'khalti'|'bank')
  gatewayToken                  -- the gateway's own token. NEVER raw card/wallet
                                   credentials; this system stores no PAN, no CVV
  displayLabel                  -- e.g. "eSewa ****4321", for the UI only
  isDefault (bool)              -- the "wallet"
  status ('active'|'expired'|'removed')
  createdAt, updatedAt
  index(userId, status)
  unique(userId) where isDefault  -- one default per account, enforced partially

platform_invoices               -- what an ACCOUNT owes this SaaS
  id, userId (fk), invoiceNumber (int), series (text, e.g. '2026')
  periodStart, periodEnd
  subtotalCents, vatCents, totalCents
  status ('draft'|'open'|'paid'|'uncollectible')
  paidAt, createdAt
  unique(series, invoiceNumber)
  index(userId, status)

platform_invoice_lines          -- itemised per business/subscription
  id, platformInvoiceId (fk), businessId (fk), subscriptionId (fk), planId (fk)
  description, periodStart, periodEnd, amountCents
  index(platformInvoiceId)

platform_invoice_counters       -- SEPARATE from invoice_counters, deliberately
  series (pk), lastNumber

payment_attempts                -- every charge, successful or not
  id, userId, businessId, subscriptionId, paymentMethodId (nullable)
  amountCents, provider, status ('succeeded'|'failed'|'pending')
  gatewayReference, failureReason, attemptNumber
  createdAt
  index(userId, createdAt), index(subscriptionId, createdAt)

platform_audit_log              -- distinct from Phase 1's invoice_audit_log,
                                   which covers business-invoice events only
  id, actorUserId (nullable — the biller acts with no user)
  targetType ('subscription'|'plan'|'business'|'payment_method')
  targetId, action, metadata (jsonb), createdAt
  index(targetType, targetId), index(createdAt)
```

## 4. The nightly billing run

`@nestjs/schedule`, daily. Idempotent and re-runnable — the same day's run must not double-charge, so a subscription is only picked up when `currentPeriodEnd <= now` and `status <> 'canceled'`, and the period is extended in the same transaction as a successful charge.

Per due subscription:

1. Resolve the owning account and its default payment method.
2. **No payment method** → `past_due`, dunning notice, no charge attempt. This is the common first-run case, not an error.
3. Charge via `PaymentGateway`. Record a `payment_attempts` row either way.
4. **Success** → extend the period by the plan's billing cycle, set `active`, clear dunning, append a `platform_invoice_lines` row to the account's open invoice for the period.
5. **Failure** → `past_due`, increment the attempt count, and once it passes the dunning threshold, **suspend that business only** (`businesses.status = 'suspended'`, which Phase 1's `BusinessAccessGuard` already enforces for writes while leaving reads working).

Every state change writes `platform_audit_log`.

Suspension deliberately reuses the existing flag rather than inventing a "billing hold": a suspended business already blocks writes and permits reads, which is exactly the right behaviour for non-payment — the owner can still read their records and export their registers.

## 5. Consolidation and numbering

An account accrues lines during a period into a `draft` invoice; the monthly consolidation closes it, assigns a number from `platform_invoice_counters` using the same atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` Phase 1 uses, and marks it `open`.

Numbers come from a **separate counter table** — this is the §1 constraint made concrete. Series is a plain calendar year, not a Bikram Sambat fiscal year: these are the SaaS's own invoices, not IRD-facing business invoices.

## 6. Not in this phase

- **Real eSewa/Khalti integration.** The interface and stub exist; the HTTP client needs credentials and a merchant account. New env vars land with it.
- **PDF rendering.** The outline mentions it; it needs an object-storage decision that does not exist yet (the same one Phase 2 deferred for prescription images). The data to render is complete.
- **Proration on mid-period plan change.** `SubscriptionsService.assign` currently resets the period; charging a difference is a pricing decision, not an engineering one.
- **Tax on platform invoices.** `vatCents` exists and is computed at 0 until someone decides whether this SaaS charges VAT on subscriptions.

## 7. Verification

> [!NOTE]
> **Status: built and verified against a live Postgres, with the gateway stubbed.**
>
> Verified with one account owning two businesses — the model this phase exists
> to prove:
> - Nothing due → the run is a no-op.
> - No payment method → both subscriptions `past_due` with **zero charge
>   attempts** (the expected first-run state, not an error).
> - Wallet added → both charged, **one consolidated draft for the account with
>   two lines**, one per business. The gateway token is never returned by the API.
> - **Idempotency**: an immediate re-run reports `examined: 0` and adds no
>   attempt and no line.
> - **Dunning isolation**: three consecutive declines suspended only the failing
>   business; the account's other business stayed `active` throughout.
> - **Recovery**: a successful charge restored the suspended business to `active`.
> - **Numbering separation**: the platform invoice took #1 from
>   `platform_invoice_counters` while `invoice_counters` stayed untouched —
>   `system-design.md` §1's constraint, demonstrated rather than asserted.
> - Audit trail records the full sequence: `past_due, charged, charge_failed x3,
>   suspended_for_non_payment`.
>
> Not exercised: real gateway calls (stubbed), PDF rendering, proration, and
> platform-invoice VAT — all listed in §6 as out of scope.

- Idempotency: running the biller twice in a day charges once.
- Isolation: a failing charge suspends one business and leaves the account's others active.
- Numbering: platform invoice numbers are gapless in their own series and never touch `invoice_counters`.
- No-payment-method path produces `past_due` without an attempt.
