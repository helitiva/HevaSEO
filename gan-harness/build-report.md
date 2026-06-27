# GAN Harness Build Report

**Brief:** Build the remaining staff surface (Phase 2 screens + AvailabilityToggle + T6 admin availability/leave + T7 shared-kit move) per `docs/superpowers/specs/2026-06-26-staff-surface-design.md`.
**Result:** ✅ PASS
**Iterations:** 1 / 6
**Final Score:** 9.1 / 10
**Eval mode:** code-only (preview/Playwright blocked in sandbox; verified via tsc + vitest + curl on :4400)

## Score Progression
| Iter | Functionality | Invariants | Design reuse | States | Craft | Weighted |
|------|---------------|------------|--------------|--------|-------|----------|
| 1 | 9 | 10 | 9 | 8 | 9 | **9.1** |

Passed on the first iteration (threshold 7.0), so the generator/evaluator loop stopped.

## Final verification (clean)
- `pnpm --filter @heva/app test` → 34 passed (16 PR1 + 18 Phase 2).
- `pnpm --filter @heva/app exec tsc --noEmit` → fully clean (the generator installed `react-simple-maps`/`world-atlas`, which also cleared the pre-existing GeoPanel errors).
- Routes 200: `/staff`, `/staff/tasks`, `/staff/calendar`, `/staff/deliverables`, `/staff/performance`, `/staff/notifications`, `/staff/settings`, `/admin/staff/leave`, `/admin/staff`.
- HARD invariants hold: no money/credit in staff surface; staff transitions limited to Start/Submit/Resume (Approve/Decline exist only on the admin leave queue).

## Files created
Staff: `app/staff/{calendar,deliverables,performance,notifications,settings}/page.tsx` (+ `notifications/NotificationsClient.tsx`, `settings/SettingsClient.tsx`); `components/staff/{AvailabilityToggle,DeadlineCalendar,Sparkline,StaffStates}.tsx`; `lib/{availability,leave,calendar}.ts`; `lib/staffPhase2.test.ts` (18 specs).
Admin (T6): `app/admin/staff/leave/{page.tsx,LeaveQueueClient.tsx}`; availability override in `app/admin/staff/[id]/StaffProfileClient.tsx`; `LEAVE_REQUESTS` in `adminMock.ts`.
T7: moved `KpiTile, StatBadge, DataTable, PageHeader, SlideOver` → `components/shared/`, imports rewritten across admin + staff.

## Remaining issues (P3 polish — non-blocking, flagged by the evaluator)
1. `AvailabilityToggle` state isn't persisted across reloads (mock-only; fine until backend).
2. `lib/leave.ts` could guard against past dates / max reason length.
3. `notifications/NotificationsClient.tsx` had a near-duplicated empty-state block.

## Harness files
`gan-harness/spec.md`, `gan-harness/eval-rubric.md`, `gan-harness/feedback/feedback-01.md`, `gan-harness/build-report.md`.
