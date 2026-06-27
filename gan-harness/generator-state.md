# Generator State — Iteration 001 (Staff Phase 2 + T6/T7)

## What Was Built
- **Phase 2 staff screens** (all under `apps/app/src/app/staff/`):
  - `calendar/` — Monday-first month grid of deadlines; each day shows task chips colored by SLA tone (overdue/due-soon/upcoming), click opens the task. Prev/next/today month nav. Warm empty state when no dated tasks.
  - `deliverables/` — submission-history table across all board tasks (version, kind, submission, approval-status pill, rework count) + a 3-stat summary. Empty state.
  - `performance/` — READ-ONLY self scorecard for Huy N. (`STAFF[s3]`): composite/quality/on-time/throughput KPI tiles, throughput sparkline (this-week vs last-week delta), "what lifts your score" weighting card, motivational headline. No money, no leaderboard shaming.
  - `notifications/` — inbox (assignment/changes/reminder/approved), read/unread dot styling, all/unread filter, mark-all-read, two empty states.
  - `settings/` — profile (read-only, admin-managed), skills (read-only chips from SKILL_META), `AvailabilityToggle`, time-off request form (validated date range + reason → local list + "Request sent for approval" toast), theme toggle.
- **New components**: `AvailabilityToggle.tsx` (segmented Available/Busy/OOO + toast), `DeadlineCalendar.tsx`, `Sparkline.tsx`, `StaffStates.tsx` (LoadingRows + ErrorState).
- **T6 admin**: availability override (3-way Available/Busy/OOO radiogroup) added to the Capacity & availability card in `admin/staff/[id]/StaffProfileClient.tsx`; new leave-approval queue at `admin/staff/leave/` (Approve/Decline, pending/all filter, empty state) + a "Leave requests" link in the staff roster header. `LEAVE_REQUESTS` added to `adminMock.ts`.
- **T7**: moved `KpiTile, StatBadge, DataTable, PageHeader, SlideOver` from `components/admin/` → `components/shared/` via `git mv`; rewrote all 20 importing files (admin + staff) to `@/components/shared/*`. No leftover admin-kit imports.

## Pure logic + tests (new)
- `lib/availability.ts`, `lib/leave.ts`, `lib/calendar.ts` — all pure, no React, no money.
- `lib/staffPhase2.test.ts` — 18 new vitest specs (availability states, leave validation/day-count, Monday-first 42-cell grid, deliverable flatten/rework, notification seed, no-money key guard). Total suite: **34 passing**.
- Extended `staffMock.ts` with `myDeliverables`, `reworkCount`, `STAFF_NOTIFICATIONS`, `NOTIF_META`.

## Hard constraints honored
- NO money on any staff surface — verified by grep (no `money(`/`toLocaleString`/formatted `$1,250`) and by the StaffTask type still omitting value/price (tsc clean). `$NN` tokens in HTML are React Flight refs, not currency.
- Staff transitions remain Start/Submit/Resume only (untouched `lib/staff.ts`).
- Reused `dashboard.css` classes (`.kpi .pill .prio .bar .kcard .order-panel .nav-item .display .page-anim .toast-in`); no new design system.
- Every new screen has warm empty/loading/error states.
- Light + dark via existing tokens (semantic Tailwind color classes with `dark:` variants).

## Verification
- `pnpm --filter @heva/app test` → 34 passed.
- `pnpm --filter @heva/app exec tsc --noEmit` → clean except the 2 pre-existing GeoPanel/react-simple-maps errors (out of scope per spec §6).
- curl on :4400 — all 200: `/staff/calendar`, `/staff/deliverables`, `/staff/performance`, `/staff/notifications`, `/staff/settings`, `/admin/staff/leave`, `/admin/staff`, `/staff`, `/staff/tasks`. No `ReferenceError|TypeError|...` in any HTML; expected content present.

## Known Issues
- `/admin/analytics`, `/admin/review`, `/admin/tickets` return 500 — **pre-existing**, caused by `react-simple-maps` not being installed (GeoPanel). Unrelated to the T7 move; their only diff from me is the import-path swap. Routes NOT touching GeoPanel (`/admin`, `/admin/orders`, `/admin/staff/s3`) render 200 after the move, confirming the shared kit resolves.

## Dev Server
- URL: http://localhost:4400 (already running, HMR — not restarted)
- Status: running
