# Competitor Research — What Established Products Ship, and What We Built

**Researched:** 2026-09-03
**Method:** web search of the products actually sold into these verticals, then reading their
own feature documentation. Findings below are attributed; anything unattributed is our own
judgement about how to apply them.

This is a companion to [`gap-analysis.md`](./gap-analysis.md), which compared an earlier plan
against Nepali billing software. This document covers a later round: reading competitor product
docs per sector and closing what they proved was missing.

---

## 1. Why this round happened

The platform had four sectors built out and two rounds of depth behind it. The open question was
no longer "does it work" but "does it do what a shop that already pays for software expects".
Answering that meant reading what those products advertise, not guessing.

---

## 2. The kernel gap: payments and day close

**Sources:** [mis.ac POS Nepal](https://mis.ac/articles/blog/pos-software-nepal.php),
[Vyapar retail POS](https://vyaparapp.in/pos-software/retail),
[IMS Software Nepal](https://imssoftware.com.np/ims-softwares-pos-for-retail-businesses/)

Every Nepali POS vendor surveyed treats these as table stakes:

| Documented capability | Our state before |
|---|---|
| Cash, eSewa, Khalti, ConnectIPS, QR and card each recorded separately | **Nothing.** An invoice recorded what was owed, never how it arrived |
| Opening float, day close, cash variance flagged automatically | **Nothing** |
| Revenue by payment method | **Impossible** — the data did not exist |
| Multi-counter against shared inventory | Branch scoping existed; till scoping did not |

`payment_methods` did exist in the schema — but only under **platform billing**, meaning what a
tenant pays *us* for their subscription. Nothing covered what a tenant's own customer hands over
the counter. `system-design.md` §"Concepts" calls for exactly that separation, so this was a new
concern rather than a reuse.

### What we built

- `invoice_payments` as rows, not a column, so **split tender** works: part cash, part eSewa with
  the wallet's transaction id against the digital half.
- `cash_sessions` — opening float, close, counted vs expected, variance.
- `cash_movements` — petty cash in and out. Without it the formula quietly lies the moment
  someone takes money out of the drawer for tea.

The reconciliation formula is the one mis.ac documents:

```
expected = opening float + cash sales + paid in - paid out
variance = counted - expected
```

**Non-cash tender is deliberately excluded from expected cash.** eSewa and card settle to the
bank and never reach the drawer; counting them would manufacture a variance every single day.
There is a test asserting this.

Verified live: `500000 float + 10650 cash sales - 1500 paid out = 509150 expected`, counted
`509000`, variance `-150`.

Guard rails: a cash payment with no open till is refused rather than accepted with nowhere to
reconcile it; one open session per branch enforced by a partial unique index; closing is a
conditional UPDATE so two closes cannot both land.

---

## 3. Restaurant — delivery channels

**Sources:** [Petpooja POS](https://www.petpooja.com/poss),
[Record Nepal on delivery economics](https://www.recordnepal.com/the-business-of-delivering-food),
[BhojMandu](https://www.bhojmandu.com/np), [Foodmandu](https://foodmandu.com/)

Petpooja's headline is managing aggregator orders beside dine-in and takeaway from one screen.
The Nepali market numbers matter more than the feature:

| Aggregator | Commission |
|---|---|
| Foodmandu | ~22% |
| Bhoj | 20% |
| Pathao Food | 18% |

And **most restaurants partner with several at once**. Without modelling this, delivery revenue
is overstated by roughly a fifth.

### What we built

`sales_channels` per business with a commission percentage, and `orders.channel_commission_cents`
computed at checkout. Analytics break revenue into gross / commission / net per channel.

**Commission does not touch the invoice.** The customer paid full price and the invoice must say
so for IRD purposes; the aggregator's cut is a cost the restaurant absorbs on settlement.
Reducing the invoice would understate declared sales.

### A stranding bug this exposed

`billsOnCreate` was a static per-sector flag, `false` for restaurants, so every order waited for
table billing. Table billing finds lines by joining on the order's `tableId` — so a delivery
order, which has no table, could **never** be billed and would sit as `placed` with no invoice
forever. It is now a function of the order: with a table, defer to table billing; without one,
bill immediately. That also fixed counter takeaway, which had the same dead end.

---

## 4. Medical — pharmacy retail

**Source:** [Marg ERP chemist software](https://margcompusoft.com/retail/chemist_software.html)

Marg is the reference product for Indian and Nepali pharmacy retail. Its advertised features
against ours:

| Marg feature | Our state |
|---|---|
| Batch + expiry tracking with alerts | Already built (FEFO, expiry write-off job) |
| Schedule H1 / narcotics register | Already built (controlled substance register) |
| Substitute search by salt | Built in the prior round |
| **Search by salt, substitute, rack or name** | Search matched only name and SKU |
| **Rack location** | Not modelled |
| Barcode / strip code search | SKU only |

### What we built

Product search now also matches `genericName`, `rackLocation` and `barcode` out of `sectorData`.
One box: searching `paracetamol 500` returns **both** Paracetamol and Cetamol — substitute-by-salt
from the ordinary search — and `A-3` finds whatever sits on that shelf. `rackLocation` is
validated for medical products alongside `schedule`.

### Loose unit sales (from the sector clarification, not a competitor doc)

The most common transaction at a Nepali medical store is four tablets out of a strip of ten, and
it had no representation. The only workaround was quantity `0.4`, which produced an invoice line
reading `0.4 Paracetamol 500mg (10 tabs)` — meaningless on a receipt, invalid on the IRD
register — and drifts: for a strip of three, one tablet is `1/3 = 0.333` at `numeric(14,3)`, so
selling all three decrements `0.999` and leaves phantom stock forever.

Stock is now held in sub-units with `units_per_pack` for display and pricing. Line totals are
computed from the pack price rather than multiplied from a per-unit price, so a whole strip of
three at NPR 20 bills at exactly NPR 20, not NPR 20.01.

---

## 5. Services — salon and spa

**Sources:** [Zenoti salon management](https://www.zenoti.com/salon-management-software),
[Fresha for business](https://www.fresha.com/for-business)

Both lead with the same claim: reminders **plus deposits** cut no-shows, Zenoti citing up to 40%.

| Feature | Our state |
|---|---|
| Automated reminders | Built in the prior round (hourly job, email + in-app) |
| **Deposits / prepayment at booking** | Nothing |
| **No-show fee** | Nothing |
| Staff commission tracking | Not built |
| Loyalty / packages | Memberships exist; loyalty does not |

### What we built

A service item carries a required deposit and a no-show fee. A booking inherits the requirement,
a deposit can be taken by any payment method with the wallet reference, and marking the booking a
no-show forfeits what was paid. **Forfeiture is recorded as its own figure rather than deleted**,
so a salon can see what it actually recovered instead of the money vanishing.

---

## 6. RestroX — the Nepali restaurant management system

**Source:** [restrox.com/np](https://www.restrox.com/np)

Referenced directly at the owner's request. Most of what it advertises was
already built:

| RestroX module | Our state |
|---|---|
| Real-time order management, KOT, KDS | Built |
| Table & space management, floor, occupancy | Built |
| QR table assignment, digital QR menus | Built (table sessions) |
| Dine-in, takeaway, delivery, reservation | Built |
| IRD approved billing, eSewa/Khalti | Built |
| Inventory, low stock alerts, receiving | Built |
| Staff & role management with permissions | Built, and richer — runtime custom roles |
| **Waste control** | **Missing** |
| **Expense tracking, cash flow** | **Missing** |
| **Variants and combos** | Modifiers existed; variants did not |
| **Loyalty & rewards** | **Missing** |
| **Customer feedback** | **Missing** |
| Native mobile apps | Out of scope — the web app is responsive |

### What we built

**Wastage.** Logged against a raw stock item or against a dish; a dish explodes
through its recipe, so three spilled plates of momo deduct 0.6kg flour and
0.45kg chicken rather than a notional "3 momos". Valued at ingredient cost, so
the report answers what the spoilage cost — by reason and by worst item. Stock
moves through `StockAdjustmentsService` under a new `wastage` reason, keeping
one ledger. A chef can record it and see the report, and still nothing else.

**Menu variants.** Half plate versus full plate is ubiquitous here. Modifiers
already priced correctly, but nothing made a group required or single-select,
so an order could omit the plate size or ask for half *and* full. `MenuModifier`
gained `required` and `maxSelections` — real variants without a parallel table.

**Expenses.** Purchases from suppliers were covered; rent, gas, repairs and a
salary paid out of the drawer were not. The integration is the point: a cash
expense while a till is open writes a matching cash movement, so the drawer
reconciles. Without it, paying the gas bill from the till reads as an
unexplained shortage at day close. A bank transfer deliberately does not touch
the drawer.

**Loyalty.** Points accrue automatically when an invoice is issued to a known
customer, at an owner-set rate, so it needs no counter workflow. Redemption
enforces the balance inside the `UPDATE … WHERE` clause — the same shape as the
credit limit — so a concurrent double-redeem cannot overdraw.

**Feedback.** A rating and comment per order, one per order enforced by a unique
index rather than check-then-insert.

**Known limit:** points are only awarded to identified customers. A walk-in with
no customer record earns nothing — inherent to the data model, since there is
nobody to credit, not an oversight.

---

## 7. Deliberately not built

| Item | Why |
|---|---|
| Staff commission tracking (Fresha, RestroX) | Real feature, not yet scoped |
| Combo meals (RestroX) | Variants cover half/full; a combo is a different build — one price, several items |
| Refer & earn (RestroX) | Loyalty is the foundation; referral attribution is a separate build |
| Native mobile apps (RestroX) | The web app is responsive; native is a distribution decision |
| Loyalty programmes (Zenoti) | Memberships cover the package case; loyalty is a separate build |
| Aggregator API integration | Pulling orders *from* Foodmandu needs their partner API access — a commercial conversation, not a code one |
| Accounting / GL, payroll | Non-goals per `system-design.md` §10 |
| Medicine master database (Marg ships 450k drugs) | A data licensing question, not an engineering one |

---

## 8. Bugs the research surfaced

Reading competitor docs forced test paths we had not walked. Three real defects:

1. **Delivery orders were unbillable** — see §3.
2. **No-show forfeiture returned a stale row** — the database recorded the forfeit, the API
   response said `0`, because the status update returned before the forfeit ran inside the
   transaction.
3. **Commission response fields landed on the wrong DTO class** — attached to the order *item*
   rather than the order. Caught by end-to-end testing, not by the type checker.
