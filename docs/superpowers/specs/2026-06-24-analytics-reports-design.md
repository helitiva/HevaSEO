# Spec — Analytics & Reports (Admin module 11)

**Date:** 2026-06-24
**Part of:** [Master-Admin Dashboard suite](2026-06-24-admin-dashboard-overview.md).
**Audience:** Master admin.

Read-only analytics over the operational data: revenue, service mix, staff productivity,
quick-checkout conversion, and churn — with a date range and CSV export.

---

## 1. Scope

**In scope:** a reports page with chartable metrics, a global date-range filter, and CSV export of
each report's underlying rows.

**Out of scope:** writing data (purely derived); the at-a-glance home (module 1, which shows live
counts, not trends).

## 2. Dependencies

Reads `orders` (2), `credit_ledger` (9), `staff_performance` (7), `customers` (6). No new tables.

## 3. Reports (v1)

- **Revenue trend**: ledger debits (order_confirmed) per day/week over the range.
- **Service mix**: order count + revenue by `service_key` (which services sell).
- **Order funnel**: counts by status (intake → completed), and cancel rate.
- **Staff productivity**: completed orders + avg quality (module 7) per staff.
- **Quick-checkout conversion**: `source = 'quick'` orders vs dashboard; share + revenue.
- **Churn (basic)**: customers with no order in the last N days vs active.

## 4. Data

- A `reports` query module: one function per report, each taking `{ from, to }` and returning rows
  suitable for both a chart and a CSV. Aggregation in SQL (`group by date_trunc(...)`, `service_key`,
  `status`) — not in JS.

## 5. UI

- `/admin/analytics`: a date-range picker (persisted in URL) + a grid of report cards (charts).
- Each card has an **Export CSV** button (streams the report's rows).
- Charts use a light client chart lib; keep within the app-page JS budget.

## 6. Testing

- **Unit:** date-bucketing + aggregation helpers; CSV serialization.
- **Integration:** each report returns correct aggregates against seeded orders/ledger for a known
  range.

## 7. Open (later)

- Cohort retention; LTV curves; forecast; scheduled email reports (BullMQ digest); saved views.
