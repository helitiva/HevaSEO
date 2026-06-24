# Spec — Staff Management & Performance (Admin module 7)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Pairs with:** [Assignment & Workload (module 3)](2026-06-24-assignment-routing-design.md) — the router consumes the composite score and responsiveness stat defined here.
**Audience:** Master admin.

Manages staff accounts/skills and turns their order history into a performance profile: an
**auto quality score**, an **admin manual rating**, and a **composite** the router uses.

---

## 1. Scope

**In scope**
- Staff accounts (role `staff`), skills, capacity, active flag.
- **Auto quality score** from deliverable outcomes (approve vs changes-requested).
- **Manual admin rating** (1–5) per order's staff work.
- **Composite score** = blend(auto quality, manual). Displayed stats: on-time %, responsiveness,
  throughput.
- Staff list + staff detail (profile, scores, ratings).

**Out of scope (other modules)**
- Routing logic (module 3); deliverable submission/review (module 4 — supplies approve/changes events).

## 2. Dependencies

- Reads `orders` + `audit_log` (changes-requested events, delivery timestamps) and `order_ratings`.
- `staff_profiles` table is shared with module 3 (defined there; skills/capacity managed in both
  the staff detail screen here and the assignment views).

## 3. Scoring (confirmed: auto = quality only)

Per the brainstorm, the **auto score is quality only**; on-time and responsiveness are shown as
stats and used by the router (module 3), but are **not** part of the stored score.

### Auto quality score (0–100, rolling window `WINDOW` = last 90 days)

```
changesRounds = count of audit_log 'transition' to 'changes_requested' for the staff's orders
deliveries    = count of the staff's orders that reached 'delivered' at least once
quality       = round(100 × deliveries / (deliveries + changesRounds))   # 100 if no rework
```
New staff with no deliveries → `quality = BASELINE` (default 70) until they have data.

### Manual rating

`order_ratings(order_id, staff_id, rater_id, score 1..5, note)` — admin rates the staff's work on an
order. `manualAvg` = average score over `WINDOW`, scaled to 0–100 (`score/5 × 100`).

### Composite (tunable weights)

```
composite = round(W_QUALITY × quality + W_MANUAL × manualAvg)   # W_QUALITY=0.7, W_MANUAL=0.3
# If no manual ratings yet: composite = quality.
```
`WINDOW`, `BASELINE`, `W_QUALITY`, `W_MANUAL` live in one `SCORING_CONFIG` constant for tuning
after trial runs.

### Displayed stats (not in score)

- **on-time %** = onTimeDeliveries / deliveries (delivered_at ≤ deadline_at).
- **responsiveness** = avg hours from `assigned`→`in_progress` and `changes_requested`→`in_progress`
  (this avg feeds module 3's `responsivenessFactor`).
- **throughput** = orders reaching `completed` in `WINDOW`.

## 4. Data model

```sql
-- staff_profiles is defined in module 3's migration (skills, capacity, active).

order_ratings (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  staff_id   uuid not null references profiles(id),
  rater_id   uuid not null references profiles(id),  -- the admin
  score      int  not null check (score between 1 and 5),
  note       text,
  created_at timestamptz not null default now(),
  unique (order_id, rater_id)                         -- one rating per admin per order
)
```

Performance is **computed**, not stored: a `staff_performance` SQL view (or a query module)
aggregates `quality`, `manualAvg`, `composite`, `onTimePct`, `avgResponseHours`, `throughput`
per staff over `WINDOW`. (Materialize later only if it becomes slow.)

## 5. Admin UI

- **Staff list** (`/admin/staff`): name · skills · capacity · open load · composite · on-time % ·
  throughput · active. Sort by composite.
- **Staff detail** (`/admin/staff/[id]`): edit skills + capacity + active; performance panel
  (composite, quality, manual avg, on-time, responsiveness, throughput) with the rolling window;
  recent rated orders.
- **Rate-work control**: on an order detail (module 2), once `delivered`/`completed`, the admin can
  give the staff a 1–5 rating + note → `order_ratings`.

## 6. Server actions

- `upsertStaff(profileId, { skills, capacity, active })` — manage `staff_profiles`.
- `rateStaffWork(orderId, score, note)` — writes/updates `order_ratings` (one per admin per order).

## 7. Testing

- **Unit (pure):** `qualityScore(deliveries, changesRounds)` (100 with no rework; baseline when no
  data; decreases with rework); `composite(quality, manualAvg)` (weights; quality-only when no
  manual); `responseHours` aggregation.
- **Integration:** rating an order updates `manualAvg`/`composite`; a changes-requested round lowers
  `quality`; the `staff_performance` view returns correct aggregates against seeded orders.

## 8. Open (tune after trial)

- Composite weights `W_QUALITY` / `W_MANUAL`; `WINDOW` length; `BASELINE` for new staff.
- Whether quality should weight by recency or severity of rework.
- Whether to expose a customer-facing rating later (currently admin-only).
