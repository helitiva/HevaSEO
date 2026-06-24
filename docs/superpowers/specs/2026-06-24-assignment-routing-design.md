# Spec — Assignment & Workload (Admin module 3)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Pairs with:** [Staff Performance (module 7)](2026-06-24-staff-performance-design.md) — the router reads staff scores from there.
**Audience:** Master admin.

Routes confirmed orders to the right staff automatically, by specialization and a real-time
fitness score, while keeping manual override. One task is always assigned to exactly one staff.

---

## 1. Scope

**In scope**
- **Staff specialization** (skills) used to find eligible staff per order.
- **Routing rules**: two layers — `pin` (service/package → a specific staff) and `auto`
  (skill-based pool + score-weighted pick).
- **`autoAssign`** triggered on order **Confirm**; manual assign/reassign always available.
- **Workload** views (per-staff open load, deadlines, overdue).

**Out of scope (other modules)**
- The staff performance score itself (module 7 — read here).
- Deliverable review (module 4); messaging (module 10).

## 2. Dependencies

- Module 2 (Order Management): `orders`, the Confirm transition, `assignOrderTx`.
- Module 7 (Staff Performance): `staff_profiles.skills`, the composite score, responsiveness stat.

## 3. Routing model (confirmed)

- **One task → one staff.** No shared/team assignment.
- **Skills gate:** only staff whose `skills` include the order's `service_key` are eligible.
  (Some staff handle only 1–3 services, e.g. a backlink specialist.)
- **Two rule layers**, highest priority first:
  1. **Pin rule** — `service` (+ optional `package`) → a specific `target_staff_id`. Hard assign.
  2. **Auto (skill pool)** — eligible pool = active, skilled, under-capacity staff → ranked by the
     router score below → top staff assigned.
- **Fallback:** empty pool / no match → leave unassigned for manual assignment.

### Router score (pure, tunable)

```
routerRank(staff) = composite_norm × availabilityFactor × responsivenessFactor

composite_norm        = staff.composite / 100                 # from module 7, 0..1
availabilityFactor    = max(0, 1 − openLoad / capacity)        # 1 = idle, 0 = at capacity
responsivenessFactor  = 1 / (1 + avgResponseHours / RESP_REF)  # 0..1, RESP_REF default 24h
```

- Staff at/over `capacity` are excluded (factor 0).
- New staff with no responsiveness data use a neutral `RESP_NEUTRAL = 0.5`.
- Ties → lowest `openLoad`, then deterministic by staff id.
- `RESP_REF`, neutral defaults, and whether to weight factors live in one `ROUTING_CONFIG`
  constant so they can be tuned after trial runs.

## 4. `autoAssign` trigger

`autoAssign(db, orderId)` runs as a side effect of **Confirm** (order scope/price locked):
1. Find the highest-priority active `pin` rule matching `service`(+`package`) → assign that staff.
2. Else build the eligible pool, compute `routerRank`, pick the max → assign.
3. Else leave `assigned_staff_id` null (manual queue).
Assignment uses module 2's `assignOrderTx` (sets assignee + deadline, transitions Confirmed→Assigned,
writes audit, notifies staff).

## 5. Data model

```sql
staff_profiles (
  id        uuid primary key references profiles(id) on delete cascade,
  skills    text[] not null default '{}',     -- service keys this staff can take
  capacity  int    not null default 5,        -- max concurrent open orders
  active    boolean not null default true
)

assignment_rules (
  id              uuid primary key default gen_random_uuid(),
  match_service   text not null,              -- service key
  match_package   text,                       -- optional; null = all packages of the service
  mode            text not null,              -- 'pin' | 'auto'
  target_staff_id uuid references profiles(id), -- required when mode = 'pin'
  priority        int  not null default 100,  -- lower runs first
  active          boolean not null default true,
  created_at      timestamptz not null default now()
)
```

`openLoad` is a query: count of a staff's orders in non-terminal, post-confirm statuses.

## 6. Admin UI

- **Rules manager** (`/admin/assignment/rules`): table of rules; create/edit/disable; pick service
  (+optional package), mode pin/auto, target staff (for pin), priority.
- **Manual assignment**: on an order detail (module 2), an "Assign" control listing eligible staff
  ranked by `routerRank` (so manual picks see the same ranking the auto-router would).
- **Workload board** (`/admin/assignment/workload`): per-staff columns/cards with open load,
  upcoming deadlines, overdue flags.

## 7. Server actions

- `createRule` / `updateRule` / `toggleRule` — manage `assignment_rules`.
- `autoAssign(orderId)` — invoked by Confirm; idempotent (no-op if already assigned).
- `manualAssign(orderId, staffId, deadline?)` / `reassign(orderId, staffId)` — wraps `assignOrderTx`.

## 8. Testing

- **Unit (pure):** `routerRank` ordering (idle high-quality staff beats busy one; at-capacity excluded;
  responsiveness tiebreak); `matchRule` (pin beats auto; package-specific beats service-wide; priority).
- **Integration:** `autoAssign` with a pin rule, with a skill pool (picks top rank), with an empty pool
  (stays unassigned); reassign updates load.
- **E2E:** confirm an order with a matching pin rule → it lands on the right staff.

## 9. Open (tune after trial)

- Factor weighting in `routerRank` (multiplicative now; could become weighted-sum).
- `capacity` defaults per skill; whether to hard-block or just penalize over-capacity.
- Whether `autoAssign` runs on Confirm only, or also on Assigned re-entry after Changes requested.
