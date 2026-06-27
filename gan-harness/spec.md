# GAN Spec — Staff Surface Phase 2 + T6/T7

**Source of truth:** `docs/superpowers/specs/2026-06-26-staff-surface-design.md` (read it fully).
**App:** `apps/app` — Next.js 15 App Router, React 19, Tailwind + `@heva/ui`, Phosphor icons (`ph-bold`).
**Run app commands with:** `pnpm --filter @heva/app <cmd>`.

## Already built (DO NOT rebuild — reuse)
PR1 core loop is done and verified:
- `src/lib/staff.ts` (pure logic: `daysToDue`, `slaChip`, `nextStaffActions`, `bumpVersion`, `PRIORITY_RANK`)
- `src/data/staffMock.ts` (`StaffTask` omits money; `MY_TASKS`, `deliverablesFor`, `messagesFor`, `BOARD_COLUMNS`, `CURRENT_STAFF`, `statusLabel`), `src/data/staffNav.ts`
- `src/components/staff/{StaffShell,StaffSidebar,StaffTopbar,SlaChip,EmptyState,DeliverableSubmit}.tsx`
- `src/components/shared/MessageThread.tsx`
- `src/app/staff/{layout,page}.tsx`, `src/app/staff/tasks/{page.tsx,[id]/page.tsx,[id]/TaskDetailClient.tsx}`
- `vitest` + `src/lib/staff.test.ts` (16 tests). Run tests: `pnpm --filter @heva/app test`.

Reuse the admin kit where useful: `components/admin/{PageHeader,KpiTile,StatBadge,DataTable,SlideOver}` (T7 below moves these to `components/shared/`). Reuse `data/adminMock.ts` (`STAFF`, `SKILL_META`) for the performance self-view of `CURRENT_STAFF` = Huy N. (id `s3`).

## TO BUILD

### Phase 2 staff screens (under `src/app/staff/`)
1. `calendar/page.tsx` — deadline calendar: week or month grid of `MY_TASKS` by `deadline`, each day showing task chips with `SlaChip`. Empty state when no upcoming deadlines.
2. `deliverables/page.tsx` — submission history table across all tasks: version, kind (file/link), approval status pill, rework count. Source: `deliverablesFor` over `MY_TASKS` ids (add a `myDeliverables` helper to `staffMock.ts` if needed). Empty state.
3. `performance/page.tsx` — READ-ONLY self scorecard for Huy N. (`STAFF.find(s => s.id==='s3')`): KPI tiles for composite/quality/onTime/throughput + a trend sparkline (reuse the `trend` array; render a small inline SVG/`.bar`). Motivational framing, not just a number.
4. `notifications/page.tsx` — inbox list: new assignment / changes requested / deadline reminder / approved. Build a small `STAFF_NOTIFICATIONS` mock in `staffMock.ts`. Read/unread styling. Empty state "You're all caught up".
5. `settings/page.tsx` — profile (name/role/email/tz from `CURRENT_STAFF` + STAFF s3), skills view (read-only chips from `SKILL_META`), `AvailabilityToggle`, a time-off request form (date range + reason → local state + toast "Request sent for approval"), theme toggle. Client where interactive.

### New component
- `src/components/staff/AvailabilityToggle.tsx` — segmented Available / Busy / OOO; local state + toast. Pure helper for label/color if any → unit test it.

### T6 — admin side
- `src/app/admin/staff/[id]/StaffProfileClient.tsx` — add an availability override control (admin can set a staff member's Available/Busy/OOO).
- A leave-approval queue under the admin staff area (e.g. `src/app/admin/staff/leave/page.tsx` or a section): list staff time-off requests with Approve / Decline buttons. Add `LEAVE_REQUESTS` mock to `adminMock.ts`.

### T7 — promote shared kit
- Move `KpiTile, StatBadge, DataTable, PageHeader, SlideOver` from `components/admin/` to `components/shared/`. Update all imports in admin AND staff. Admin must still render. (Re-export shims from the old admin paths are acceptable if cleaner.)

## HARD CONSTRAINTS (pass/fail)
1. NO money/credit/price anywhere in any staff screen or staff-facing data. `StaffTask` keeps omitting `value`/`price` at the type level.
2. Staff may only Start / Submit / Resume. Never Approve / Deliver / Cancel / reassign.
3. Reuse `dashboard.css` classes (`.kpi .pill .prio .bar .kcard .order-panel .display .nav-item .page-anim`). Do NOT invent a new design system or add a CSS framework.
4. Every screen has loading/empty/error states per spec §4. Empty states are warm + carry a next action (use/extend `components/staff/EmptyState.tsx`).
5. `pnpm --filter @heva/app test` stays green; add vitest tests for any NEW pure logic.
6. `pnpm --filter @heva/app exec tsc --noEmit` clean on NEW files. Pre-existing errors are out of scope: `components/admin/GeoPanel.tsx` (missing `react-simple-maps`) and `admin/settings/page.tsx` (missing `./SettingsClient`).
7. Light + dark both work (theme via existing tokens; no hardcoded colors that break dark).

## VERIFY (sandbox: preview harness can't launch pnpm; use the user's dev server on :4400)
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:4400/staff/<route>` → 200 for: `/staff/calendar`, `/staff/deliverables`, `/staff/performance`, `/staff/notifications`, `/staff/settings`, `/admin/staff/leave` (or wherever the leave queue lands).
- `curl` the HTML and grep for expected content + assert NO `ReferenceError|TypeError|is not defined|Cannot read|Unhandled Runtime`.
- Grep every `src/app/staff/**` + `src/data/staffMock.ts` for money leaks: must NOT match `\bvalue\b|\bprice\b|\$\{?[0-9]|toLocaleString|money(`  in staff-facing render output.
- `pnpm --filter @heva/app test` green; `tsc --noEmit` clean on new files.
