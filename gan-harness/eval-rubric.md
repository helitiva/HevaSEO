# GAN Eval Rubric — Staff Surface Phase 2 + T6/T7

**Mode:** code-only (sandbox blocks Playwright/preview). Evaluate by reading code, running
`tsc`/tests, and curling the user's dev server on `http://localhost:4400`.

**Pass threshold:** weighted total ≥ 7.0 / 10. Any HARD INVARIANT failure caps the total at 4.0
regardless of other scores (these are non-negotiable per the spec).

## Dimensions & weights

| Dimension | Weight | What 10 looks like |
|---|---|---|
| Functionality | 0.30 | All 5 staff screens + AvailabilityToggle + T6 (override + leave queue) + T7 (kit moved) exist and render HTTP 200 with correct content; no runtime errors in HTML |
| Invariants (HARD) | 0.25 | Zero money/credit/price in staff screens or staff data; staff actions limited to Start/Submit/Resume; `tsc` clean on new files; tests green |
| Design-system reuse | 0.15 | Uses `dashboard.css` classes + `@heva/ui`; no new CSS framework; matches admin/portal look; light+dark both fine |
| Interaction states | 0.15 | Each screen has empty/loading/error handling; empty states warm + actionable |
| Craft & code quality | 0.15 | Reuses existing components (no duplication), small focused files, follows existing patterns, DRY |

## Scoring procedure (each iteration)
1. `pnpm --filter @heva/app test` → must be green (else Invariants ≤ 3).
2. `pnpm --filter @heva/app exec tsc --noEmit` → ignore the 2 pre-existing errors (GeoPanel, admin/settings SettingsClient); any NEW error → Invariants ≤ 4.
3. For each route, `curl` localhost:4400 → assert 200 + expected markers + no `ReferenceError|TypeError|is not defined|Cannot read|Unhandled Runtime`.
4. Money-leak grep over `src/app/staff/**` and `src/data/staffMock.ts` rendered strings → any hit caps total at 4.0.
5. Confirm staff transition code never emits approve/deliver/cancel/reassign (`nextStaffActions` unchanged + no new transition UI).
6. Confirm T7 move done and admin still renders (`/admin/staff` 200).

## Output
Write `gan-harness/feedback/feedback-{NN}.md` with: per-dimension scores, the weighted total on a
clearly labelled line (e.g. `WEIGHTED TOTAL: 7.4`), PASS/FAIL, and a concrete prioritized fix list
for the generator's next iteration (file:line where possible). If PASS, say so explicitly.
