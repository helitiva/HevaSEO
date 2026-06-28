# Audit Index — all surfaces

Phase 1 roll-up of the page-crawler pipeline ([PLAN.md](./PLAN.md)). 89 routes, code-read audit
against [RUBRIC.md](./RUBRIC.md). Per-surface detail: [affiliate](./affiliate.md) ·
[customer](./customer.md) · [staff](./staff.md) · [manager](./manager.md) · [admin](./admin.md).

## Coverage
| Surface | Routes | Verdict spread |
|---|---|---|
| Affiliate | 7 | mostly strong; 1 weak (inbox consistency) |
| Customer | 17 | strong/ok mix |
| Staff | 17 | ok; 2 HIGH (view-only, dates) |
| Manager | 20 | strong; money-blind PASS; MEDIUMs |
| Admin | 28 | 11 strong / 12 ok |
| **Total** | **89** | no CRITICALs; security clean |

## RBAC / security verdict
- **Manager money-blind: PASS** — 4 enforcement layers (`rbac.ts` matrix · `ViewerProvider` redacting
  `useMoney`/`useShowMoney` · explicit `showMoney={false}` on `CustomerDetailView` · ops-only
  derivation in `managerPulse`/`managerPerf`). Caveat: financial fields still ride along in the
  manager RSC/hydration payload though never rendered — strip at the data layer once real auth lands.
- **Staff money:** correct by design (staff see their own finance); `StaffTask` type makes leaking
  customer prices a compile error — well engineered.
- **HTML rendering:** all 6 `dangerouslySetInnerHTML` sites are sanitized at save-time via the strict
  `sanitizeHtml.ts` allowlist (no `javascript:` hrefs, no arbitrary iframes). No XSS surface found.

## Severity roll-up (cross-cutting)
### HIGH
- **Staff view-only contract broken** — manager `view` mode can mutate: task Start/Submit
  (`TaskDetailClient`), notes CRUD (`NotesClient`/`NoteFullEditor`), settings (`SettingsClient`).
  `ViewOnlyGuard` only covers `/staff/finance`. → add `useStaffViewOnly()` to those clients.
- **Customer dashboard frozen/fake metrics** — `TODAY = new Date('2026-06-25')` module-scope freezes
  the 7/30/90-day filter; on-time % (96/100) + sparkline are static JSX, not derived.
- **Customer hardcoded `localhost:4330`** in `SupportClient` FAQ links — 404 outside dev.
- **Customer notebook seeds staff notes** — `notesStore` seeds `SEED_NOTES` (staff content) on a
  customer's first visit.

### MEDIUM (systemic)
- **Hardcoded `TODAY`/month anchors** in 15+ files across every surface (`lib/staff.ts`,
  `DashboardTop`, `AuditView`, `review/build.ts`, `assignment/build.ts`, `CustomerDetailView`,
  `staff/[id]/build.ts`, affiliate overview, etc.), several diverging from `MOCK_TODAY` by days.
  Date math (SLA, churn, deadlines, "this month" penalties→$0) breaks silently in real time.
- **Module-scope data singletons** — `STAFF_NOTIFICATIONS` + `MY_AVAILABILITY` (staff) keyed to the
  demo persona so impersonation shows the wrong person's data; affiliate `programStats()`/`joinOffer()`
  read at module load (frozen "paid last month" + countdown).
- **Hardcoded stats presented as real** — affiliate "3× more", manager `avgFirstResponseH=1.8`,
  customer KPIs. Source them or mark illustrative.
- **`notFound()` missing** on `/admin/docs/[id]/edit` + `/admin/notes/[id]/edit` (and customer/manager
  edit equivalents) — blank editor instead of 404 for unknown ids.
- **`Suspense fallback={null}`** on admin finance/affiliate — blank flash before hydration.

### LOW (systemic)
- **Missing `export const metadata`** — staff 0/17, manager 0/20, admin 27/28, customer 6 routes,
  affiliate inbox. Browser tabs show the root title.
- **Decorative `<i className="ph-…">` icons lack `aria-hidden`** — surface-wide screen-reader noise.
- **Bare inbox pages** — affiliate + manager inbox render `<InboxClient/>` with no PageHeader/metadata.

## Phase 3 fix priority
1. Staff view-only guards (HIGH, RBAC correctness).
2. Customer dashboard: real date anchor + derived metrics; fix support URLs; stop seeding staff notes.
3. Centralize a single "today" source; replace scattered literals; fix per-month penalty bug.
4. Convert module-scope singleton reads → per-request/persona-aware.
5. `notFound()` on edit routes; replace `Suspense fallback={null}` with skeletons.
6. Systemic sweeps: `metadata` exports; `aria-hidden` on decorative icons; inbox PageHeaders.

## Next phases
- **Phase 2 (docs):** `FEATURES.md` (feature↔role↔feature↔data), `DATA-MODEL.md` (backend blueprint),
  `PROJECT-GUIDE.md` (dev onboarding).
- **Phase 3:** per-role batched fixes with verify + commit.
- **Phase 4:** reconcile docs + `REPORT.md`.
