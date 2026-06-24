# Spec — Finance (Admin module 9)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

The money layer: the canonical credit ledger, invoices, Stripe top-ups/checkout, refunds, and a
revenue view. Defines the credit rules that Order Management's deduct-at-Confirm and cancel-refund
hooks depend on.

---

## 1. Scope

**In scope:** credit ledger semantics (balance always summed from the ledger); top-ups (Stripe
Checkout); the public quick-checkout payment path (master-plan §6); invoices; refunds; a revenue
summary.

**Out of scope:** analytics charts (module 11 reads finance data); customer profile UI (module 6).

## 2. Dependencies

- Owns `credit_ledger` (Foundation) + `customer_balances` view; adds `invoices` + `stripe_events`.
- Order Management (module 2) calls `deductCredit` on Confirm and refunds on Cancel — those rules
  are defined here.

## 3. Credit rules (canonical)

- **Balance = Σ `credit_ledger.delta_cents`** for the customer. Never store a balance column.
- **Top-up**: positive `delta` (`reason: 'topup'`, links `stripe_event`).
- **Order debit**: negative `delta` on **Confirm** (`reason: 'order_confirmed'`, `order_id` set).
- **Refund**: positive `delta` on Cancel-after-Confirm (`reason: 'order_canceled_refund'`).
- **Sufficiency check** (used by `confirmOrderTx`): `balance(customer) >= order.value_cents`.

## 4. Stripe (top-up + quick checkout)

- **Top-up**: admin or customer initiates → Stripe Checkout session → webhook (idempotent) →
  `credit_ledger` credit.
- **Quick checkout** (marketing, master-plan §6): the public `/api/public/checkout` creates a
  Checkout session from a server-validated catalog price; the webhook creates/finds a shadow
  customer, inserts the order (`source: 'quick'`), and records the ledger entry.
- **Idempotency**: `stripe_events` stores processed `event_id`; the webhook no-ops on duplicates.

## 5. Data model

```sql
invoices (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  order_id    uuid references orders(id),
  amount_cents int not null,
  currency    text not null default 'USD',
  status      text not null default 'draft', -- 'draft' | 'sent' | 'paid' | 'void'
  stripe_id   text,
  created_at  timestamptz not null default now()
)
stripe_events (
  id          text primary key,             -- Stripe event id (idempotency key)
  type        text not null,
  processed_at timestamptz not null default now()
)
```

## 6. Admin UI

- **Finance overview** (`/admin/finance`): revenue today/MTD, outstanding, recent transactions.
- **Ledger** (per customer, also surfaced in module 6): entries + running balance.
- **Top-up / adjust**: record a manual top-up or adjustment (writes ledger).
- **Invoices**: list + create/send/void; mark paid (or Stripe-driven).
- **Refunds**: refund an order's debit (ledger credit; Stripe refund when paid by card).

## 7. Server actions / endpoints

- `recordTopup(customerId, amountCents, source)` / `adjust(customerId, deltaCents, reason)`.
- `createInvoice(customerId, orderId?, amountCents)` / `voidInvoice(id)` / `markPaid(id)`.
- `refundOrder(orderId)` — ledger credit (+ Stripe refund if applicable).
- `POST /api/stripe/webhook` — idempotent; handles `checkout.session.completed` (top-up + quick
  checkout) and refunds.
- `POST /api/public/checkout` — quick-checkout session (rate-limited, Turnstile — master-plan §6).

## 8. Testing

- **Unit:** balance summation; sufficiency check; idempotent event de-dup.
- **Integration:** topup → balance up; confirm debit → down; cancel refund → restored; duplicate
  webhook event processed once; quick-checkout webhook creates shadow customer + order + ledger.

## 9. Open (later)

- Multi-currency display (USD primary, EUR secondary — master-plan §9); tax/VAT; payout reports;
  dunning for failed payments.
