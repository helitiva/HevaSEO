# Spec — Audit Log (Admin module 12)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

The "no black box" USP: a queryable record of who did what, when. The `audit_log` table already
exists (Foundation); this module is the **viewer** plus the **write discipline** every other module
follows.

---

## 1. Scope

**In scope:** a filterable audit viewer; a shared `audit()` helper; the convention that every
state-changing server action writes an audit row.

**Out of scope:** none new — this is cross-cutting glue over existing data.

## 2. Dependencies

- `audit_log` (Foundation) — already entity-agnostic (`entity`, `entity_id`, `action`, `from/to`,
  `meta`, `actor_id`, `at`). Order Management already writes to it.

## 3. Write discipline

- A single `audit(db, { entity, entityId, action, fromStatus?, toStatus?, meta? }, actorId)` helper
  (generalized from the order mutations) is called inside every mutating server action across
  modules (orders, assignment, finance, tickets, customer edits, catalog publish).
- Audit writes happen in the **same transaction** as the change so they cannot drift.

## 4. UI

- `/admin/audit`: a reverse-chronological table — time · actor · entity · action · change
  (`from→to` or a `meta` summary). Filters: entity type, actor, action, date range; search on
  `entity_id`. Pagination + CSV export (reuses module 11's export helper).
- Entity links: an `order` row links to `/admin/orders/[id]`, etc.

## 5. Data / queries

- `listAudit(db, filters)` — paginated, filtered query over `audit_log`.
- No schema change beyond what Foundation defines. Add indexes on `(entity, entity_id)` and `at` if
  query volume warrants.

## 6. Testing

- **Unit:** filter parsing (entity/actor/action/date).
- **Integration:** performing each kind of action writes the expected audit row; `listAudit`
  filters correctly.

## 7. Open (later)

- Immutable/append-only enforcement (revoke update/delete via RLS); retention policy; diff view for
  field-level edits.
