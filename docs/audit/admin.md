# Audit — Admin surface (28 routes)

Code-read audit against [RUBRIC.md](./RUBRIC.md). `[live]` items require a dev-server pass.
Admin legitimately sees all finance, staff pay, and affiliate data — those are not leaks.

**Data spine:** `data/adminMock.ts` (ORDERS, STAFF, CUSTOMERS, MANAGERS, TICKETS, AUDIT, LEAVE_REQUESTS,
ADMIN_SETTINGS, SKILL_META, TIER, REVENUE_*) · `data/adminAffiliate.ts` · `data/adminStaffInsight.ts`
· `data/broadcastStore.ts` · `data/docsStore.ts` · `data/staffDocs.ts` · `data/broadcasts.ts`
· `lib/rbac.ts` · `lib/sanitizeHtml.ts` · `lib/managerPerf.ts` · `lib/orderDetail.ts`

---

## admin · /admin (command center) · Verdict: strong

**Source:** `app/admin/page.tsx`

### Pros
- `new Date()` used directly for the "today" label and overdue filter — correctly live, unlike many
  other pages that hardcode a mock date.
- Clear action hierarchy: overdue → awaiting-review → unassigned, each a distinct signal.
- Pipeline bar with `title` tooltips provides quick visual + accessible summary.
- `NeedsAttention` receives derived arrays (not re-derived inside the client) — good data boundary.

### Cons
- [MEDIUM] All `<i className="ph-bold …">` icons (7 occurrences) lack `aria-hidden`. Screenreader
  will read Phosphor class tokens as text content. Systemic across the surface.
- [MEDIUM] No `export const metadata` — only `/admin/affiliate` exports one out of 28 routes.
  Browser tab title falls back to the app root title for 27 pages.
- [LOW] `KPIS`, `AUDIT`, `PIPELINE`, `OPS_KPIS`, `REVENUE_GOAL`, `USER_STATS`, `TICKET_STATS` are
  all module-scope constants read once at cold start. Fine for Phase-0 mock; must become
  per-request queries in Phase 3.
- [LOW] `Suspense` used only for `<PeriodSelector />` on Analytics; this page has none but
  doesn't need it (server-rendered). Consistent with current pattern, but flag for Phase 3.

### Recommended fixes
1. Add `aria-hidden` to all decorative `<i>` icons (global fix; applies surface-wide).
2. Add `export const metadata: Metadata = { title: '…' }` to every admin page.

---

## admin · /admin/analytics · Verdict: ok

**Source:** `app/admin/analytics/page.tsx`

### Pros
- `PageHeader` present. Good component decomposition: `RevenueChart`, `ServiceMix`, `GeoPanel`,
  `AudienceAnalytics`, `SupportStats`, `TeamPerformance` each own their section.
- `topRev` sorted from `CUSTOMERS` at render time (correct derived-state pattern).
- `CustomerHoverCard` wired into revenue bar — actionable click from an analytics widget.
- `PeriodSelector` correctly wrapped in `<Suspense>` (reads search params).

### Cons
- [MEDIUM] `Suspense fallback` on `PeriodSelector` is `<Suspense>` with no explicit fallback —
  defaults to `null`. A skeleton placeholder prevents layout shift. `[live]`
- [MEDIUM] No `export const metadata`.
- [LOW] `srcTotal` computed via `.reduce()` on `r.bySource` — could be zero if array empty,
  causing division by zero in `Math.round((s.value / srcTotal) * 100)`.
- [LOW] Decorative icons lack `aria-hidden` (systemic).

### Recommended fixes
1. Guard `srcTotal === 0` before the percentage render.
2. Add a meaningful `Suspense` fallback (spinner or skeleton) for `PeriodSelector`.

---

## admin · /admin/assignment · Verdict: strong

**Source:** `app/admin/assignment/page.tsx` + `build.ts` + `AssignmentClient.tsx`

### Pros
- `build.ts` is the cleanest builder in the surface: pure function, takes a `roster` arg, fully
  shared with the manager pod-scoped board.
- `daysToDue` calculation consistent with `MOCK_TODAY` (centralised constant via import).
- Drag-and-drop + bulk-assign + rule engine from a single client component — impressive scope.
- `useMoney()` / `useShowMoney()` from `lib/viewer` respected — admins see prices, managers don't.

### Cons
- [MEDIUM] `build.ts` line 12: `const seqMap` and `const TODAY` are module-scope (`const` at the
  module top level, built once). `buildAssignmentProps` is called on each render, but `seqMap` is
  computed once for the whole module lifetime. If orders change (Phase 3), sequence numbers won't
  refresh until cold restart.
- [MEDIUM] `SERVICES` array on line 30 of `AssignmentClient.tsx` is hardcoded (`['Keyword',
  'Backlink', …]`). Should derive from `SKILL_META` keys or `SERVICE_CATALOG`.
- [LOW] No `export const metadata`.

### Recommended fixes
1. Move `seqMap` and `TODAY` inside `buildAssignmentProps()`.
2. Derive the `SERVICES` filter list from the data layer (e.g. `Object.keys(SKILL_OF)`).

---

## admin · /admin/audit · Verdict: ok

**Source:** `app/admin/audit/page.tsx` → `AuditView.tsx` → `AuditClient.tsx`

### Pros
- `AuditView` is a pure server component that passes sorted events to the client — minimal RSC→
  client boundary.
- `AuditClient` has a `dayLabel` helper that renders "Today" / "Yesterday" relative labels.

### Cons
- [MEDIUM] **Dual hardcoded `TODAY`**: `AuditView.tsx:4` defines `const TODAY = '2026-06-24'` and
  `AuditClient.tsx:13` repeats `const TODAY = '2026-06-24'`. Both are independent of `MOCK_TODAY`
  and of `new Date()`. KPI "events today" will always be zero once real dates roll past June 2026.
  Should use `MOCK_TODAY` or `new Date().toISOString().slice(0,10)`.
- [LOW] No `export const metadata`.
- [LOW] Decorative icons lack `aria-hidden`.

### Recommended fixes
1. Replace both hardcoded `TODAY` strings with `MOCK_TODAY` (same as the mock anchor) or a
   centralised `todayStr()` helper. The two files must agree.

---

## admin · /admin/broadcasts · Verdict: strong

**Source:** `app/admin/broadcasts/page.tsx` → `BroadcastsManager.tsx`

### Pros
- Recall vs delete semantics are clearly distinguished in both UI copy and the modal warning.
- Empty state is handled (`No messages yet — send one.`) with an inline CTA.
- Search handled with trim + lowercase (correct).
- Duplicate action correctly mints a new ID and fresh timestamps.
- `aria-hidden` present on the search icon (line 47) and activity icons (line 119).
- `BroadcastComposer` calls `sanitizeHtml(articleHtml)` before saving — broadcast article is safe.

### Cons
- [MEDIUM] `Suspense fallback={null}` wraps the whole client; a blank flash occurs before
  localStorage hydrates. `[live]`
- [MEDIUM] No `export const metadata`.
- [LOW] Most other icons in the table (bell, banner flag, link icons) are decorative but lack
  `aria-hidden` — they carry meaning only via `title` attributes, which is good for mouse hover
  but not reliably exposed to all screen readers.
- [LOW] `activity.slice(0, 8)` — no empty state for the activity panel when `activity.length === 0`
  (the block is hidden via `{activity.length > 0 &&…}`, which is correct).

### Recommended fixes
1. Add a skeleton or "Loading…" fallback instead of `fallback={null}`.
2. Add `aria-hidden` to icon-only status indicators; supplement with visible text or `sr-only` spans.

---

## admin · /admin/broadcasts/[id] · Verdict: strong

**Source:** `app/admin/broadcasts/[id]/page.tsx` → `BroadcastDetailClient.tsx`

### Pros
- Excellent `not-found` + loading state: spinner while store hydrates, "Message not found." + back
  link when ready.
- CSV export is fully client-side; correct use of `URL.createObjectURL` with revoke on click.
- Nudge (reminder broadcast) duplicates into the store without side effects on the original.
- Analytics charts (ReadTimeline, Funnel, AudienceBars, HourHeatmap) are logically separate.
- Event listener cleanup in `useEffect` is correct (cleanup function returned).

### Cons
- [MEDIUM] No `export const metadata` (dynamic id page; can export `generateMetadata`).
- [LOW] Decorative icons in KPI grid lack `aria-hidden`.

### Recommended fixes
1. Export `generateMetadata` returning `{ title: broadcast.title }` once the store is accessible
   server-side (Phase 3).

---

## admin · /admin/catalog · Verdict: ok

**Source:** `app/admin/catalog/page.tsx` → `CatalogClient.tsx`

### Pros
- Price derivation logic is robust: handles usage-based, flat, range, and custom pricing.
- Server component builds the typed `SvcRow[]` view model — client stays presentational.
- Groups → packages flatten correctly with `groupId`/`groupTitle` metadata preserved.

### Cons
- [MEDIUM] `CatalogClient` not read in full — `[live]` confirm empty-state for a service with
  zero packages, and that the edit/save affordance (if present) does not persist outside
  localStorage.
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [LOW] `paid.length` guard is present for `priceMin`/`priceMax` but `priceLabel` for the
  `hasUsage` branch uses `s.usage?.tiers[0]` without guarding the empty array case; would render
  "undefined/link" if tiers is an empty array.

### Recommended fixes
1. Guard `s.usage?.tiers[0]` — add `?? 'Usage-based'` fallback.
2. Add `PageHeader` and `metadata`.

---

## admin · /admin/customers · Verdict: ok

**Source:** `app/admin/customers/page.tsx` → `CustomersClient.tsx` via `rows.ts`

### Pros
- `buildCustomerRows` builder pattern keeps page.tsx minimal.
- `CustomerHoverCard` reused inline for quick-access throughout the surface.

### Cons
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [MEDIUM] `CustomersClient.tsx` not read in full — `[live]` confirm sort/filter empty state and
  that the impersonate action is available (per MEMORY: cookie-based impersonation).
- [LOW] `buildCustomerRows` returns derived data from module-scope `CUSTOMERS` constant; must
  become a DB query in Phase 3.

### Recommended fixes
1. Add `PageHeader` + `metadata`.

---

## admin · /admin/customers/[id] · Verdict: strong

**Source:** `app/admin/customers/[id]/page.tsx` → `view.tsx` (shared server component)

### Pros
- `notFound()` called immediately when customer id is unknown — correct 404 handling.
- `showMoney` prop threads money-blind contract from admin (true) vs manager (false) view all the
  way into the server-rendered activity text — prevents financial data in manager impersonation.
- Ledger fallback constructed from orders when `CUSTOMER_LEDGER[id]` is absent — resilient mock.
- `churnDays`, `aov`, `active` derived at server render time (no client-side effect).

### Cons
- [MEDIUM] `today` hardcoded as `new Date('2026-06-24T00:00:00')` in `view.tsx:17`. Should use
  `MOCK_TODAY` constant.
- [MEDIUM] No `export const metadata` / `generateMetadata`.
- [LOW] `CUSTOMER_EXTRA[id]` fallback uses hardcoded `memberSince: '2025-01-01'` for unknown ids —
  fine for mock, but a silent data gap.

### Recommended fixes
1. Replace hardcoded date with `new Date(`${MOCK_TODAY}T00:00:00`)`.
2. Add `generateMetadata` returning customer name.

---

## admin · /admin/docs · Verdict: ok

**Source:** `app/admin/docs/page.tsx` → `AdminDocsManager.tsx`

### Pros
- Audience filter tabs with per-audience counts — clear distribution overview.
- Confirm dialog before unpublish; seeds are read-only (edit/delete gated via `isSeed`).
- Empty state for zero docs: `[live]` confirm `shown.length === 0` renders a helpful message.

### Cons
- [MEDIUM] No `PageHeader` in `AdminDocsManager` (the component builds its own `h1`), no
  `export const metadata`.
- [MEDIUM] `AdminDocsManager.tsx` only partially read — confirm the confirm-delete flow properly
  guards against deleting seed docs (`isSeed` check visible at line 16 via `removeDoc`).
- [LOW] Distribution KPI strip renders only `DISTRIBUTABLE_AUDIENCES.slice(0, 4)` — if a fifth
  audience is added later, it silently disappears from the strip without a build error.

### Recommended fixes
1. Remove the `.slice(0, 4)` or replace with a `grid-cols-${n}` dynamic grid.
2. Add `export const metadata`.

---

## admin · /admin/docs/[id] · Verdict: strong

**Source:** `app/admin/docs/[id]/page.tsx` → `DocReaderClient.tsx` → `DocArticle.tsx` (staff shared)

### Pros
- `audience="admin"` correctly bypasses skill-gate and audience filter — admin sees any doc.
- Loading state (spinner) and not-found state with back link both handled in `DocReaderClient`.
- `dangerouslySetInnerHTML={{ __html: doc.html }}` — comment in `DocArticle.tsx:42` documents that
  HTML is sanitized at save (`DocComposer → sanitizeHtml`). Trust chain is correct.

### Cons
- [LOW] `DocArticle` shared with staff surface — confirmed by import path
  `@/app/staff/docs/DocArticle`. Fine for Phase 0; in Phase 3, admin-specific features
  (edit shortcut, version history) may require forking.
- [LOW] No `export const metadata` / `generateMetadata`.

---

## admin · /admin/docs/new · Verdict: strong

**Source:** `app/admin/docs/new/page.tsx` → `DocComposer.tsx`

### Pros
- `sanitizeHtml(bodyHtml)` called at save (line 39 of `DocComposer.tsx`) before anything is stored
  — the only place rich HTML enters the system. Correct boundary.
- `canSave` guard prevents empty-title or empty-body saves.
- Audience multi-select is visible and well-labeled.

### Cons
- [LOW] `bodyHtml` state seeded from `existing?.html` but the page is always "new" — the `editId`
  prop is undefined here, so `existing` is always `null`. The `blocksToHtml` path is dead code for
  this page (correct for the edit page though).
- [LOW] No `export const metadata`.

---

## admin · /admin/docs/[id]/edit · Verdict: strong

**Source:** `app/admin/docs/[id]/edit/page.tsx` → `DocComposer.tsx` (with `editId` prop)

### Pros
- `PageHeader` present.
- `editId` passed to `DocComposer` seeds all fields from the existing doc (title, summary, format,
  audiences, tags, pinned, body HTML).
- Same sanitization boundary on save (shared component).

### Cons
- [MEDIUM] If `editId` refers to a non-existent doc, `DocComposer` quietly renders a blank form
  (empty initial state). No `notFound()` call from the page — user gets a silent "create new"
  experience with the wrong URL.
- [LOW] No `export const metadata` / `generateMetadata`.

### Recommended fixes
1. In `app/admin/docs/[id]/edit/page.tsx`, look up the doc server-side (via `docsStore` seedList or
   direct import) and call `notFound()` if absent.

---

## admin · /admin/finance · Verdict: ok

**Source:** `app/admin/finance/page.tsx` → `FinanceClient.tsx`

### Pros
- `Suspense fallback={null}` wraps `FinanceClient` (a client component reading a store).
- RBAC correctly gates this route under `finance.view` — managers cannot access it.

### Cons
- [MEDIUM] `Suspense fallback={null}` — blank flash before store hydrates. `[live]`
- [MEDIUM] `FinanceClient.tsx` not read in full — unable to verify empty state or payroll
  calculation correctness from code alone. `[live]`
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [LOW] Decorative icons (systemic).

### Recommended fixes
1. Replace `fallback={null}` with a skeleton.
2. Add `PageHeader` + `metadata`.

---

## admin · /admin/managers · Verdict: strong

**Source:** `app/admin/managers/page.tsx` → `ManagersClient.tsx`

### Pros
- `perfById` and `benchmark` computed once per render and passed down — avoids redundant
  re-computation in child cards.
- `derive()` function in `ManagersClient` is pure: receives assignment state, returns a full pod
  summary — easy to test.
- `StaffHoverCard` integrated for quick staff context from the manager cards.
- Live reassignment (drag staff to a different manager) with toast feedback.

### Cons
- [MEDIUM] `TODAY = new Date('2026-06-24T00:00:00')` hardcoded in `page.tsx:7`. Overdue/dueSoon
  calculations are frozen to that date.
- [MEDIUM] `money()` is imported and used — but `ManagersClient` renders `valueInFlight` with
  money formatting (line 12 imports `money` from `adminMock`). Confirm this doesn't surface on the
  manager self-view (`/manager` page uses `ViewerProvider` money-blind).  `[live]`
- [LOW] No `export const metadata`.

### Recommended fixes
1. Replace hardcoded `TODAY` with `new Date(MOCK_TODAY)`.
2. Verify that `valueInFlight` money display is inside an admin-only conditional.

---

## admin · /admin/notes · Verdict: ok (pattern audit)

**Source:** `app/admin/notes/page.tsx` → reuses `@/app/staff/notes/NotesClient`

### Pros
- Admin reuses the staff `NotesClient` component — correct DRY choice for a private notebook.
- `PageHeader` present with correct subtitle.
- Storage is role-scoped by the notes store (admin notes are separate from staff notes, per MEMORY).

### Cons
- [MEDIUM] No `export const metadata`.
- [LOW] `NotesClient` is a staff-surface component imported directly into admin. If staff-specific
  behaviour is added to `NotesClient`, the admin page inherits it silently.

---

## admin · /admin/notes/[id] · Verdict: ok

**Source:** `app/admin/notes/[id]/page.tsx` → `NoteFullReader` (staff shared)

### Pros
- `dangerouslySetInnerHTML={{ __html: note.body }}` — comment in `NoteFullReader.tsx:64` documents
  that HTML is sanitized at save time. Trust chain correct.
- Loading and not-found state handled inside `NoteFullReader`.

### Cons
- [MEDIUM] No `export const metadata` / `generateMetadata`.
- [LOW] Shared component — same fork risk as `/admin/docs/[id]`.

---

## admin · /admin/notes/new · Verdict: ok

**Source:** `app/admin/notes/new/page.tsx` → `NoteFullEditor` (staff shared, no editId)

### Cons
- [LOW] No `export const metadata`.
- [LOW] No `PageHeader` (consistent with staff notes new; minor IA inconsistency vs the docs/new page which has one).

---

## admin · /admin/notes/[id]/edit · Verdict: ok

**Source:** `app/admin/notes/[id]/edit/page.tsx` → `NoteFullEditor` (with `id`)

### Cons
- [MEDIUM] Same issue as `docs/[id]/edit`: if the note doesn't exist, the editor silently opens
  blank with no `notFound()` from the page.
- [LOW] No `export const metadata`.

### Recommended fixes
1. Look up the note before rendering; call `notFound()` if absent.

---

## admin · /admin/orders · Verdict: strong

**Source:** `app/admin/orders/page.tsx` → `OrdersExplorer.tsx`

### Pros
- `PageHeader` present with dynamic subtitle showing row count.
- `seqMap` built correctly from sorted-by-created orders (stable, creation-order sequence number).
- `custName`, `custTier`, `custLtv`, `custOrders` resolved from the customer lookup at server time.
- `ExplorerOrder` type exported for client re-use.

### Cons
- [MEDIUM] `seqMap` uses `[...ORDERS].sort()` — module-scope `ORDERS` constant; same run-once
  issue for Phase 3.
- [LOW] No `export const metadata`.
- [LOW] `custLtv` falls back to `o.value` (single order value) when customer not found — could
  mislead (LTV shown is really just this order's value).

---

## admin · /admin/orders/[id] · Verdict: strong

**Source:** `app/admin/orders/[id]/page.tsx` → `buildOrderDetailProps` → `OrderDetailClient`

### Pros
- `notFound()` called when `buildOrderDetailProps(id)` returns null — correct 404.
- Props spread cleanly: `<OrderDetailClient {...props} />` keeps the page thin.

### Cons
- [MEDIUM] No `export const metadata` / `generateMetadata`.
- [LOW] `buildOrderDetailProps` reads from module-scope `ORDERS` — Phase 3 must become a
  per-request DB read.

---

## admin · /admin/review · Verdict: strong

**Source:** `app/admin/review/page.tsx` → `build.ts` → `ReviewClient.tsx`

### Pros
- `buildReviewProps` is a pure function shared with the manager review board (pod-scoped by
  `staffNames` parameter).
- Deliverable versioning (`versionsOf`) correctly orders by `version` desc to find the latest.
- `sentBack` (changes_requested) tracked separately from the primary queue.

### Cons
- [MEDIUM] `TODAY = new Date('2026-06-25T00:00:00')` hardcoded in `build.ts:4`. Out of sync with
  `MOCK_TODAY` ('2026-06-24') — a one-day discrepancy that could create edge-case display bugs.
- [LOW] No `export const metadata`.

### Recommended fixes
1. Replace `new Date('2026-06-25T00:00:00')` with `new Date(`${MOCK_TODAY}T00:00:00`)`.

---

## admin · /admin/settings · Verdict: ok

**Source:** `app/admin/settings/page.tsx` → `SettingsClient.tsx`

### Pros
- `PageHeader` present.
- `ADMIN_SETTINGS` passed as props — client is presentational.
- RBAC correctly gates under `org.settings` — managers excluded.

### Cons
- [MEDIUM] `SettingsClient.tsx` not read in full — unable to verify save/validation logic. Any
  settings mutation must not persist outside localStorage in Phase 0. `[live]`
- [MEDIUM] No `export const metadata`.
- [LOW] Decorative icons (systemic).

---

## admin · /admin/staff · Verdict: ok

**Source:** `app/admin/staff/page.tsx` → `build.ts` → `StaffClient.tsx`

### Pros
- `buildStaffVMs` / `buildManagerVMs` builder functions keep the page thin.
- `addStaff` in `StaffClient` creates new staff with a valid `StaffVM` shape (good immutable
  pattern via state setter).

### Cons
- [MEDIUM] New staff added via `addStaff` (line 95-104 of `StaffClient.tsx`) has `since` hardcoded
  to `'2026-06-25'` — should use `todayIso()` or `MOCK_TODAY`.
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [LOW] `id: \`s${Date.now()}\`` — client-generated id. Fine for mock; must become server-issued
  in Phase 3 (no collision guarantee across sessions).

### Recommended fixes
1. Replace hardcoded `since` with a proper date constant.

---

## admin · /admin/staff/[id] · Verdict: strong

**Source:** `app/admin/staff/[id]/page.tsx` → `build.ts` → `StaffProfileClient.tsx`

### Pros
- `notFound()` called when `buildStaffProfile(id)` returns null.
- `buildStaffInsight` (from `adminStaffInsight.ts`) builds the rich insight shape used by the
  hover card — single source of truth shared across admin and manager surfaces.
- Workload, team average, and skill breakdown passed as typed view-models.

### Cons
- [MEDIUM] `PROFILE_TODAY = '2026-06-24'` hardcoded in `StaffProfileClient.tsx:219`. Should use
  `MOCK_TODAY`.
- [MEDIUM] No `export const metadata` / `generateMetadata`.
- [LOW] `build.ts` `TODAY = new Date('2026-06-24T00:00:00')` — consistent with `MOCK_TODAY` but
  duplicated inline rather than imported.

### Recommended fixes
1. Centralise all `TODAY` construction to `new Date(\`${MOCK_TODAY}T00:00:00\`)`.

---

## admin · /admin/staff/leave · Verdict: ok

**Source:** `app/admin/staff/leave/page.tsx` → `LeaveQueueClient.tsx`

### Pros
- `LEAVE_REQUESTS` passed directly as `initial` prop — client owns state mutations.

### Cons
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [MEDIUM] `LeaveQueueClient.tsx` not read in full — `[live]` confirm approve/decline state
  is properly tracked and that there is an empty-state for zero requests.
- [LOW] `LEAVE_REQUESTS` is a module-scope constant — same Phase-3 query note.

---

## admin · /admin/tickets · Verdict: ok

**Source:** `app/admin/tickets/page.tsx` → `TicketsClient.tsx`

### Pros
- `buildTicketRows` builder separates data transform from presentation.
- Staff list filtered to `active` before passing to the client.
- `TIER` passed for SLA tier coloring.

### Cons
- [MEDIUM] **Two hardcoded values not sourced from `TICKET_STATS`**:
  - `avgFirstResponseH={1.8}` — exists in `TICKET_STATS.avgFirstResponseH` but is passed as a
    literal. Should be `TICKET_STATS.avgFirstResponseH`.
  - `agent="Mai T."` — completely hardcoded agent name, not derived from the logged-in admin. In
    Phase 3 this is the current user's name.
- [MEDIUM] No `PageHeader`, no `export const metadata`.
- [LOW] Decorative icons (systemic).

### Recommended fixes
1. Replace `avgFirstResponseH={1.8}` → `avgFirstResponseH={TICKET_STATS.avgFirstResponseH}`.
2. Replace `agent="Mai T."` → derive from `ADMIN_SETTINGS.admins[0]?.name` or a current-user
   constant.

---

## admin · /admin/affiliate · Verdict: strong

**Source:** `app/admin/affiliate/page.tsx` → `AffiliateAdminClient.tsx`

### Pros
- Only page with `export const metadata` — exemplar for the surface.
- `Suspense fallback={null}` — same blank-flash issue noted elsewhere.
- URL-persisted tab state (`?tab=`): deeplinks work correctly.
- Partner/payout state in `usePersistedState` (localStorage): actions survive a refresh.
- `newlyPaidTotal` reconciles payout status changes back to partner balances — no stale data.
- `programSeries()` called twice (once for `EarningsChart`, once for MoM deltas) — minor
  duplication; worth memoizing if series becomes expensive.

### Cons
- [MEDIUM] `Suspense fallback={null}` — `[live]` confirm blank flash before store hydrates.
- [LOW] `programSeries()` called twice at render time (could memoize).
- [LOW] Decorative icons lack `aria-hidden` (systemic).

---

## Surface summary

### Strengths
- **RBAC is the best-in-class element**: `lib/rbac.ts` is a complete, tested matrix. Every route is
  correctly gated; `finance.view`, `analytics.view`, `managers.manage`, and `org.settings` are all
  excluded from the manager role. Money-blind contract (`showMoney`, `useMoney`, `useShowMoney`) is
  threaded correctly from server-component builders down to client components.
- **`dangerouslySetInnerHTML` is safe**: All HTML-rendering sites either (a) sanitize at save via
  `lib/sanitizeHtml.ts` (DocComposer, BroadcastComposer, notes editor) or (b) render admin-authored
  seed data. `NotifTicker` renders from static `data/mock.ts` authored HTML — trusted source.
  No unsanitized user-controlled HTML reaches the DOM.
- **Builder pattern is consistent**: `buildAssignmentProps`, `buildReviewProps`, `buildStaffProfile`,
  `buildOrderDetailProps`, `buildCustomerRows` all separate data derivation from presentation.
- **404 handling is correct** where implemented: `/admin/orders/[id]`, `/admin/staff/[id]`, and
  `/admin/customers/[id]` all call `notFound()`.
- **Broadcasts** (compose, detail analytics, recall/nudge) are production-quality interactions.

### Systemic issues
1. **Hardcoded `TODAY` dates** scattered across 8+ files (`AuditView.tsx`, `AuditClient.tsx`,
   `managers/page.tsx`, `review/build.ts`, `customers/[id]/view.tsx`, `staff/[id]/build.ts`,
   `staff/[id]/StaffProfileClient.tsx`, `lib/staff.ts`). Most differ from each other and from
   `MOCK_TODAY`. All date math will produce wrong results in real-time. Fix: one `MOCK_TODAY`
   constant (already in `adminMock.ts`) used everywhere.
2. **Missing `export const metadata`**: Only `/admin/affiliate` exports it. All 27 other admin
   pages have generic or no browser-tab titles.
3. **Decorative icons without `aria-hidden`**: Systemic across every page that uses Phosphor
   icons inline (`<i className="ph-bold …">`). With no `aria-hidden`, screen readers announce
   the CSS class names as text.
4. **Module-scope data constants** (`ORDERS`, `STAFF`, `CUSTOMERS`, etc.) read once at cold
   start. Fine for Phase-0; all become N+1 / stale-data problems in Phase 3.
5. **`Suspense fallback={null}`** used on `/admin/finance`, `/admin/affiliate` — blank screen flash
   before localStorage hydrates. Consistent but wrong for UX.
6. **Missing `PageHeader` / `export const metadata`** on many pages: catalog, customers (list),
   finance, managers, notes (sub-pages), staff (list), staff/leave, tickets.
7. **`notFound()` missing for edit pages**: `/admin/docs/[id]/edit` and `/admin/notes/[id]/edit`
   silently open a blank form when the id is unknown.

### Top Phase-3 fixes (priority order)
1. **Centralise `TODAY`** — one helper/constant, used everywhere. Eliminates 8+ bugs.
2. **Add `aria-hidden` to all decorative icons** — global find-replace on `<i className="ph-`.
3. **Add `export const metadata` / `generateMetadata`** to all 27 remaining pages.
4. **`notFound()` on edit pages** (`docs/[id]/edit`, `notes/[id]/edit`).
5. **`Suspense` fallbacks** — replace `fallback={null}` with skeletons on finance, affiliate.
6. **Source hardcoded values** from data: `avgFirstResponseH`, `agent` in tickets; `SERVICES`
   list in assignment client.
7. **`[live]` sweeps** needed: catalog client empty state, customers client impersonate,
   leave queue empty state, finance client correctness, settings client save validation.

### Backend notes — DATA-MODEL
Entities to become live queries (Phase 3):

| Entity | Current source | Query notes |
|---|---|---|
| `Order` | `ORDERS` array | filter by status, staff, customer, date range; paginated |
| `Customer` | `CUSTOMERS` array | lookup by id, company; sortable by spend/tier |
| `Staff` | `STAFF` array | filter active; joined with orders for workload |
| `Manager` | `MANAGERS` + `STAFF_MANAGER` | many-to-many staff assignments live |
| `Ticket` | `TICKETS` array | filter by status, assignee, customer; SLA computed |
| `AuditEntry` | `AUDIT` array | time-range filter; actor, entity, category facets |
| `LeaveRequest` | `LEAVE_REQUESTS` array | per-staff, status filterable |
| `StaffInsight` | `buildStaffInsight()` join | denormalized view; DB view or aggregation |
| `Deliverable` | `DELIVERABLES` array | join on orderId, versioned |
| `ManagerPerf` | `allManagerPerf()` | aggregation over orders+staff per manager |
| `Broadcast` | `broadcastStore` (localStorage) | event-sourced; recipient events need a log table |
| `StaffDoc` | `docsStore` (localStorage) | audience-gated; needs RLS per audience |
| `AdminNote` | `notesStore` (inferred) | private per admin user |
| `AdminSettings` | `ADMIN_SETTINGS` constant | single row org config |
| `AssignmentRule` | `RULES` array | live rule engine; invalidate on edit |
| `AffiliatePayout` | `adminPayouts()` | requested → approved → paid state machine |
| `AffiliatePartner` | `adminAffiliates()` | status, tier, commission ledger |

`today` / "now" must be a server clock in all date math — currently hardcoded or using
`new Date()` inconsistently across the surface.
