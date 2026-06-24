# Spec — HevaSEO Master-Admin Dashboard (Suite Overview)

**Date:** 2026-06-24
**Type:** Suite overview / decomposition (the "table of contents" for the admin dashboard)
**Audience:** Master admin only. Staff get a separate dashboard (out of scope here).

This document maps the **entire** master-admin command center into independent modules,
their dependencies, and a build sequence. Each module gets its own spec → plan → build cycle.
This file is the index; it is not itself an implementation plan.

---

## 1. Goal

A single dashboard where the **master admin** runs all of HevaSEO operations: orders,
fulfillment (assign → staff → deliverable → approve), support tickets, customers, finance,
catalog, and analytics — grounded in the business model:

> Customer → **Admin** (intake, assign) → Staff (execute, submit) → **Admin** approve → Customer accept.

(See `master-plan.md` for the full product plan and chosen stack.)

## 2. Current state (what exists today)

- `apps/app` (Next 15) is a **static mock**: deps are `next`, `react`, `@heva/ui`, `@heva/catalog`.
  **No auth, no DB, no API routes, no middleware.** All data is hardcoded.
- `apps/web` (Astro) is the static marketing site; `/order/[slug]` quick-order flow exists.
- `@heva/catalog` is the shared single source for upsell add-ons (and, per the catalog spec,
  will grow to hold services/packages/prices).
- There is **no backend yet** — every operational module below depends on standing one up.

## 3. Foundation (Wave 0 — prerequisite for everything)

Nothing operational works without this. Build first, once:

- **Supabase self-hosted** (Docker): Postgres + Auth + Storage + Realtime + **RLS**.
- **Master-admin auth** now (single privileged role). The full 3-role system (customer/staff)
  layers on later; design tables + policies so that upgrade is additive, not a rewrite.
- **Admin app shell**: `(admin)/` route group in `apps/app` — layout, sidebar nav, top bar,
  reusing `@heva/ui` tokens and the existing portal design language.
- **Core data model** (~10 tables, from `master-plan.md` §5): `profiles`, `customers`,
  `services`, `packages`, `orders`, `tasks`, `deliverables`, `messages`, `notifications`,
  `credit_ledger`, `audit_log`. Each module spec refines the tables it owns.
- **Data access pattern**: Server Components read; Server Actions write; TanStack Query for
  realtime surfaces. RLS at the DB layer is the real guard; UI gating is secondary.

## 4. Module map

| # | Module | Role | Depends on |
|---|--------|------|------------|
| 0 | **Foundation** | Supabase + master-admin auth + admin shell + core schema | — |
| 1 | **Command Center** (Overview) | At-a-glance KPIs: new/in-progress/overdue orders, revenue today/MTD, staff load, open tickets, pending approvals | 0 |
| 2 | **Order Management** | The spine: intake queue + state machine + filters + detail + timeline + source (quick/dashboard) | 0 |
| 3 | **Assignment & Workload** | **Routing-rules engine**: map service and/or package → one or many staff; **auto-assign on Confirm** (fixed staff, or round-robin/least-busy when a rule matches several); manual override + reassign; fallback to manual when no rule matches; per-staff load + deadlines + SLA | 2, 7 |
| 4 | **Deliverable Review** | Staff submit file/link/version → admin approve / request changes | 2, 3 |
| 5 | **Ticket / Support** | Support inbox: status/priority/assignee, SLA, linked to order/customer | 0 (links 2, 6) |
| 6 | **Customer & User Management** | Customer accounts + profiles (user info), account status (shadow/claimed), **ordered-services history**, **total spend / LTV**, credit balance & ledger, projects/domains, tickets, internal notes; actions: edit, adjust credit, magic-link/impersonate, merge, suspend | 0 (reads 2, 9) |
| 7 | **Staff Management** | Staff accounts, skills, capacity; **performance scoring** — auto (quality from approval/changes-requested ratio + on-time vs SLA + throughput) **and** manual admin rating per order/period; composite staff score + per-order scores + aggregate profile | 0 (reads 2, 4) |
| 8 | **Catalog Management** | Services/packages/prices/add-ons → apply to marketing + dashboard | 0 |
| 9 | **Finance** | Credit ledger, invoices, Stripe, revenue, refunds | 2, 6 |
| 10 | **Messaging / Notifications** | Two-tier messages (internal/customer) + notification center (Realtime) | 2 |
| 11 | **Analytics & Reports** | Revenue trends, service performance, staff productivity, quick-checkout conversion, churn | reads 2, 6, 9 |
| 12 | **Audit Log** | Who did what, when — the "no black box" USP | reads everywhere |
| 13 | **Settings** | Email templates, SLA rules, integrations (Stripe/SMTP/Turnstile), permissions, **admin accounts** | 0 |

**"User" disambiguation:** three account kinds — **customers** → module 6; **staff** → module 7;
**admin accounts** → module 13 (Settings). A customer's *total spend / LTV* and *ordered services*
are derived (read) from `orders` + `credit_ledger`, not stored on the customer row.

## 5. Build sequence (value × dependency)

- **Wave 0** — Foundation.
- **Wave 1** — Command Center + **Order Management** (the spine). *Order Management is the first module specced in detail.*
- **Wave 2** — Assignment + Deliverable Review + two-tier Messaging → closes the fulfillment loop.
- **Wave 3** — Ticket / Support.
- **Wave 4** — Customer + Staff management.
- **Wave 5** — Finance (credit / invoice / Stripe).
- **Wave 6** — Analytics + Audit + Settings.
- **Catalog (module 8)** is independent and already designed — it can land early, in parallel with Wave 1.

## 6. Cross-cutting concerns (apply to every module)

- **Permissions / RLS**: enforced at the DB. Master admin = full now; staff/customer scoping later.
- **Audit log**: every state-changing action writes an `audit_log` row.
- **Notifications / Realtime**: Supabase Realtime pushes; `notifications` table is the inbox.
- **Currency / i18n**: USD primary, EUR secondary (see `master-plan.md` §9).
- **Design system**: reuse `@heva/ui` tokens + existing portal components (kanban, cards, ticker).
- **Testing**: unit (utils, state machine, pricing), integration (Server Actions + RLS policies),
  E2E (Playwright) for critical flows (intake → assign → deliver → approve).

## 7. Spec organization

1. **This overview** — the suite map (committed).
2. **Catalog Management** — `2026-06-24-admin-editable-catalog.md` (foundation) + refined design:
   versioned `catalog_versions` jsonb document, `@heva/catalog` becomes a JSON-artifact loader,
   data-driven marketing landing template, draft → Publish (~1–2 min) → rebuild. Full CRUD incl.
   creating new services (generic landing template).
3. **Order Management** — `2026-06-24-order-management-design.md` (+ implementation plan `plans/2026-06-24-admin-foundation-order-management.md`).
4. **Assignment & Workload** — `2026-06-24-assignment-routing-design.md`.
5. **Staff Management & Performance** — `2026-06-24-staff-performance-design.md`.
6. **Deliverable Review** — `2026-06-24-deliverable-review-design.md`.
7. **Customer & User Management** — `2026-06-24-customer-management-design.md`.
8. **Finance** — `2026-06-24-finance-design.md`.
9. **Ticket / Support** — `2026-06-24-ticket-support-design.md`.
10. **Messaging / Notifications** — `2026-06-24-messaging-notifications-design.md`.
11. **Command Center / Overview** — `2026-06-24-command-center-design.md`.
12. **Analytics & Reports** — `2026-06-24-analytics-reports-design.md`.
13. **Audit Log** — `2026-06-24-audit-log-design.md`.
14. **Settings** — `2026-06-24-settings-design.md`.

All 13 modules now have specs. Each → implementation plan → build, in wave order (the Foundation +
Order Management plan exists; the rest follow).

## 8. Out of scope (this suite)

- Staff dashboard and customer portal surfaces (separate tracks).
- Full 3-role auth/RLS rollout (only master-admin is in scope now; design for additive upgrade).
- Payment provider integration details beyond what Finance (module 9) requires.
