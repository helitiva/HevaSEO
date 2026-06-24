# Spec — Customer & User Management (Admin module 6)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

Manage customer accounts and their full picture: profile, ordered services, total spend (LTV),
credit balance + ledger, projects, tickets, and an activity timeline.

---

## 1. Scope

**In scope:** customer list + detail; derived metrics (ordered services, total spend / LTV, credit
balance); projects/domains; admin actions (edit, adjust credit, magic-link/impersonate, merge,
suspend, internal notes).

**Out of scope:** the customer-facing portal; payment processing (module 9 — adjust-credit calls
its ledger); ticket internals (module 5 — listed here).

## 2. Dependencies

- Reads `orders` (module 2) for ordered services + spend; `credit_ledger` + `customer_balances`
  view (Foundation/module 9) for balance; `tickets` (module 5).
- Owns `customers` (Foundation) + a new `projects` table.

## 3. Derived metrics (computed, not stored)

- **Total spend / LTV** = sum of `value_cents` over the customer's `completed` orders.
- **Credit balance** = `customer_balances.balance_cents` (sum of `credit_ledger`).
- **Order count / status mix** from `orders`.
- **Account status** = `customers.status` (`shadow` from quick-checkout, `claimed` after dashboard
  activation).

## 4. Data model

```sql
-- customers + credit_ledger + customer_balances exist (Foundation).
projects (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  domain      text not null,
  name        text,
  created_at  timestamptz not null default now()
)
```

(Orders already carry `brief.website`; `projects` promotes recurring domains to first-class records
the customer's orders can link to. Optional `orders.project_id` column added when needed.)

## 5. Admin UI

- **Customer list** (`/admin/customers`): name · company · email · status · #orders · **total
  spend** · **credit balance** · last activity. Search + filter by status.
- **Customer detail** (`/admin/customers/[id]`):
  - Profile (contact, company, status, tags, internal notes — editable).
  - **Ordered services**: order history (links to module 2), status, value, date.
  - **Spend & credit**: LTV, balance, ledger history; **Adjust credit** (writes `credit_ledger`).
  - **Projects**: domains.
  - **Tickets**: support history (module 5).
  - **Timeline**: orders, payments, logins, messages (from `audit_log` + ledger + messages).
  - **Actions**: edit profile, adjust credit, send magic-link / impersonate, merge duplicate,
    suspend.

## 6. Server actions

- `updateCustomer(id, fields)` / `addNote(id, note)`.
- `adjustCredit(id, deltaCents, reason)` — writes `credit_ledger` (delegates rules to module 9).
- `sendMagicLink(id)` — Supabase auth magic link to the customer email.
- `mergeCustomers(primaryId, dupId)` — reassign orders/ledger/tickets, soft-delete dup.
- `suspendCustomer(id)` — flag; gates portal access later.

## 7. Testing

- **Unit:** LTV/spend aggregation; status derivation.
- **Integration:** adjust-credit changes balance; merge reassigns orders + ledger; list metrics
  match seeded data.

## 8. Open (later)

- Customer-facing fields vs internal-only (RLS) when the 3-role system lands.
- Tags taxonomy; CSV import/export of customers.
