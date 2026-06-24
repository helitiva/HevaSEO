# Spec — Command Center / Overview (Admin module 1)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

The admin home (`/admin`): an at-a-glance operational picture with KPI tiles, attention queues, and
quick links into filtered module views. Read-only; it aggregates other modules' data.

---

## 1. Scope

**In scope:** KPI tiles, "needs attention" lists, recent activity, quick links. Realtime refresh.

**Out of scope:** every metric drills into its owning module; deep analytics is module 11.

## 2. Dependencies

Reads `orders` (2), `credit_ledger` (9), `tickets` (5), `audit_log` (12), `staff_performance` (7).
Built last enough that these have data; ships thin first, expands as modules land.

## 3. Content

- **KPI tiles**: New orders (intake) · In progress · **Overdue** · Awaiting approval (`delivered`)
  · Revenue today / MTD · Open tickets · Unassigned orders.
- **Needs attention** lists: overdue orders, orders awaiting approval, unassigned orders,
  high-priority open tickets — each row links to the filtered module view.
- **Staff load**: compact per-staff open-load bar (from module 3 workload).
- **Recent activity**: latest `audit_log` entries.

Each tile links to the corresponding filtered route, e.g. Overdue → `/admin/orders?status=...`
(the orders table already supports URL filters).

## 4. Data

- A `getDashboardKpis(db)` query module returning counts + revenue sums in one round of parallel
  queries (`Promise.all`).
- Revenue = sum of debits (`credit_ledger` where reason = order_confirmed) within the period, or
  sum of completed order `value_cents` — pick the ledger-based figure for consistency with Finance.

## 5. UI

- `/admin/page.tsx` (server component) renders tiles + lists from `getDashboardKpis`.
- A thin client wrapper subscribes to `orders` Realtime to refresh counts without reload.

## 6. Testing

- **Unit:** KPI derivations (overdue count uses module-2 SLA logic; revenue sum).
- **Integration:** `getDashboardKpis` returns correct aggregates against seeded data.

## 7. Open (later)

- Sparkline trends on tiles; customizable tile layout; date-range selector (defers to module 11).
