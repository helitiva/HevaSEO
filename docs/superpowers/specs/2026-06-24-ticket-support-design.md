# Spec — Ticket / Support (Admin module 5)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

A support inbox: customers raise tickets (optionally tied to an order); the admin triages, replies,
and resolves, with SLA timing.

---

## 1. Scope

**In scope:** ticket lifecycle (open → pending → resolved → closed), priority, assignee, a message
thread per ticket, links to customer/order, first-response + resolution SLA timers, filters.

**Out of scope:** the customer-facing ticket UI (portal); order-scoped two-tier messaging is module
10 (a ticket thread is its own simpler thread).

## 2. Dependencies

- Reads `customers` (module 6) and `orders` (module 2) for linking.
- Notifications (module 10) for new-ticket / reply alerts.

## 3. Lifecycle

```
open ──▶ pending (awaiting customer) ──▶ resolved ──▶ closed
   └──────────────────▶ resolved (direct)
```

- **First-response SLA**: time from `created_at` to the first admin reply.
- **Resolution SLA**: time from `created_at` to `resolved`.
- SLA targets per priority live in Settings (module 13); overdue tickets are flagged.

## 4. Data model

```sql
tickets (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  order_id    uuid references orders(id),
  subject     text not null,
  status      text not null default 'open',  -- open | pending | resolved | closed
  priority    text not null default 'med',   -- low | med | high
  assignee_id uuid references profiles(id),
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
)
ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references tickets(id) on delete cascade,
  author_id  uuid not null references profiles(id),  -- admin or customer
  body       text not null,
  created_at timestamptz not null default now()
)
```

## 5. Admin UI

- **Inbox** (`/admin/tickets`): list with status/priority/assignee, customer, age, SLA flag; filter
  by status/priority/assignee; search subject/customer.
- **Ticket detail** (`/admin/tickets/[id]`): thread; reply box; controls for status, priority,
  assignee; sidebar with customer + linked order.

## 6. Server actions

- `createTicket(customerId, subject, { orderId?, priority })`.
- `replyTicket(ticketId, body)` — appends a message; sets `first_response_at` on first admin reply.
- `setTicketStatus(ticketId, status)` / `setPriority` / `assignTicket(ticketId, staffId)`.

## 7. Testing

- **Unit:** SLA timer computations (first-response, resolution, overdue vs target).
- **Integration:** create → reply sets first_response_at; resolve sets resolved_at; filters return
  the right rows.

## 8. Open (later)

- Email-to-ticket ingestion; canned responses; CSAT after resolution; merge tickets.
