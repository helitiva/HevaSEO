# Page-Crawler Pipeline — Final Report

End-to-end run of the [PLAN.md](./PLAN.md) pipeline over all 89 routes / 5 role surfaces.
Engine: code-read primary, dev server as verify layer. Ran unattended in bypass-permissions.

## What ran
| Phase | Output | Commit |
|---|---|---|
| 0 Scaffold | manifest (89 routes), rubric, runbook | `6148938` |
| 1 Audit | 5 per-surface audits + INDEX | `9b06d5f` |
| 2 Document | FEATURES, DATA-MODEL, PROJECT-GUIDE | `25b9905` |
| 3a Fix — dates | single-source `lib/today.ts` (22 files) | `d0393d5` |
| 3b Fix — HIGH | view-only RBAC, dashboard, support, notes seed | `8a54a1e` |
| 3c Fix — metadata | 69 pages + projects layout | `cb94d41` |
| 3d Fix — a11y | aria-hidden + aria-label (104 files) | `8c800a5` |
| 4 Reconcile | this report + doc gap updates | (this commit) |

Verification gate held every batch: `tsc --noEmit` clean + 339/339 vitest passing, plus
live render smoke-checks. (A mid-sweep smart-quote regression in 3 files was caught by tsc and
fixed before commit — tests alone missed it because those components aren't test-imported.)

## Fixed (before → after)
| Finding | Severity | Before | After |
|---|---|---|---|
| Staff view-only contract | HIGH (RBAC) | manager `view` mode could mutate tasks/notes/settings | controls disabled **and** handlers short-circuit (defense-in-depth), matching `/staff/finance` |
| Customer dashboard fake metrics | HIGH | hardcoded 96%/100% on-time + frozen `TODAY` | honest relabel (no `onTime` field exists) + `TODAY`→`useMemo(mockTodayDate)` |
| Support localhost URLs | HIGH | `http://localhost:4330` FAQ links 404 in prod | relative in-app paths |
| Customer notebook seed leak | HIGH | staff placeholder notes seeded into customer notebook | `seedForSurface()` — customer starts empty |
| Divergent `TODAY` anchors | MEDIUM systemic | 15+ literals, values `06-24`..`06-28` | one `lib/today.ts` (`MOCK_TODAY` + helpers) |
| Missing `metadata` | LOW systemic | staff 0/17, manager 0/20, admin 27/28 | every route has a tab title |
| Decorative icons unlabelled | LOW systemic | ~536 `<i>` glyphs read aloud by SR | `aria-hidden` everywhere; icon-only controls get `aria-label` |

## Verified still healthy
- **Manager money-blind invariant: PASS** — re-confirmed after the date batch; 4 enforcement layers intact.
- No security regressions; `dangerouslySetInnerHTML` still routes through `sanitizeHtml.ts`.

## Deferred (recommended follow-ups, not in this run's scope)
- **Module-scope singletons** — `STAFF_NOTIFICATIONS` / `MY_AVAILABILITY` keyed to demo persona `s3`
  (impersonation shows wrong person); affiliate `programStats()`/`joinOffer()` read at module load
  (frozen "paid last month" + countdown). Need per-request/persona-aware reads. (MEDIUM)
- **`notFound()` on edit routes** — `/admin/docs/[id]/edit`, `/admin/notes/[id]/edit` (+ peers) render
  blank editors for unknown ids. (MEDIUM)
- **`Suspense fallback={null}`** on admin finance/affiliate → replace with skeletons. (MEDIUM)
- **Hardcoded illustrative stats** — affiliate "3× more", manager `avgFirstResponseH=1.8`. Source or
  mark illustrative. (MEDIUM)
- **Bare inbox pages** — affiliate + manager inbox got `metadata` but still lack a `PageHeader`. (LOW)
- **Financial fields in manager hydration payload** — never rendered, but strip at the data layer once
  real auth lands. (MEDIUM, backend-era)
- **Mock `MOCK_TODAY`** — now single-sourced; swap to a real clock in `lib/today.ts` at backend. (backend-era)

## For backend implementation
The handoff set is: [DATA-MODEL.md](../DATA-MODEL.md) (entities → tables → API surface),
[FEATURES.md](../FEATURES.md) (feature↔role↔data maps), and the "Mock→backend gaps" sections.
The single biggest unresolved architectural decision (flagged independently by 3 docs): the
**Affiliate "role" is absent from `lib/rbac.ts`'s `Role` union** — unify it as a fifth role or keep a
separate auth context.
