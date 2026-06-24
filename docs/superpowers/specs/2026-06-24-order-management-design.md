# Spec — Order Management (Admin module 2)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md) — first operational module.
**Audience:** Master admin only.

The operational spine of the admin dashboard: every order from quick-checkout (marketing) and
the dashboard lands here and is driven through its lifecycle. Other modules (assignment,
deliverable review, finance, messaging) hang off the order.

---

## 1. Scope

**In scope**
- The orders **table** (primary view) + status summary strip + filters/sort/bulk.
- The **order detail** page (header, customer, scope/brief, fulfillment, deliverables, messages, audit timeline) — owning only the order state + scope/brief; other panels read from their owning modules.
- The **order state machine** and its enforcement (UI + server).
- Order **data model** (`orders`, `audit_log`) and the create path that unifies quick + dashboard orders.
- **Value snapshot** at creation and the **credit-deduction hook at Confirm**.

**Out of scope (owned by other modules, linked/stubbed here)**
- Assignment internals & staff workload (module 3) — detail page shows an Assign action + assignee.
- Deliverable submission/review UI (module 4) — detail page lists deliverables read-only.
- Two-tier messaging (module 10), credit ledger rules (module 9), customer profile (module 6).

## 2. Dependencies (Foundation — module 0)

Requires: Supabase (Postgres + Auth + Realtime + RLS), master-admin auth, the `(admin)/` app
shell, and the core schema. This module owns/refines the `orders` and `audit_log` tables and
**reads** `customers`, `services`/`packages` (catalog), `tasks`, `deliverables`, `messages`,
`credit_ledger`.

## 3. State machine (canonical — confirmed)

```
New ──▶ Confirmed ──▶ Assigned ──▶ In progress ──▶ Internal review ──▶ Delivered
                                                                          │
                                              ┌───────────────────────────┤
                                              ▼                           ▼
                                          Approved ──▶ Completed   Changes requested ──▶ In progress
   Canceled ◀── (from New / Confirmed)
```

**Transition map** (single source of truth, a pure module shared by UI and server):
| From | Allowed → |
|------|-----------|
| New | Confirmed, Canceled |
| Confirmed | Assigned, Canceled |
| Assigned | In progress |
| In progress | Internal review |
| Internal review | Delivered, In progress *(kick back)* |
| Delivered | Approved, Changes requested |
| Changes requested | In progress |
| Approved | Completed |
| Completed / Canceled | *(terminal)* |

`nextStates(status): Status[]` and `canTransition(from, to): boolean` derive from this map.

**Side effects on transition** (each runs inside the same Server Action, after the status write):
- **→ Confirmed**: deduct credit — write a `credit_ledger` debit for `value_cents` (hook
  `deductCredit(order)`; rules finalized in Finance module 9). Block confirm if balance insufficient.
- **→ Assigned**: notify assigned staff (`notifications`).
- **→ Delivered**: notify customer.
- **All transitions**: write an `audit_log` row (`from_status`, `to_status`, actor, at).

## 4. Screens

### 4.1 `(admin)/orders` — orders table (primary)
- **Status summary strip** (top): count per status, click to filter — the intake queue is this
  filtered to `New`.
- **Columns**: code · customer · service/package · status (badge) · priority · value · source
  (`quick`/`dashboard`) · assigned staff · deadline/SLA (overdue flag) · created.
- **Filters** (persisted in URL): status, service, staff, source, priority, date range, text
  search (code / customer / domain).
- **Sort**: created, deadline, value. **Pagination**: server-side, in URL.
- **Bulk actions**: assign staff, change status (valid transitions only across the selection),
  cancel. Bulk status change skips rows where the transition is invalid and reports a summary.
- Row → order detail.

### 4.2 `(admin)/orders/[id]` — order detail
- **Header**: code · status badge · valid transition buttons (from `nextStates`) · priority · value · source.
- **Customer panel**: name, contact, credit balance, link to module 6 profile.
- **Scope panel**: service, package/tier, the submitted **brief** fields, chosen add-ons + prices.
- **Fulfillment panel**: assigned staff, tasks, deadlines; Assign/Reassign action *(module 3)*.
- **Deliverables panel**: submitted versions (file/link), read-only here; approve/request-changes is module 4 *(the Delivered→Approved/Changes transition lives here, the review UI is module 4)*.
- **Messages**: two-tier thread placeholder *(module 10)*.
- **Activity timeline**: `audit_log` for this order — every transition, actor, timestamp.

## 5. Data model

```sql
orders (
  id            uuid pk,
  code          text unique,              -- e.g. AUD-1234 (per-service prefix)
  customer_id   uuid references customers,
  service_key   text,                     -- catalog service key
  package_id    text,                     -- chosen package/tier id (null for usage/consult)
  status        text,                     -- enum from the state machine
  priority      text,                     -- low | med | high
  source        text,                     -- 'quick' | 'dashboard'
  value_cents   int,                      -- snapshot, server-computed at create
  currency      text default 'USD',
  brief         jsonb,                    -- submitted form fields + chosen add-ons (id, tier, price)
  assigned_staff_id uuid null,            -- set by module 3; shown here
  deadline_at   timestamptz null,
  created_at    timestamptz default now(),
  updated_at    timestamptz
)

audit_log (
  id          uuid pk,
  actor_id    uuid,                       -- admin who acted
  entity      text,                       -- 'order'
  entity_id   uuid,
  action      text,                       -- 'transition' | 'assign' | 'cancel' | 'edit'
  from_status text null,
  to_status   text null,
  meta        jsonb,
  at          timestamptz default now()
)
```

- **One pipeline**: quick-checkout and dashboard orders both insert into `orders` (differ by
  `source`). Quick-checkout insert path is created by the public checkout webhook (master-plan §6),
  not by this module, but lands in the same table this module reads.
- `add-ons` are stored inside `brief.addons` (id, tier, price snapshot) — no separate table needed now.

## 6. Server actions & validation

All writes are Server Actions (no client-trusted mutations):
- `confirmOrder(id)` — New→Confirmed; checks credit balance; deducts credit; audit.
- `transitionOrder(id, to)` — validates `canTransition(current, to)`; runs side effects; audit.
- `assignOrder(id, staffId, deadline?)` — sets assignee/deadline (calls into module 3); audit.
- `cancelOrder(id, reason)` — from New/Confirmed only; refunds credit if already deducted; audit.

Validation: every action re-reads the current status server-side and rejects stale/invalid
transitions with a clear error. `value_cents` is **always** computed server-side from the catalog
at creation — the client never sends a price. Brief is validated with zod against the service's
field schema.

## 7. Pricing & credit

- `value_cents` snapshot at order creation, from the published catalog (server-validated).
- **Deduct at Confirm**: `confirmOrder` writes a `credit_ledger` debit and blocks if the customer's
  balance is insufficient (surface a clear message; admin can top-up via module 6/9). Cancel after
  Confirm refunds the debit. Exact ledger semantics are owned by Finance (module 9); this module
  calls the hook.

## 8. Data flow / realtime

- Server Components render the table and detail (RLS-scoped reads).
- **TanStack Query + Supabase Realtime** keep the table live (new orders appear, status changes
  reflect without refresh) and the detail timeline live.
- Filters, sort, pagination, and active status filter are URL state.
- Status changes use optimistic UI with rollback on failure.

## 9. Permissions

- Master admin: full read/write. Queries and RLS policies are written **role-ready** so staff
  (assigned-only, no prices) and customers (own orders, no internal notes) can be added later
  without restructuring (master-plan §5 RLS matrix).

## 10. Error handling

- Invalid/stale transitions → rejected server-side, friendly message, no partial writes
  (status + side effects + audit in one transaction).
- Insufficient credit on Confirm → blocked with an actionable message.
- Optimistic update rollback on any action failure; errors surfaced as toasts.

## 11. Testing

- **Unit**: transition map (`nextStates`, `canTransition`, terminal states), value/price snapshot
  from catalog, SLA/overdue computation, code generation.
- **Integration**: Server Actions (confirm with/without sufficient credit, transition happy +
  invalid, assign, cancel-with-refund) against Postgres + RLS policies.
- **E2E (Playwright)**: intake (New) → Confirm (credit deducted) → Assign → In progress → Internal
  review → Delivered → Approved → Completed; plus a Changes-requested loop and a Cancel-with-refund.

## 12. Open decisions (deferred to owning modules)

- Exact `credit_ledger` schema & top-up flow → Finance (module 9).
- Assignment UX, staff capacity rules, SLA definition → Assignment (module 3).
- Deliverable versioning & review UI → Deliverable Review (module 4).
