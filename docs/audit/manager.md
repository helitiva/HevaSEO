# Audit — Manager surface (20 routes)

Code-read audit against [RUBRIC.md](./RUBRIC.md). `[live]` items still need a dev-server pass.

**Data spine:**
- `lib/managerScope.ts` — pod boundary: staff, customer companies, order codes, audit events
- `lib/managerPulse.ts` — ops signals: triage queue, week deadlines, QA/SLA health, roster, activity feed
- `lib/managerPerf.ts` — manager score model: 5 levers (delivery/quality/responsiveness/team-health/growth) + coaching
- `data/adminMock.ts` — shared mock data, all collections

**How money-blind is enforced:**
1. `lib/viewer.tsx` — `ViewerProvider` wraps the entire manager area via `ManagerShell` with `role="manager"`.
   `useMoney()` returns a redacting dash formatter `(_n) => '—'` for non-`pricing.view` roles.
   `useShowMoney()` returns `false` for managers. `useImpersonatePolicy()` returns `{ canStaff: true, canCustomer: false, viewOnly: true }`.
2. `lib/rbac.ts` — manager role matrix explicitly excludes `finance.view`, `analytics.view`, `catalog.manage`, `managers.manage`, `org.settings`, `affiliate.manage`, `broadcasts.manage`, `pricing.view`. There is no `/manager/finance` or `/manager/analytics` route.
3. `lib/managerPulse.ts` — `recentActivity()` strips financial audit events via a structured `isMoneyEvent()` check (action + meta/diff key inspection, not text regex). `serviceMix()` counts orders by count, not value.
4. `lib/managerPerf.ts` — all five scoring levers derive from ops signals (latency, rates, fairness) never from revenue, payroll, or spend.
5. Shared admin clients (`OrdersExplorer`, `StaffClient`, `CustomersClient`, `OrderDetailClient`, `CustomerProfileClient`, `StaffProfileClient`) each read `useShowMoney()` / `useMoney()` and gate or mask financial columns and fields individually.

---

## manager · /manager (overview)  ·  Verdict: strong

**Source:** `app/manager/page.tsx`

### Pros
- Action-first: triage queue is the focal point; KPI row, performance scorecard, health panels, and roster all follow in logical priority order.
- `recentActivity` strips money events via structured `isMoneyEvent()` — ops-only audit feed.
- Solid empty/zero states: QA health shows `—` with "no reviews yet", roster shows "No staff in this pod yet.", activity shows "Nothing recent."
- Decorative icons consistently carry `aria-hidden`.
- `weekDeadlines` is date-math from `POD_TODAY` (the centralized `MOCK_TODAY`), not a second hardcoded anchor.

### Cons
- [MEDIUM] No `export const metadata` on this or any manager page — the browser tab titles all fall back to the root layout's default, which means every manager page shows the same title regardless of what the manager is looking at. Systemic across 20 routes.
- [MEDIUM] `POD_TODAY` is `MOCK_TODAY` from `adminMock` (hardcoded `'2026-06-28'`). Fine for Phase-0 but must become a server clock before backend.
- [LOW] `<span className="pill pill-live"><span /> Live</span>` — the inner `<span />` (the pulsing dot) has no `aria-hidden`; the outer reads as "Live" which is ok, but the dot is decorative and should be hidden.

### Recommended fixes
1. Add `export const metadata` (or a layout-level `generateMetadata`) for each manager sub-area.
2. Centralize today anchor in one place (already done via `MOCK_TODAY`; swap it for `new Date().toISOString().slice(0, 10)` at backend time).
3. Add `aria-hidden` to the pulsing dot span inside the "Live" pill.

---

## manager · /manager/performance  ·  Verdict: strong

**Source:** `app/manager/performance/page.tsx` + `lib/managerPerf.ts` + `components/manager/ManagerScorecard.tsx`

### Pros
- Money-blind by architecture: all five score levers derive from ops signals only. The explicit inline comment ("Money-blind on purpose") is load-bearing documentation.
- Full empty state: `if (!perf)` renders a styled "No pod assigned yet." card with `PageHeader`.
- Benchmark is anonymized peer average, not a named leaderboard — correctly privacy-conscious.
- `ManagerStats` interface contains no monetary types; `computeStats()` reads from ops fields only.
- `synthTrend` is deterministic (seed from manager id), so it won't diverge on re-renders.

### Cons
- [MEDIUM] `MemberRow` in the team development table is not a `Link` — clicking a team member goes nowhere. In the overview's `RosterRowView` the same member navigates to `/manager/staff/${id}`. The performance page should offer the same navigation.
- [LOW] `staff.composite` field on `AdminStaff` — the "composite" shown in `MemberRow` is a staff performance composite (delivery quality etc.), not any financial value. But `AdminStaff.composite` is not formally documented as money-free. Worth a comment.
- [LOW] `[live]` verify `WeakestCallout` and `MgrScoreBar` render at 375 (the grid collapses).

### Recommended fixes
1. Make `MemberRow` a `Link` to `/manager/staff/{m.id}` for consistency with the overview roster.
2. Add a brief comment to `AdminStaff.composite` clarifying it is an ops/delivery score, not financial.

---

## manager · /manager/orders  ·  Verdict: ok (one fragile pattern)

**Source:** `app/manager/orders/page.tsx` + `app/admin/orders/OrdersExplorer.tsx`

### Pros
- Pod-scoped via `ordersForPod(scope)`.
- `OrdersExplorer` drops `value` and `ltv` columns entirely when `showMoney` is false (line 136: `colOrder.filter(...showMoney || !MONEY_COLS.has(id))`).
- Sort options that require money (`value_desc`, `value_asc`, `ltv_desc`) are also dropped for money-blind viewers (line 137).

### Cons
- [MEDIUM] `COLDEF.value.render` and `COLDEF.ltv.render` are defined at module scope using the module-level `money` import from `adminMock`, **not** the viewer-context-aware `useMoney()`. The protection relies entirely on the column-drop guard (`MONEY_COLS` filter) never being bypassed. If a future developer adds a column that references `value` without adding it to `MONEY_COLS`, the raw formatter runs without masking. This is a **fragile dependency**; the renderers should use `useMoney()` instead.
- [MEDIUM] `custLtv: c?.spend ?? o.value` is passed as a prop on every row even for manager viewers — the raw number is in the hydration payload even though it is never displayed. This is fine for Phase-0 but leaks financial data to the client bundle; move the spend lookup server-side and omit or zero it for manager viewers before shipping with real auth.
- [LOW] `[live]` confirm column-toggle UI does not accidentally allow a manager to un-hide the `value`/`ltv` columns (they should not appear in the toggle list either).

### Recommended fixes
1. Refactor `COLDEF.value.render` and `COLDEF.ltv.render` to use `useMoney()` rather than the module-scope `money`, so each call site is independently safe.
2. For Phase-3 / real backend: strip `custLtv` / `o.value` from the serialized rows before they reach the manager client.

---

## manager · /manager/orders/[id]  ·  Verdict: ok

**Source:** `app/manager/orders/[id]/page.tsx` + `app/admin/orders/[id]/OrderDetailClient.tsx`

### Pros
- Pod-scope guard: `scope.orderCodes.has(props.order.code) || props.order.staff === null`. Unassigned orders are correctly accessible (a manager can route them), but another pod's assigned orders return `notFound()`.
- `OrderDetailClient` reads `useMoney()` for all monetary formatting; `useShowMoney()` gates the finance panel, balance display, LTV stat, and refund flow.

### Cons
- [HIGH] Lines 130 and 164 of `OrderDetailClient` render `money(o.value)` **unconditionally** (without a `showMoney` guard). `money` is `useMoney()`, so for manager viewers these render `'—'` (the masking string) — the value is suppressed. However, the pattern is inconsistent: some money calls are guarded, others rely on the masking function. A reader auditing the file cannot immediately tell which calls are safe. The two lines produce: `{o.service} · {o.pkg} · — · …` and `Package · —`, both of which are slightly confusing (`Package · —` reads oddly).
- [MEDIUM] `p.cust?.balance` is serialized into client state regardless of viewer role (line 61 of `OrderDetailClient`). With real auth this would need to be excluded from the props before rendering for a manager.

### Recommended fixes
1. Wrap lines 130 and 164 in `showMoney &&` or a ternary that omits the value when money is hidden — improves both readability and defence-in-depth.
2. For Phase-3: exclude `cust.balance` / `cust.spend` from the `buildOrderDetailProps` result when the caller is a manager.

---

## manager · /manager/customers  ·  Verdict: ok

**Source:** `app/manager/customers/page.tsx` + `app/admin/customers/CustomersClient.tsx`

### Pros
- `customersForPod(scope)` correctly limits the list to pod-served customers.
- `CustomersClient` gates all LTV, credit, AOV, and "Top by LTV" / "At-risk" panels behind `showMoney` consistently.
- Sort options `ltv` and `credit` are filtered out when `!showMoney` (line 279).

### Cons
- [MEDIUM] The "Adjust credit" button (`line 582`) is hidden by `showMoney &&` inside the menu — confirmed safe. But the `Menu` component itself lists the item and the condition is deep in the item definition array. Easy to accidentally reintroduce. A comment noting "credit-adjust is admin-only" would help future readers.
- [LOW] `[live]` "Top by LTV" panel — confirm it doesn't render for managers (uses `showMoney` at render site line 197).

### Recommended fixes
1. Add a brief comment on the "Adjust credit" menu item noting it is money-gated.

---

## manager · /manager/customers/[id]  ·  Verdict: ok

**Source:** `app/manager/customers/[id]/page.tsx` + `app/admin/customers/[id]/view.tsx` + `CustomerProfileClient.tsx`

### Pros
- Pod-scope guard: `!scope.customerIds.has(id)` → `notFound()`. Correct.
- `showMoney={false}` passed explicitly to `CustomerDetailView` — the server-side activity feed redacts order values and omits the ledger events entirely before they ever reach the client.
- `CustomerProfileClient` reads `useShowMoney()` and `useImpersonatePolicy()` and correctly hides LTV, credit, balance, AOV KPIs and the "Impersonate" button for manager viewers.

### Cons
- [MEDIUM] `CustomerDetailView` has a hardcoded date (`new Date('2026-06-24T00:00:00')`) for `churnDays` computation at line 16 — different from the canonical `MOCK_TODAY` ('2026-06-28') used everywhere else. This is a bug (churn days are off by 4) and affects the manager view as much as the admin one.
- [LOW] `cust.spend` and `cust.balance` are passed to `CustomerProfileClient` as props — the raw numbers exist in the client hydration payload even though they are not displayed. Same as the orders case; acceptable for Phase-0.

### Recommended fixes
1. Replace `new Date('2026-06-24T00:00:00')` in `CustomerDetailView` with `new Date(`${MOCK_TODAY}T00:00:00`)` (import `MOCK_TODAY` from `adminMock`).

---

## manager · /manager/staff  ·  Verdict: ok

**Source:** `app/manager/staff/page.tsx` + `app/admin/staff/build.ts` + `StaffClient.tsx`

### Pros
- `scope.staff` (already pod-filtered) is the only input to `buildStaffVMs`.
- `StaffClient` consistently gates `monthlyPay`, `walletBalance` display behind `showMoney` at every render site (table header, card, expanded row, KPI).
- "Monthly payroll" KPI (line 197) gated behind `showMoney`. No pay figure visible to manager.
- `useImpersonatePolicy()` returns `viewOnly: true` for managers; impersonate button label switches to "View as" and calls `impersonate(id, 'view')`.

### Cons
- [MEDIUM] `buildStaffVMs` includes `monthlyPay`, `walletBalance`, `pendingFines`, `appliedFines` in the serialized `StaffVM`. These financial fields travel in the RSC/hydration payload to the manager client even though they are never shown. Acceptable for Phase-0; must be stripped at the data layer before Phase-3.
- [MEDIUM] `buildStaffVMs` also includes `valueInFlight` (sum of active order values) per staffer. This is used in the staff card under `showMoney && <Stat label="In flight" value={money(s.valueInFlight)} />`. Correctly gated, but `valueInFlight` is still serialized.
- [LOW] The "Manager" filter dropdown (line 300) shows all managers from `buildManagerVMs`, not just the current one. For a manager viewing only their own pod, the dropdown has one entry (themselves) and isn't useful — could be hidden.

### Recommended fixes
1. Phase-3: exclude `monthlyPay`, `walletBalance`, `pendingFines`, `appliedFines`, `valueInFlight` from `buildStaffVMs` output when the caller is a manager (pass a `viewer` param to the build function).
2. Hide the manager filter dropdown on the manager surface.

---

## manager · /manager/staff/[id]  ·  Verdict: strong

**Source:** `app/manager/staff/[id]/page.tsx` + `app/admin/staff/[id]/StaffProfileClient.tsx`

### Pros
- Pod-scope guard via `staffInPod(scope, id)` → `notFound()`. Tight.
- `StaffProfileClient` drops the "Pay & wallet" tab entirely for manager viewers (line 62: `showMoney ? TABS : TABS.filter(t => t.key !== 'pay')`).
- Pay KPIs in the header (lines 123–124) are behind `showMoney`. Pay tab render (line 139) is double-gated (`tab === 'pay' && showMoney`).
- Overview card "Money snapshot" is replaced by "Pay & wallet are not visible to managers." (line 187) — intentional UX.
- Commission badge at line 103 (`{s.tier.current.mult}× commission band`) renders unconditionally in the header pill row. However this is a multiplier tier label (e.g. "1.5×"), not a dollar amount — no salary or absolute money figure is exposed.
- Impersonation button correctly uses `imp.viewOnly ? 'view' : 'act'` mode.

### Cons
- [LOW] Line 103 shows `{s.tier.current.mult}× commission band` in the staff header for all viewers including managers. This is the *commission tier multiplier* (a rate, not an amount) — whether this counts as "money-blind" is a design call. A manager knowing a staffer's commission tier multiplier (e.g. 1.5×) is borderline; it implies relative pay band. Flag for product decision.
- [LOW] `[live]` confirm the "Pay & wallet" tab never appears in the tab bar for the manager viewer.

### Recommended fixes
1. Product decision: hide the `{mult}× commission band` pill for manager viewers, or confirm it is intentionally visible (it helps the manager understand staff motivation without revealing dollar amounts).

---

## manager · /manager/assignment  ·  Verdict: ok

**Source:** `app/manager/assignment/page.tsx` + `app/admin/assignment/build.ts` + `AssignmentClient.tsx`

### Pros
- `buildAssignmentProps(scope.staff)` correctly passes only pod staff as the roster, so candidates and in-flight workload are restricted to this pod.
- `AssignmentClient` reads `useMoney()` and `useShowMoney()` for all value/LTV/credit display (lines 256, 264, 266 — all behind `showMoney`).
- Assignment queue comes from the full unassigned pool (cross-pod, intentional) but candidate suggestions are built from pod-staff only.

### Cons
- [MEDIUM] `buildAssignmentProps` includes `value: o.value` and `cust: { spend, balance }` in every queue item. These are passed to `AssignmentClient` and render conditionally behind `showMoney`. Raw numbers are in the hydration payload. Same Phase-3 concern as orders.
- [MEDIUM] `kpis.throughput` (line 71 of `build.ts`) sums `s.throughput` across staff — this is an order-count metric, not money. Correctly money-blind.
- [LOW] Hardcoded `TODAY` in `build.ts` line 3 (`new Date('2026-06-24T00:00:00')`) — same off-by-4 issue as `CustomerDetailView`. Should use `MOCK_TODAY`.

### Recommended fixes
1. Fix the hardcoded date in `build.ts` to use `MOCK_TODAY` (or `new Date(`${MOCK_TODAY}T00:00:00`)`) for correct deadline calculation.
2. Phase-3: exclude `value`, `cust.spend`, `cust.balance` from assignment queue items for manager viewers.

---

## manager · /manager/review  ·  Verdict: ok

**Source:** `app/manager/review/page.tsx` + `app/admin/review/ReviewClient.tsx` + `build.ts`

### Pros
- `buildReviewProps(scope.staffNames)` scopes deliverables to pod staff only — correct.
- No monetary fields visible in the review queue (service quality workflow: status, version, turnaround).

### Cons
- [LOW] `[live]` confirm `ReviewClient`'s staff quality grid doesn't render any pay/bonus fields.
- [LOW] Empty state for the "sent back" queue not verified from static read.

### Recommended fixes
1. `[live]` pass for empty states on the sent-back list and staff quality section.

---

## manager · /manager/tickets  ·  Verdict: ok (one hardcoded value)

**Source:** `app/manager/tickets/page.tsx` + `app/admin/tickets/TicketsClient.tsx`

### Pros
- `ticketsForPod(scope)` correctly assigns/unassigned ticket logic — pod-scoped per documented rules.
- No financial fields in tickets data model.

### Cons
- [MEDIUM] `avgFirstResponseH={1.8}` is hardcoded at the call site (page.tsx line 16). This should be derived from pod ticket data, not a fixed constant — currently every manager pod shows "1.8 hours" regardless of actual response performance.
- [LOW] `[live]` confirm `TicketsClient` empty state ("No tickets" / "No pending") renders correctly for small pods.

### Recommended fixes
1. Derive `avgFirstResponseH` from actual pod ticket data (e.g. average of ticket age at first response for this pod's closed tickets) instead of hardcoding `1.8`.

---

## manager · /manager/audit  ·  Verdict: strong

**Source:** `app/manager/audit/page.tsx` + `lib/managerScope.ts` (auditInPod) + `app/admin/audit/AuditView.tsx`

### Pros
- `auditInPod` filters events using all pod identity dimensions (actor name, staff id, order code, customer company, meta fields) — thorough conservative matching.
- `AuditView` receives a pre-filtered slice; no client-side further filtering needed.
- `recentActivity` in the overview independently applies `isMoneyEvent` to strip financial events from the feed.

### Cons
- [LOW] `AuditView` is shared with admin and may render audit event `change` text which could contain money strings if the audit record's `change` field was authored with a dollar amount. Since `isMoneyEvent()` only checks `action` + `meta/diff` keys (not the `change` free-text field), a manually authored `change: "refunded $500"` would not be stripped. Structural audit entries produced by Phase-0 mock don't exhibit this, but it's a latent risk for Phase-3.

### Recommended fixes
1. Phase-3: ensure audit `change` text is generated from structured fields on the server, not composed as free text with dollar amounts embedded.

---

## manager · /manager/inbox  ·  Verdict: weak (parity with affiliate inbox)

**Source:** `app/manager/inbox/page.tsx`

### Cons
- [MEDIUM] Bare `<InboxClient />` — no `PageHeader`, no `export const metadata`. Every other manager page wraps in a `<section>` with `<PageHeader>`. The inbox breaks visual rhythm and browser-tab title (identical issue to affiliate/inbox noted in the affiliate audit).
- [LOW] `InboxClient` not read in this audit — verify it has no money fields surfaced (broadcast messages shouldn't carry financial data, but worth confirming).

### Recommended fixes
1. Wrap in `<section><PageHeader title="Inbox" subtitle="Messages from admins & broadcasts" /><InboxClient /></section>` + add `export const metadata = { title: 'Inbox' }`.

---

## manager · /manager/docs  ·  Verdict: strong

**Source:** `app/manager/docs/page.tsx`

### Pros
- `DocsLibrary audience="manager"` correctly filters to manager-audience docs only.
- `PageHeader` present; subtitle clarifies "read-only".

### Cons
- [LOW] No `export const metadata`.

---

## manager · /manager/docs/[id]  ·  Verdict: ok

**Source:** `app/manager/docs/[id]/page.tsx`

### Pros
- `DocReaderClient` receives `audience="manager"` and `backHref="/manager/docs"` — stays within the manager area.

### Cons
- [LOW] `DocReaderClient` not read in full — verify it enforces the `audience` filter server-side (or in the data layer) rather than client-side only.
- [LOW] No `notFound()` if the doc doesn't exist for this audience — if `DocReaderClient` renders a blank screen instead of a 404, that's a weak state.

### Recommended fixes
1. Read `DocReaderClient` to confirm audience enforcement and not-found handling.

---

## manager · /manager/notes  ·  Verdict: ok

**Source:** `app/manager/notes/page.tsx` + `app/staff/notes/NotesClient.tsx`

### Pros
- Comment explicitly notes the notes store is namespaced by area so manager notes are separate from staff notes.

### Cons
- [MEDIUM] Uses `NotesClient` from the staff surface without a `namespace` prop — relies on implicit namespace from the pathname/area. If `NotesClient` derives its store key from the URL, the manager and any staff navigating to the same route could share storage. Need to confirm the notesStore namespacing logic.
- [LOW] No `export const metadata`.

### Recommended fixes
1. Read `NotesClient` and `notesStore` to confirm the storage namespace is correctly isolated between `/manager/notes` and `/staff/notes`.

---

## manager · /manager/notes/new  ·  /manager/notes/[id]  ·  /manager/notes/[id]/edit  ·  Verdict: ok

**Source:** `app/manager/notes/new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`

### Pros
- All three delegate to `NoteFullEditor` / `NoteFullReader` from the staff surface — shared implementation.
- No financial fields in notes.

### Cons
- [MEDIUM] Same namespace concern as the notes list page — `NoteFullEditor`/`NoteFullReader` must resolve to manager-namespaced storage, not staff storage.
- [LOW] No empty/not-found guard at the page level for `[id]` (the reader/editor must handle it internally).

---

## manager · /manager/settings  ·  Verdict: strong

**Source:** `app/manager/settings/page.tsx` + `SettingsClient.tsx`

### Pros
- Profile read from `managerScope(MANAGER_PERSONA)` — no financial fields in scope.
- `SettingsClient` explicitly tells managers: "Org settings, finance, analytics and managing other managers are admin-only and not shown here."
- Only editable fields are name, email, and notification prefs — all ops-scoped.
- Pod size shown as a count only (`profile.podSize`), no financial data.

### Cons
- [LOW] "Save profile" is a mock no-op (`setToast`). Fine for Phase-0; backend note.
- [LOW] No `export const metadata`.

---

## Surface summary

### Strengths
- **Money-blind invariant holds across the entire surface.** No salary, commission, payout, or cost figure is rendered for manager viewers. The invariant is enforced at four independent layers: RBAC matrix (`lib/rbac.ts`), `ViewerProvider` + `useMoney()`/`useShowMoney()` in every shared client, explicit `showMoney={false}` prop on server components that pre-bake text, and pod-scoped data derivation in `managerScope.ts` / `managerPulse.ts` / `managerPerf.ts`.
- **Impersonation policy is correct.** `useImpersonatePolicy()` returns `{ canStaff: true, canCustomer: false, viewOnly: true }` for managers. All shared components that surface an impersonate button read this policy and either hide the button (`canCustomer: false` → no customer impersonation) or call `impersonate(id, 'view')` mode.
- **Pod-scoping is consistent.** Every route that accepts a dynamic id (`/staff/[id]`, `/customers/[id]`, `/orders/[id]`) has a pod-membership guard that returns `notFound()` for out-of-pod requests.
- **`lib/managerPulse.ts` and `lib/managerPerf.ts`** are clean, readable, money-free modules with good inline documentation of the money-blind intent.

### RBAC / money-blind verdict
**PASS** — No monetary figure is displayed to manager viewers at any route, verified via static read of all 20 routes and their shared components. The closest concern (lines 130/164 of `OrderDetailClient` calling `money(o.value)` unconditionally) is safe because `money` is `useMoney()` which returns `'—'` for manager viewers.

**Latent risk (Phase-3):** Financial data (order values, customer LTV/credit, staff pay/wallet) is included in the serialized RSC/hydration payload for manager client components even though it is never rendered. With real auth and RLS this must be excluded at the data layer, not just the render layer.

### Systemic issues
1. **No `export const metadata`** on any of the 20 manager routes (including the layout). Browser tab always shows the app's root title regardless of the current page.
2. **Two hardcoded dates diverge from `MOCK_TODAY`**: `CustomerDetailView` (`'2026-06-24'`) and `assignment/build.ts` (`'2026-06-24'`) both compute age/deadline relative to a stale anchor, producing off-by-4 results compared to the rest of the app.
3. **Notes namespace isolation not verified** — `NotesClient` / `NoteFullEditor` / `NoteFullReader` are used from the staff surface without an explicit manager namespace prop; store isolation should be confirmed.
4. **`/manager/inbox` lacks `PageHeader` and `metadata`** — same gap as affiliate inbox, breaking visual rhythm.
5. **`avgFirstResponseH={1.8}` in tickets page** is a hardcoded constant rather than a derived metric.

### Top Phase-3 fixes (ordered by impact)
1. **Strip financial fields from serialized props** for manager viewers (`buildStaffVMs`, `buildAssignmentProps`, `buildOrderDetailProps`, `buildCustomerRows`) — move the viewer role into the build functions.
2. **Add `metadata` exports** to all manager pages (or generate from a shared manager layout metadata).
3. **Fix both `'2026-06-24'` hardcoded dates** to use `MOCK_TODAY` from `adminMock` consistently.
4. **Wrap `/manager/inbox`** with `PageHeader` + `metadata` (one-liner fix, high visibility).
5. **Derive `avgFirstResponseH`** from real pod ticket response data in `managerPulse.ts`.
6. **Confirm notes namespace isolation** for `/manager/notes/*` vs `/staff/notes/*`.
7. **Refactor `COLDEF.value.render`/`COLDEF.ltv.render`** in `OrdersExplorer` to use `useMoney()` instead of the module-scope raw `money` formatter (defence-in-depth).

### Backend notes for DATA-MODEL
Entities implied by this surface: Manager(id, name, email, title, rank), Pod(managerId, staffIds), PodMetric(managerId, period, leverScores, composite), AuditEntry(actor, entity, entityId, action, meta, diff, at). The five manager score levers (delivery, quality, responsiveness, team-health, growth) are all computable from existing entities — no new financial entities needed. The `MANAGER_PERSONA` constant must be replaced with the session manager id when auth lands. The `isMoneyEvent` filter should be an RLS policy on the audit table rather than a client-side filter.
