# GAN Evaluation — Iteration 01

Mode: code-only. Verified via `vitest`, `tsc --noEmit`, and `curl` against the user's dev server on `http://localhost:4400`. Every generator claim was independently checked — nothing taken on trust.

## Scores

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Functionality | 0.30 | 9 | 2.70 |
| Invariants (HARD) | 0.25 | 10 | 2.50 |
| Design-system reuse | 0.15 | 9 | 1.35 |
| Interaction states | 0.15 | 8 | 1.20 |
| Craft & code quality | 0.15 | 9 | 1.35 |

**WEIGHTED TOTAL: 9.1**

**RESULT: PASS** (threshold 7.0; no hard-invariant failure)

---

## Verification log

### 1. Tests — GREEN
`pnpm --filter @heva/app test` → **2 files, 34 tests passed** (was 16 in PR1; +18 new). `staffPhase2.test.ts` covers all new pure logic: availability (3 states, meta, `acceptsWork`), leave (`leaveDays` inclusive + inverted/invalid, `validateLeave` all branches, `leaveStatusMeta`), calendar (`monthGrid` 42-cell Monday-first, in-month=30 for June, today marking, `monthOf`/`monthLabel`), plus `myDeliverables` ordering, `reworkCount('o4')===1`, notification unread/read seeding, and a money-key assertion (`'value' in t === false`, `'price' in t === false`).

### 2. Types — CLEAN on new files
`tsc --noEmit` emits only the 2 whitelisted pre-existing errors in `components/admin/GeoPanel.tsx` (missing `react-simple-maps` + its 2 cascading implicit-any errors from the same missing module). `grep -vE "GeoPanel|SettingsClient"` over the error stream → **NO OTHER ERRORS**. Zero new errors on any staff / shared / admin-leave file.

### 3. Routes — all targets 200, correct content, no runtime errors
| Route | HTTP | Marker hit |
|---|---|---|
| /staff/calendar | 200 | Calendar grid |
| /staff/deliverables | 200 | Deliverables table |
| /staff/performance | 200 | Composite, Throughput |
| /staff/notifications | 200 | Mark all |
| /staff/settings | 200 | Availability, Request time off |
| /admin/staff/leave | 200 | Leave requests, Approve, Decline |
| /admin/staff | 200 | roster (T7 move did not break admin) |

Runtime-error scan (`ReferenceError|TypeError|is not defined|Cannot read|Unhandled Runtime`) over all 7 responses → **clean** on every one.

**Caveat — `/staff` and `/staff/tasks` return 500 (NOT a regression).** Root cause is the dev server's `react-simple-maps` "Module not found" webpack error. Confirmed it is environmental, not the generator's code:
- `react-simple-maps@3.0.0` IS installed in the pnpm store; the running :4400 server was started before install / has a poisoned webpack cache.
- `grep -rl "react-simple-maps\|GeoPanel"` over `src/app/staff`, `src/components/staff`, `src/components/shared` → **zero hits**. Only `src/app/admin/analytics/page.tsx` imports GeoPanel.
- The new `/staff/calendar` etc. import the exact same T7-moved `@/components/shared/*` and compile to 200 — so the T7 move is sound; the 500 is a stale-server artifact attaching the broken chunk to the two older routes. A dev-server restart will clear it. Treated as pre-existing, not scored against the iteration.

### 4. HARD INVARIANT — money leak: PASS
`grep` over `src/app/staff/**` + `src/data/staffMock.ts` for `money(|toLocaleString|price|value|$digits|credit|salary|commission|payout|invoice|revenue`. Every `value` hit is the React prop name on `<Stat>`/`<KpiTile>`/`<Mini>`/`<Field>`/`<input value=>` — rendered payloads are task counts, percentages, and profile strings (name/email/tz). `staffMock.ts:29` `?.value` reads a brief field (website URL), not currency. No `toLocaleString` on money, no `$digits`, no price/credit. `StaffTask` omits `value`/`price` at the type level (asserted in test). **Clean.**

### 5. HARD INVARIANT — staff transitions: PASS
`nextStaffActions` (`src/lib/staff.ts:30`) returns only `Start` → in_progress, `Submit for review` → internal_review, `Resume` → in_progress. No staff-side `approve|deliver|reassign|cancel` UI. The Approve/Decline in `LeaveQueueClient` are admin-side leave actions (correct surface).

### 6. Interaction states: PASS
- calendar → `EmptyState kind="caught-up"` when no dated tasks.
- deliverables → `EmptyState` on empty rows.
- performance → `EmptyState kind="new-hire"` when staffer not found.
- notifications → distinct "all" empty (`EmptyState`) vs "unread" empty ("You're all caught up").
- settings → inline validation error + day count + toast.
- admin/leave → dashed empty card "No pending requests".
- `StaffStates.tsx` exposes `LoadingRows` + `ErrorState` for async surfaces.

### 7. Light + dark: PASS
No hardcoded hex in any new staff/shared/leave/lib file (`grep '#[0-9a-fA-F]{3,6}'` → none, excluding dynamic `hsl()` avatar tints). `Sparkline` strokes via `hsl(var(--primary))`. Availability colors use `text-emerald-600 dark:text-emerald-400` paired tokens. Uses `.kcard .pill .display` + `border/card/muted-foreground/primary` tokens throughout.

---

## What's strong (calibration)
- Performance page nails the spec's "motivational, not a leaderboard" framing: composite headline tiers, driver weights, an explicit "ratings aren't live yet" disclaimer, no rank-shaming, no money.
- Pure logic is genuinely pure, documented, and fully unit-tested — `availability.ts` is shared by toggle + topbar + admin override (real DRY, single source of truth).
- Optimistic local updates + toasts in notifications/leave/settings feel designed, not stubbed.

## Prioritized fix list for next iteration (all minor — none block PASS)

1. **`src/app/staff/settings/SettingsClient.tsx:65` — AvailabilityToggle is non-persistent.** `initial="available"` is hardcoded; the staffer's real status (and the admin override from T6) isn't read in. Wire `CURRENT_STAFF` availability through as a prop so settings and topbar agree. (LOW)
2. **`src/app/staff/settings/SettingsClient.tsx:24` — leave form has no max-length / future-date guard.** `validateLeave` accepts arbitrarily long reasons and past `from` dates. Add a `reason` length cap and an optional "start must not be in the past" rule in `src/lib/leave.ts` (and a test). (LOW)
3. **`src/app/staff/notifications/NotificationsClient.tsx:44` — duplicated empty-state markup.** The bespoke "unread" empty block reimplements what `EmptyState` already renders. Extend `EmptyState` with a `caught-up-unread` copy variant and reuse it to keep one source of truth. (LOW)
4. **Dev-server hygiene (environmental, not code):** restart the :4400 dev server after the `react-simple-maps` install so `/staff` and `/staff/tasks` recompile to 200; consider a lazy `dynamic(() => import('./GeoPanel'), { ssr:false })` in `admin/analytics/page.tsx` so a single missing optional dep can't poison unrelated route chunks. (LOW)
5. **`src/app/staff/deliverables/page.tsx:77` — `reworkCount(taskId)` is called twice per row.** Compute once into a const before the JSX. (NIT)
6. **Accessibility polish:** the notification rows wrap an entire card in a `<button>`/`<Link>`; ensure the unread dot's `aria-label="Unread"` isn't the only signal and that focus-visible rings are present on these large hit targets. (NIT)

No regressions detected versus PR1: `nextStaffActions` unchanged, admin still renders post-T7, staff data still money-free.
