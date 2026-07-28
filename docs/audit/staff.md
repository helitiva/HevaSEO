# Audit — Staff surface (17 routes)

Code-read audit against [RUBRIC.md](./RUBRIC.md). `[live]` items need a dev-server pass.

**Data spine:** `data/staffMock.ts` (tasks, earnings, deliverables, notifications, availability) ·
`lib/staff.ts` (score model, SLA, actions, `TODAY = '2026-06-26'`) · `lib/staffFinance.ts` (wallet
math, penalty types) · `lib/currentStaff.ts` (impersonation-aware id) · `lib/staffView.tsx`
(view-only context) · `data/adminMock.ts` (STAFF roster, ORDERS, money via `money()`).

**Staff's own finance is intentionally visible** (`/staff/finance`, `/staff/performance`) —
money-blind applies only to the manager surface, not the staffer's own pay. This is correct by
design.

**View modes:**
- `act` (admin full-impersonation): can act, finance visible.
- `view` (manager look-in): read-only flag set by `StaffViewOnlyProvider`; finance hidden via
  `ViewOnlyGuard` on the finance page and finance nav-item filtered out in `StaffSidebar`.

---

## staff · /staff · Verdict: strong

**Source:** `app/staff/page.tsx` + `components/staff/MyDayClient`

### Pros
- Exemplary adaptive layout: greeting uses a real `new Date().getHours()` call (not a hardcoded
  time), capacity reads from the roster, and the focus queue is dynamically sorted by urgency +
  priority.
- Clean server/client split: all data derived server-side; only a serializable `OverviewData` blob
  is passed to `MyDayClient`.
- RBAC-correct: only the impersonated staffer's slice is sent to the client; `currentStaffIdentity`
  validates the cookie against the roster.

### Cons
- [MEDIUM] `summarisePenalties(myPenalties(sid), '2026-06')` — the month is hardcoded. When the
  clock crosses into July the "pending this month" figure silently drops to $0.
- [LOW] Decorative `<i className="ph-…">` icons inside `MyDayClient` likely lack `aria-hidden`
  (systemic across the surface — verify `[live]`).
- [LOW] `TODAY` imported from `lib/staff.ts` is a module-scope constant (`'2026-06-26'`). It is
  used for deadline math throughout the surface and will be stale once the Phase-0 clock stops.

### Recommended fixes
1. Replace `'2026-06'` with a derived current-month string (`new Date().toISOString().slice(0,7)`)
   everywhere it appears.
2. Centralise the "today" anchor swap — one place in `lib/staff.ts` changes to `new Date()`.

---

## staff · /staff/tasks · Verdict: strong

**Source:** `app/staff/tasks/page.tsx` + `TasksClient`

### Pros
- Proper empty state chain: `emptyKindFor(false)` → `new-hire` (never had tasks) vs `caught-up`
  (cleared the board); warm copy with a CTA.
- `PageHeader` present; subtitle shows live task count.

### Cons
- [LOW] No `metadata` export — browser tab shows the app title only (systemic across the entire
  staff surface; see Surface summary).
- [LOW] `BOARD_COLUMNS` is a module-scope singleton; fine for Phase-0 but noted for DATA-MODEL.

### Recommended fixes
1. Add `export const metadata = { title: 'My Tasks' }` (systemic; apply to every staff page).

---

## staff · /staff/tasks/[id] · Verdict: ok (view-only gap)

**Source:** `app/staff/tasks/[id]/page.tsx` + `TaskDetailClient.tsx`

### Pros
- `notFound()` guard on missing/wrong-owner task.
- `nextStaffActions` enforces a limited state machine (no Approve / Cancel / reassign).
- `<p>pricing hidden from staff</p>` inline reminder; `money()` is never called in this file.
- Keyboard shortcuts (j/k/s) improve queue ergonomics.

### Cons
- [HIGH] **No view-only guard on mutations.** `TaskDetailClient` renders the `Start` / `Submit for
  review` / `Resume` action buttons and the `DeliverableSubmit` form regardless of whether
  `useStaffViewOnly()` is `true`. A manager in `view` mode can click "Start" or submit a
  deliverable on behalf of the staffer — violating the "cannot act on their behalf" contract stated
  in `StaffShell`. The `ViewOnlyGuard` exists but is only wired to the finance page.
- [MEDIUM] `feedbackFor` and `extraFor` are looked up from module-scope `RECORD` objects in
  `staffMock.ts` — data is frozen at server-start.
- [LOW] The `authorName` prop defaults to `CURRENT_STAFF.name` (the hardcoded demo staffer), not
  the impersonated staffer's name — self-notes on an impersonated session would show the wrong
  author.
- [LOW] `aria-hidden` missing on decorative icons in inline JSX (e.g. `<i className="ph-bold
  ph-arrow-left" />` in the back-link at line 81).

### Recommended fixes
1. Add `const viewOnly = useStaffViewOnly()` in `TaskDetailClient`; disable or hide the action
   buttons and `DeliverableSubmit` when `viewOnly === true`.
2. Pass `authorName={impersonated.name}` from the server component (already resolved via
   `currentStaffIdentity`).

---

## staff · /staff/calendar · Verdict: ok

**Source:** `app/staff/calendar/page.tsx` + `CalendarClient`

### Pros
- Opens on the month of the soonest deadline (smart default).
- Correct empty state via `EmptyState kind="caught-up"`.
- `PageHeader` present.

### Cons
- [MEDIUM] `today={TODAY}` passes the module-scope constant from `lib/staff.ts`. The calendar's
  "today" highlight will be frozen on `2026-06-26` for the server's lifetime — the current day
  highlight and "past vs future" coloring will drift.
- [LOW] No `metadata` export.

### Recommended fixes
1. Pass `today={new Date().toISOString().slice(0,10)}` (computed at request time in the Server
   Component) instead of the module-scope `TODAY`.

---

## staff · /staff/deliverables · Verdict: strong

**Source:** `app/staff/deliverables/page.tsx` + `DeliverablesClient`

### Pros
- Empty state handled with correct copy.
- `deliverableStats` is derived from live `myDeliverables(sid)` at request time, not a stale
  module-scope call.
- Subtitle adapts to whether there are rows.

### Cons
- [LOW] No `metadata` export.

---

## staff · /staff/performance · Verdict: strong (one hardcoded date)

**Source:** `app/staff/performance/page.tsx` (858 lines)

### Pros
- Most data-rich page on the surface. Score breakdown, coaching lever, track record, penalty
  summary, team ranking, rewards, and charts are all derived from live `STAFF`/`myWorkStats` at
  request time.
- `scoreBreakdown` / `improvementLever` / `commissionTierFor` all read from the single `SCORE_MODEL`
  source — no duplicated weight constants.
- `notFound`-equivalent empty state (`EmptyState kind="new-hire"`) for unrecognised staff.
- Finance teaser link (`/staff/finance`) rather than re-exposing money inline — good separation.
- `role="img"` + `aria-label` on SVG charts; `role="progressbar"` on reward progress bars — solid
  a11y for data-vis.

### Cons
- [MEDIUM] `summarisePenalties(penalties, '2026-06')` — month hardcoded. "Applied this month" stat
  will be stale as soon as the calendar month changes (same bug as `/staff`).
- [MEDIUM] `tenureSince` hard-codes `new Date('2026-06-26T00:00:00')` as "now" — tenure label
  will freeze.
- [LOW] Inline `fmtShortDate` duplicates the date-format logic in `history/[code]/page.tsx` (DRY
  opportunity).
- [LOW] No `metadata` export; 858-line file — extractable chart components could become their own
  modules (LOW — code quality only).

### Recommended fixes
1. Replace hardcoded `'2026-06'` and `'2026-06-26'` with `new Date()`-derived strings computed
   once at the top of the component.
2. Extract `fmtShortDate` to `lib/format.ts` so it's shared with the history page.

---

## staff · /staff/finance · Verdict: strong

**Source:** `app/staff/finance/page.tsx` + `FinanceClient`

### Pros
- `ViewOnlyGuard` correctly wraps the entire `FinanceClient` — a manager in `view` mode sees the
  lock screen instead of pay details.
- Empty state handled for unrecognised staffer (`EmptyState kind="new-hire"`).
- Comment in the server component explicitly calls out the money-leak invariant.
- `currentStaffId()` (impersonation-aware) drives the data fetch — impersonating an admin shows
  that staffer's finance.

### Cons
- [LOW] No `metadata` export.
- [LOW] `[live]` verify `FinanceClient` payout-request form is also disabled in view-only mode
  (the guard hides the whole `FinanceClient`, so it should be fine — confirm the guard wraps the
  payout CTA too and not just the display cards).

---

## staff · /staff/history/[code] · Verdict: strong

**Source:** `app/staff/history/[code]/page.tsx`

### Pros
- `notFound()` on missing or wrong-owner task.
- Commission shown (correct — it's the staffer's own pay).
- `archivedTask(decodeURIComponent(code), staffId)` — URL-decodes the code and scopes to the
  current staff.
- `aria-hidden` used consistently on decorative icons throughout this file.

### Cons
- [LOW] `fmtShortDate` local function duplicates the same logic in `performance/page.tsx` (extract
  to `lib/format.ts`).
- [LOW] No `metadata` export.

---

## staff · /staff/notifications · Verdict: ok (module-scope data)

**Source:** `app/staff/notifications/page.tsx` + `NotificationsClient.tsx`

### Pros
- Graceful empty state: renders `EmptyState kind="caught-up"` when all notifications are dismissed.
- Filter chips + unread-only toggle with "clear filters" escape hatch.
- Dismiss button has correct `aria-label`.

### Cons
- [MEDIUM] `STAFF_NOTIFICATIONS` is a module-scope constant in `staffMock.ts` — the list is frozen
  at server-start and is **not scoped to the current staff id**. When an admin impersonates a
  different staffer, they still see the demo staffer's (s3) notifications.
- [MEDIUM] `initial={STAFF_NOTIFICATIONS}` passes the whole array to the client at page load — no
  pagination or cap. At scale an unbounded list is both a performance and a payload concern.
- [LOW] The read/dismiss state is client-side only (`useState`); a page refresh loses all read
  marks (acceptable Phase-0, but document it).
- [LOW] No `metadata` export.

### Recommended fixes
1. Accept `staffId` and filter `STAFF_NOTIFICATIONS` (or add per-staffer seed data) so impersonation
   shows the right person's notifications.
2. Phase-3: replace with a paginated server query.

---

## staff · /staff/inbox · Verdict: weak (PageHeader + metadata missing)

**Source:** `app/staff/inbox/page.tsx`

### Cons
- [MEDIUM] No `PageHeader` and **no `metadata` title** — the page is a bare `<InboxClient />`
  with no heading, subtitle, or browser-tab title. Every other staff page has both.
- [LOW] `InboxClient` is shared across staff/affiliate surfaces — `[live]` verify the filter or
  label correctly says "Staff" context.

### Recommended fixes
1. Wrap in `<section><PageHeader title="Inbox" subtitle="Broadcasts from your team" />
   <InboxClient /></section>` and add `export const metadata = { title: 'Inbox' }`.

---

## staff · /staff/docs · Verdict: strong

**Source:** `app/staff/docs/page.tsx`

### Pros
- Skill-scoped via `me?.skills ?? []` — a backlink writer never sees content docs.
- Audience gate `audience="staff"` passed to `DocsLibrary` — enforced at the data layer.
- `PageHeader` present with read-only disclaimer.

### Cons
- [LOW] No `metadata` export.
- [LOW] If `STAFF.find(sid)` returns undefined (e.g. stale cookie for a removed staffer),
  `skills` silently defaults to `[]` — staffer sees only general docs with no error message.

### Recommended fixes
1. Add a guard for the missing-staff case and surface a friendly notice.

---

## staff · /staff/docs/[id] · Verdict: ok

**Source:** `app/staff/docs/[id]/page.tsx`

### Pros
- Passes `audience="staff"` and `skills` to `DocReaderClient` — gate enforced in the reader.
- `backHref="/staff/docs"` present.

### Cons
- [MEDIUM] No `notFound()` guard in the page file itself — if `DocReaderClient` silently renders
  an empty state for a bad `id`, the URL is still 200 OK. Verify `DocReaderClient` calls
  `notFound()` on invalid/inaccessible documents.
- [LOW] No `PageHeader` — relies entirely on `DocReaderClient` to set the page heading.
- [LOW] No `metadata` export (dynamic — needs `generateMetadata`).

### Recommended fixes
1. Verify or add `notFound()` in `DocReaderClient` for invalid `id`.
2. Add `generateMetadata` with the doc title once the data layer supports it.

---

## staff · /staff/notes (+ /new, /[id], /[id]/edit) · Verdict: ok (view-only gap)

**Source:** `app/staff/notes/page.tsx` + `NotesClient`, `NoteFullEditor`, `NoteFullReader`

### Pros
- Rich notes with HTML: `sanitizeHtml` is a well-structured allowlist sanitizer (DOMParser-based;
  allowlisted tags; anchor scheme-checked; iframes restricted to YouTube/Vimeo; SVG data-URLs
  blocked). The sanitization happens at save time, making the stored HTML safe for
  `dangerouslySetInnerHTML`.
- `NoteModal` has a focus trap and Escape handler.
- `PageHeader` present on `/staff/notes`.

### Cons
- [HIGH] **No view-only guard on note mutations.** `NotesClient`, `NoteFullEditor`, and the
  `/new` and `/[id]/edit` routes have no call to `useStaffViewOnly()`. A manager in `view` mode
  can create, edit, and delete a staffer's private notes — a significant privacy and integrity
  violation. Notes are explicitly described as "private to the signed-in staffer."
- [MEDIUM] Notes store is client-side only (`useState` seeded from `staffNotes` mock) — no
  impersonation scoping. A manager impersonating a staffer in `act` mode would see the demo
  staffer's notes regardless.
- [LOW] `/staff/notes/[id]` and `/staff/notes/[id]/edit` have no `notFound()` guard at the page
  level — defer to `NoteFullReader`/`NoteFullEditor` to handle missing ids.
- [LOW] `dangerouslySetInnerHTML` in `NoteReader.tsx` and `NoteFullReader.tsx` is acceptable
  here because `sanitizeHtml` runs at save time; add a comment on each render site to make the
  trust chain explicit for future readers.
- [LOW] No `metadata` export on any note route.

### Recommended fixes
1. Add `const viewOnly = useStaffViewOnly()` in `NotesClient` and `NoteFullEditor`; disable New /
   Save / Edit / Delete when `viewOnly === true`.
2. Scope the note seed data to `staffId` so impersonation shows the right staffer's notes.

---

## staff · /staff/settings · Verdict: ok (view-only gap)

**Source:** `app/staff/settings/page.tsx` + `SettingsClient`

### Pros
- Profile data pulled from the impersonation-aware `currentStaffId()`.
- `PageHeader` present; `max-w-3xl` centred layout.

### Cons
- [HIGH] **No view-only guard on settings mutations.** `SettingsClient` exposes profile editing,
  working-hours toggles, time-off entries, and handoff policy. None of these are guarded by
  `useStaffViewOnly()`. A manager in `view` mode can modify a staffer's availability and handoff
  policy — a clear act-on-their-behalf violation.
- [MEDIUM] `MY_AVAILABILITY` is a module-scope singleton in `staffMock.ts`, not keyed to `staffId`.
  In an impersonation session the settings page always shows the demo staffer's hours regardless of
  who is impersonated.
- [LOW] No `metadata` export.

### Recommended fixes
1. `useStaffViewOnly()` in `SettingsClient`; disable all save/edit interactions when view-only.
2. Key availability data to `staffId` so impersonation surfaces the correct person's schedule.

---

## Surface summary

### Strengths
- Data architecture is excellent for Phase-0: `currentStaffId()` consistently drives every page;
  the money-free `StaffTask` type makes customer-price leaks a compile error; `ViewOnlyGuard` +
  `StaffViewOnlyProvider` is a clean pattern.
- Empty states are designed with warmth and CTAs (`EmptyState` variants are purpose-built).
- Notes sanitizer is robust for a hand-rolled solution.
- Performance page is the deepest coaching interface on the platform — score model, coaching lever,
  charts, and team ranking all derived from one consistent `SCORE_MODEL`.

### Systemic issues
1. **No `metadata` exports anywhere on the staff surface** — every browser tab shows only the
   app-level title. Contrast with affiliate surface, portal, and admin pages which all set titles.
2. **`ViewOnlyGuard` deployed on only one page** (finance) — task actions, notes CRUD, and
   settings mutations are fully accessible to a manager in `view` mode, breaking the stated
   "cannot act on their behalf" contract.
3. **`TODAY = '2026-06-26'` module-scope constant** propagates to SLA chips, calendar, and tenure
   calculations — will all freeze on the same wrong date in production.
4. **Hardcoded `'2026-06'` month string** used in `summarisePenalties` on both `/staff` and
   `/staff/performance` — the "this month" penalty summary silently goes to $0 next month.
5. **`STAFF_NOTIFICATIONS` is a module-scope, per-demo-staffer constant** — impersonation always
   shows s3's notifications.

### Top Phase-3 fixes (ordered by severity)
1. [HIGH] Apply `useStaffViewOnly()` guard to `TaskDetailClient` action buttons +
   `DeliverableSubmit`, `NotesClient`/`NoteFullEditor` mutations, and `SettingsClient` saves.
2. [MEDIUM] Replace all `'2026-06-26'` / `'2026-06'` hardcodes with `new Date()`-derived strings
   at request time.
3. [MEDIUM] Add `export const metadata` to every staff page (17 routes).
4. [MEDIUM] Scope `STAFF_NOTIFICATIONS` and `MY_AVAILABILITY` to `staffId` so impersonation
   shows the right person's data.
5. [MEDIUM] Add `PageHeader` + `metadata` to `/staff/inbox` (exact same fix as affiliate inbox).

### Backend notes for DATA-MODEL

Entities and reads that must become live queries when the backend lands:

| Entity | Key reads |
|---|---|
| `StaffTask` | Tasks assigned to `staffId`, with status, deadline, priority; scoped board per user |
| `Deliverable` | Submissions per task; feedback (manager/customer rating, notes) |
| `WorkItem` (archive) | Completed-task history per `staffId`; commissions, ratings, on-time flags |
| `StaffEarnings` | Base / commission / bonus / take-home per `staffId`; payslip history |
| `WalletEntry` | Credit ledger per `staffId` (commission events, bonuses) |
| `StaffPenalty` | Penalty log per `staffId`; status, amount, type; must support dispute workflow |
| `PayoutRequest` | Withdrawal requests per `staffId`; method, status, amount |
| `StaffNotification` | Per-`staffId` inbox; real-time delivery (websocket or SSE) |
| `StaffNote` | Private notes per `staffId`; rich HTML body; attachment references |
| `StaffAvailability` | Working hours + time-off per `staffId`; handoff policy |
| `Doc` (staff-scoped) | Published docs filtered by `audience=staff` and `skills ⊇ requiredSkills` |
| `Reward` | Milestone progress per `staffId`; unlock events |
| `ScoreModel` | Composite weights live in config; real `quality`/`onTime`/`throughput` from DB |
| `Manager` | Many-to-many `staffId → managerId`; replaced `managerOf()` lookup |

`TODAY` + `'2026-06'` month anchor must become request-clock values. `STAFF_NOTIFICATIONS` must
become a paginated, per-user query with real-time badge counts.
