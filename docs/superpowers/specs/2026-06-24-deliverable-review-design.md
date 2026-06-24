# Spec — Deliverable Review (Admin module 4)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin (staff submit; admin reviews).

Closes the fulfillment loop: staff submit work (file/link, versioned); the admin approves or
requests changes. Approve/Request-changes drive the order state machine (module 2).

---

## 1. Scope

**In scope:** deliverable submission (file via Storage / link), versioning, the review queue,
approve / request-changes actions and their order-state effects.

**Out of scope:** the staff-side submission UI lives in the (separate) staff dashboard; here we
define the data + the admin review side + the shared `submitDeliverable` action. Messaging is
module 10.

## 2. Dependencies

- Module 2 (Order Management): the `delivered`, `approved`, `changes_requested` transitions.
- Supabase Storage (Foundation) for files.

## 3. Flow

```
staff submits deliverable (v1)  →  order: internal_review → delivered
admin reviews:
  ├─ Approve          → order: delivered → approved (→ Completed)
  └─ Request changes  → order: delivered → changes_requested  (staff submits v2 …)
```

- An order cannot transition to `delivered` without ≥1 `submitted` deliverable (enforced in the
  `transitionOrder` guard for `→ delivered`).
- Each review round increments the version; the changes-requested count feeds staff quality
  scoring (module 7).

## 4. Data model

```sql
deliverables (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  staff_id   uuid not null references profiles(id),
  version    int  not null default 1,
  kind       text not null,                 -- 'file' | 'link'
  storage_path text,                        -- when kind='file' (Storage bucket 'deliverables')
  url        text,                           -- when kind='link'
  note       text,
  status     text not null default 'submitted', -- 'submitted' | 'approved' | 'changes_requested'
  review_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
)
```

- Storage: private bucket `deliverables`; admin views via short-lived signed URLs.
- `version` = max(existing for order) + 1 on each new submission.

## 5. Admin UI

- **Review queue** (`/admin/review`): orders in `delivered` (awaiting approval), newest first;
  badge for changes-requested re-submissions.
- **On order detail** (module 2 deliverables panel): list versions (download/open), latest at top;
  **Approve** and **Request changes** (with a required note) buttons when status is `delivered`.

## 6. Server actions

- `submitDeliverable(orderId, { kind, file|url, note })` — staff/admin; creates a version,
  transitions the order `internal_review → delivered`.
- `approveDeliverable(deliverableId)` — marks approved; transitions order `delivered → approved`;
  audit.
- `requestChanges(deliverableId, note)` — marks changes_requested; transitions order
  `delivered → changes_requested`; notifies staff; audit (the round counts toward quality score).

## 7. Testing

- **Unit:** version increment; the `→ delivered` guard (rejects with zero deliverables).
- **Integration:** submit → delivered; approve → approved; request-changes → changes_requested and a
  re-submit bumps version; changes-requested count is readable for module 7.

## 8. Open (later)

- Inline preview for common file types; comment threads per deliverable (vs a single note).
- Customer-visible delivery (surface approved deliverables in the customer portal).
