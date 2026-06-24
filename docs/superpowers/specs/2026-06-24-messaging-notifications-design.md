# Spec — Messaging / Notifications (Admin module 10)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin (customer-visible messages later surface in the portal).

Two-tier order messages (internal vs customer-visible) and an in-app notification center backed by
Supabase Realtime.

---

## 1. Scope

**In scope:** per-order message thread with `visibility` (internal/customer); the notification
center (bell + list) reading the `notifications` table; Realtime delivery.

**Out of scope:** email delivery (Settings/module 13 owns templates + SMTP); ticket threads
(module 5 has its own); the customer portal rendering of customer-visible messages.

## 2. Dependencies

- `orders` (module 2) for the thread context; `notifications` (Foundation) already exists.
- Other modules **emit** notifications (assignment, deliverable review, finance) — this module owns
  the inbox UI + the shared `notify()` helper.

## 3. Two-tier messages

- `visibility: 'internal'` — staff/admin only (notes, coordination).
- `visibility: 'customer'` — shown to the customer (and emailed via module 13 templates later).
- The order-detail thread (module 2) renders both with a clear divider; composing defaults to
  `internal`, with an explicit toggle to post a customer-visible message.

## 4. Data model

```sql
messages (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  author_id  uuid not null references profiles(id),
  body       text not null,
  visibility text not null default 'internal',  -- 'internal' | 'customer'
  created_at timestamptz not null default now()
)
-- notifications (Foundation): recipient_id, type, payload jsonb, read_at, created_at
```

## 5. Realtime + notification center

- `notify(recipientId, type, payload)` — server helper that inserts a `notifications` row.
- A client **NotificationBell** subscribes to `notifications` (Realtime, filtered to the current
  user) → unread count + dropdown list; mark-as-read updates `read_at`.
- The orders table (module 2) already subscribes to `orders`; messages threads subscribe to
  `messages` for the open order.

## 6. Admin UI

- **Order thread** (in module 2 detail): messages with author + time + visibility badge; composer
  with internal/customer toggle.
- **Notification center**: bell in the admin shell top bar; dropdown of recent notifications with
  links to the relevant order/ticket; "mark all read".

## 7. Server actions

- `postMessage(orderId, body, visibility)` — inserts; notifies the counterparty (customer-visible →
  notify customer; internal → notify assigned staff/admins).
- `markNotificationRead(id)` / `markAllRead()`.

## 8. Testing

- **Unit:** visibility default + toggle; notify payload shape.
- **Integration:** posting a customer-visible message notifies the customer; Realtime insert raises
  the unread count; mark-read clears it.

## 9. Open (later)

- Email fan-out for customer-visible messages (module 13); typing indicators; attachments in
  messages; digest notifications (BullMQ).
