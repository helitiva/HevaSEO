# Spec — Staff Surface (role `staff`) — Design + UI-first plan

**Date:** 2026-06-26
**Part of:** [HevaSEO Master Plan](../../../master-plan.md) · mirrors [Admin UI-first plan](../plans/2026-06-24-admin-ui-frontend.md).
**Audience:** Staff (executors). Reviewed via `/plan-design-review` (see report at bottom).

The third role surface (`customer` portal ✅, `admin` ✅, **`staff` ⬜**). UI-first, mock
data, **reuses `dashboard.css` + `@heva/ui` tokens**. Every screen is a Server Component
reading `staffMock.ts`; interactivity in small client components. **No money/credit
anywhere** (enforced later by RLS; UI is the second layer).

---

## 1. Locked decisions

**Product (from master-plan §8):**
1. **Grain = `tasks`.** Staff work at task level (`orders → n tasks`); each task references its
   parent order for context (brief, customer, service, deadline) but all money fields are stripped.
2. **Staff chat customers directly** — task detail has two threads: *Customer* (client-visible) +
   *Internal* (staff/admin only).
3. **Availability:** staff self-set (Available/Busy/OOO); **time-off requests need admin approval**.
   → adds two admin tasks (§9).
4. **Performance self-view: yes** — staff see their own scorecard (read-only mirror of admin module 7).
5. **Deliverables:** Supabase Storage, **versioned per task**, files + external link + required note.

**Design (resolved in this review):**
- **D3 — My Day leads with a work list,** not KPI tiles. KPIs demoted to a thin strip.
- **D4 — Two context-aware empty states:** new-hire onboarding vs "all caught up".
- **D5 — Leak guard:** recipient label baked into the composer ("Sending to: Customer" / "Internal"),
  color-shifting with the active tab, + lock/banner. No extra confirm click.
- **D6 — Versioned deliverables:** each submit = v1, v2, v3…; newest is `current`, older are read-only
  with the changes-requested note pinned to its version. Matches the module-7 auto quality score
  (counts rework rounds) and the "no black box" audit USP.

---

## 2. Routes & screens

| Screen | Route | Lead element |
|---|---|---|
| **My Day** | `/staff` | "Focus today" list (due today + overdue + changes-requested), each row with SLA chip + quick-open. KPI strip below. |
| **My Tasks** | `/staff/tasks` (+ `?task=id`) | Board: *Assigned → In progress → Internal review → Changes requested → Delivered*. Grid/table toggle, filter (skill/priority/deadline), search, sort. |
| **Task detail** | `/staff/tasks/[id]` | Brief (money stripped) · checklist · **DeliverableSubmit** (versioned) · 2-thread messages · activity. |
| **Calendar** | `/staff/calendar` | Deadline week/month + SLA countdowns + daily capacity. |
| **Deliverables** | `/staff/deliverables` | Submission history: version, approval status, rework count. |
| **Performance** | `/staff/performance` | Self scorecard: composite/quality/on-time/throughput + trend + recent ratings (read-only). |
| **Notifications** | `/staff/notifications` | New assignment · changes requested · deadline reminder · approved. |
| **Settings** | `/staff/settings` | Profile · skills (view/request change) · **AvailabilityToggle** · time-off request · timezone · notif prefs · theme. |

**Core loop (staff-allowed transitions only):** Start (`assigned→in_progress`) · Submit for review
(`in_progress→internal_review`) · Resume (`changes_requested→in_progress`).
Staff **cannot**: Approve, Deliver-to-customer, Cancel, change price, reassign.

---

## 3. Information architecture — My Day (implemented: 2-column overview dashboard)

> **Status: shipped** (2026-06-26). The original "Focus list + thin KPI strip" concept was
> superseded by a full 2-column overview dashboard that doubles as a work hub. Details below reflect
> the built product.

### 3.1 Layout — 2-column, max-w-7xl

```
┌─ PageHeader: "My Day — {greeting}" + AvailabilityToggle (top-right) ────────┐
│                                                                              │
│  ┌── 5 KPI TILES (stat row, full width) ──────────────────────────────────┐ │
│  │  Load 6   Overdue 2   Due today 3   Cleared 4   On-time 92%           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  LEFT COLUMN (flex-1, min-w-0)    │  RIGHT COLUMN (context rail, w-72)     │
│  ─────────────────────────────────┼──────────────────────────────────────── │
│  Focus (active tasks)             │  Recent pay          → /performance     │
│  ┌─ filter chips + search ──────┐ │  Manager note (latest thread)          │
│  │ All · Assigned · In progress │ │  Latest review (stars + note)          │
│  │ Changes req  [🔍 /search]   │ │  Customers you're caring for           │
│  └─────────────────────────────┘ │                                          │
│                                   │                                          │
│  ┌── Overdue ──────────────────┐  │                                          │
│  │ TASK  DUE   STATUS  BRIEF  ⚡│  │                                          │
│  │ row · row · row            │  │                                          │
│  └─────────────────────────────┘  │                                          │
│  ┌── Due today ────────────────┐  │                                          │
│  │ …                          │  │                                          │
│  └─────────────────────────────┘  │                                          │
│  ┌── This week / Later ────────┐  │                                          │
│  │ …                          │  │                                          │
│  └─────────────────────────────┘  │                                          │
│                                   │                                          │
│  ─ Cleared today: 4 tasks ─────── │                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 KPI stat row (5 tiles)

| Tile | Source | Note |
|---|---|---|
| My load | `deriveKpis(state).load` | total actionable tasks |
| Overdue | `deriveKpis(state).overdue` | days < 0 |
| Due today | `deriveKpis(state).dueToday` | days = 0 |
| Cleared today | `deriveKpis(state).cleared` | actions taken this session |
| On-time | `myEarnings()` / mock | % on-time deliveries |

### 3.3 Focus table — CSS grid with column headers

Column template (shared constant `COLS`):
```
grid-cols-[8rem_7rem_10.5rem_minmax(0,1fr)_auto]
```
Headers: **TASK** · **DUE** · **STATUS** · **BRIEF** · **ACTION**

**Urgency groups** (`lib/myDay.ts: urgencyGroup, groupFocus`):

| Group key | Label | Condition |
|---|---|---|
| `overdue` | Overdue | `days !== null && days < 0` |
| `today` | Due today | `days === 0` |
| `week` | This week | `days !== null && days <= 7` |
| `later` | Later / no deadline | everything else |

Each group renders a sticky section header + its rows. Empty groups are hidden.

**Row styling:** zebra stripes `bg-foreground/[0.05]` on even rows; `hover:bg-foreground/[0.08]`
on every row. No `divide-y` (conflicts with rounded hover backgrounds). `space-y-0.5` between rows.

**Default selection:** `sel = -1` (no row pre-selected; keyboard enters the list on first `j`/`k`).

### 3.4 Filter chips + search

- Status filter chips: **All · Assigned · In progress · Changes requested** (`filterFocus` in `lib/myDay.ts`)
- Search box (press `/` to focus): `matchesQuery` checks `code` + `service` fields
- Filtered-to-zero: inline empty state "No tasks match · Clear filter"

### 3.5 Context rail (right column)

| Card | Data source | Links to |
|---|---|---|
| Recent pay | `myEarnings()` — stripped of `basis`/`rate` | `/staff/performance` |
| Manager note | `myManager()` + `managerThread()` | task detail |
| Latest review | `latestReview()` — new helper (see §6.2) | `/staff/deliverables` |
| Customers caring for | `myCustomers()` | order/task detail |

### 3.6 Inline actions (per row)

| Current status | Primary action | Interaction |
|---|---|---|
| `assigned` | **Start** | 1-click optimistic → `in_progress` |
| `in_progress` | **Submit** | slide-over with DeliverableSubmit |
| `changes_requested` | **Resume** | 1-click optimistic → `in_progress` |
| `internal_review` | — | read-only; "Waiting for review" |
| `delivered` | — | read-only |

After Start/Resume: optimistic state update + toast with **Undo** (5 s). After Submit: panel closes,
task moves to `internal_review`, cleared-today feed appended.

**Keyboard:** `j`/`k` move row highlight · `Enter` open task detail · `Space` run primary action ·
`/` focus search · `Esc` close slide-over. All ignored while typing in an input/textarea.

**SLA chip scale** (semantic, reuse `.pill`):
`overdue` = red (`pill-bad`) · `≤8h` = amber (`pill-warn`) · `today` = amber-soft · `>1d` = neutral (`pill`).

---

## 4. Interaction state coverage (Pass 2 fix — was the biggest gap)

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| My Day / Focus list | skeleton rows (3) | **see §4.1** | "Couldn't load your tasks — Retry" inline | list renders, SLA chips colored | some sources slow → render what's ready, spinner on the rest |
| Task board | column skeletons | per-column "Nothing here" micro-copy | toast + keep last good state | cards animate in | filtered-to-zero → "No tasks match — Clear filters" |
| DeliverableSubmit | dropzone disabled + spinner during upload | no file yet → dashed dropzone prompt | red field error: too-big / wrong-type / note-missing; upload fail → "Upload failed — Retry", keep file | green "Submitted v2 — sent for review", panel switches to read-only | upload progress bar 0–100%; link added but note empty → submit disabled |
| Messages (each thread) | bubble skeletons | "Start the conversation" prompt | "Message failed — Retry" on the bubble | bubble appears, composer clears | optimistic bubble greyed until ack |
| Calendar | month grid skeleton | "No deadlines this week" | "Couldn't load schedule — Retry" | events placed | some days loaded |
| Performance | tile skeletons | new staff → "Your scorecard builds as you deliver. Baseline 70." | "Couldn't load stats — Retry" | tiles + trend render | ratings pending → show score, "no ratings yet" |
| Notifications | list skeleton | "You're all caught up" | "Couldn't load — Retry" | grouped unread→read | mark-all in flight |

### 4.1 My Tasks empty states (D4)

- **New hire (no tasks ever):** warm headline "Welcome — no tasks yet", a line on what happens next
  ("Admin assigns work to your skills"), CTA **Update your skills & availability** → `/staff/settings`,
  secondary link to a short how-it-works.
- **All caught up (had tasks, none open):** "You're clear for now 🎉" (illustration via existing icon
  set, no emoji in final per design-system rule), CTA **Review submitted deliverables** → `/staff/deliverables`.

---

## 5. Task detail — deliverable + messaging

### 5.1 DeliverableSubmit (D6 — versioned)
- Dropzone (drag/drop + browse): PDF · DOCX · XLSX · CSV · PNG · JPG · ZIP, ≤25MB; **or** paste an
  external link (Google Doc/Drive). One submission may carry file **or** link, both optional-but-one-required.
- **Required** reviewer note — labeled "🔒 Note for the reviewer · internal, required". Submit disabled until present.
- **Optional customer message** — labeled "💬 Message to the customer · the client will see this (optional)". Lets staff add a note the customer receives alongside the deliverable.
- Both textareas start at `min-h-[9.5rem]` and **auto-grow** as the user types (`onInput: el.style.height='auto'; el.style.height=el.scrollHeight+'px'`). `resize-none overflow-hidden`.
- `onSubmit(note: string, customerNote?: string)` — signature widened to carry the optional customer note.
- Version badge ("resubmission · v2"); newest = `current`, older versions read-only with their
  changes-requested note pinned. A compact "version history" list under the dropzone.
- Submit → optimistic "Submitted v2", panel flips read-only, status moves to `internal_review`.

### 5.2 Two-thread messages + leak guard (D5)
- Segmented toggle: **Customer** (blue, client-visible) · **Internal** (amber + lock icon, caption
  "Only staff & admin can see this").
- **Composer carries a recipient label** that changes with the tab: "Sending to: Customer" (blue) /
  "Internal note" (amber). Prevents mistaps at typing time.
- Active tab is unmistakable (2px info border on active, banner on Customer thread).

---

## 6. Pure logic module — `lib/myDay.ts`

All My Day business logic lives in a **zero-React, zero-money** module so it can be unit-tested
in isolation and reused server-side.

### 6.1 Types

```ts
export interface MyDayTask {
  id: string; code: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; days: number | null;
}
export type ActionVerb = 'Started' | 'Resumed' | 'Submitted'
export interface LogEntry { id: string; verb: ActionVerb; code: string; at: string; task: MyDayTask; leftFocus: boolean; }
export interface MyDayState  { focus: MyDayTask[]; log: LogEntry[]; }
export interface MyDayKpis   { load: number; overdue: number; dueToday: number; cleared: number; }
export type UrgencyKey = 'overdue' | 'today' | 'week' | 'later'
export interface FocusGroup  { key: UrgencyKey; label: string; items: MyDayTask[]; }
```

### 6.2 Functions

| Function | Signature | Description |
|---|---|---|
| `primaryActionFor` | `(status) → StaffAction \| null` | maps `assigned→Start`, `in_progress→Submit`, `changes_requested→Resume`; returns null otherwise |
| `applyAction` | `(state, id, at, makeId) → MyDayState` | optimistic: records LogEntry, moves task to next status (or removes from focus if submitted) |
| `undoAction` | `(state, entryId) → MyDayState` | reverses the action; restores task + removes log entry |
| `deriveKpis` | `(state) → MyDayKpis` | counts load / overdue / dueToday / cleared from current state |
| `urgencyGroup` | `(days) → UrgencyKey` | pure date→group mapping |
| `groupFocus` | `(tasks) → FocusGroup[]` | groups + sorts into urgency sections |
| `matchesQuery` | `(task, q) → boolean` | case-insensitive match on `code` + `service` |
| `filterFocus` | `(tasks, status, q) → MyDayTask[]` | combines status chip filter + search |

### 6.3 Tests — `lib/myDay.test.ts`

**55 vitest tests** (all passing). Coverage:
- `primaryActionFor`: all 5 statuses + null cases
- `applyAction`: Start/Resume/Submit; leftFocus flag; duplicate-id guard
- `undoAction`: Start undo / Submit undo; unknown-id no-op
- `deriveKpis`: overdue / due-today / cleared counts; edge cases (null days, zero tasks)
- `urgencyGroup`: boundary values for overdue / today / week / later
- `groupFocus`: correct grouping, empty-group omitted, within-group sort order
- `matchesQuery`: substring match on code + service; empty-query passthrough
- `filterFocus`: status filter + search combined; cleared-out edge case

Run: `pnpm --filter @heva/app test`

### 6.4 `staffMock.ts` additions (2026-06-26)

```ts
export interface LatestReview {
  taskCode: string; note: string; at: string; changesRequested: boolean;
}
export function latestReview(): LatestReview | null
```

Finds the most recent reviewed deliverable for the current staff member (sorted by `reviewedAt`).
Used by the My Day context rail.

`MY_TASK_IDS` expanded from 7 → 16 orders for a richer demo dataset.

---

## 7. Security invariants (CRITICAL — must survive all future edits)

| Invariant | Enforcement |
|---|---|
| Staff never see customer pricing, order value, or revenue | `StaffTask` type uses `Omit<Task, 'value' \| 'price'>` — TypeScript error if money leaks |
| `myEarnings()` strips `basis`/`rate` from Payout | staff sees only their own pay on `/staff/performance` |
| Staff transitions: Start / Submit / Resume only | `primaryActionFor` returns null for Approve/Deliver/Cancel; `applyAction` rejects unknown verbs |
| Staff cannot reassign, cancel, or change price | these actions don't exist on any staff-surface component |
| Customer message (optional) visible to customer | labeled clearly; reviewer note is internal-only |

---

## 8. User journey storyboard (Pass 3)

| Step | Staff does | Feels | Plan supports it |
|---|---|---|---|
| 1 | Opens My Day | "what's urgent?" | Focus list leads, SLA chips (§3) |
| 2 | Opens a task | "what's the ask?" | Brief + checklist, money hidden |
| 3 | Submits work | "did it go through?" | Optimistic success + version badge (§5.1) |
| 4 | Gets changes requested | not punished, just iterating | Rework note pinned to version; Resume button; neutral amber, not red alarm |
| 5 | Sees Approved | recognized | Notification + scorecard ticks up (self-view) |

Time horizons: 5-sec = "what do I do now" (Focus list); 5-min = submit without friction; 5-year =
fair scorecard that rewards quality, not just speed.

---

## 9. Design-system alignment (Pass 5)

- Reuse `dashboard.css`: `.kpi .pill (-good/-warn/-bad/-live) .prio .bar .kcard .order-panel .display .nav-item .page-anim`.
- **Promote** generic kit `KpiTile · StatBadge · DataTable · PageHeader · SlideOver` from
  `components/admin/` → `components/shared/` so staff imports without an "admin" coupling.
- Net-new components only: `DeliverableSubmit`, `DeadlineCalendar`, `AvailabilityToggle`,
  two-thread `MessagePanel`, `StaffScorecard`.
- Chrome: `StaffShell · StaffSidebar · StaffTopbar` + `data/staffNav.ts` (mirror Admin/Portal shells).
- Mock: `data/staffMock.ts` (tasks for the "current staff").

---

## 10. Responsive & accessibility (Pass 6)

- **Viewports:** 375 (task-check on phone: Focus list + task detail single-column, board → stacked
  status sections, messages full-width), 768 (board 2–3 columns, detail single-column), 1024+
  (detail two-column brief/submit + messages, board full).
- **Keyboard:** `j/k` move through the visible task queue, `enter` opens, `[`/`]` prev/next in detail
  (parity with admin power-ups); composer `⌘/Ctrl+Enter` sends.
- **ARIA:** `nav` landmark for sidebar; thread toggle = `role="tablist"`; dropzone has a real
  `<label>` + visible file list; status pills not color-only (text label too).
- **Targets/contrast:** 44px min touch targets; body ≥16px; pill text uses the dark stop of its ramp
  (≥4.5:1). SLA urgency never encoded by color alone — chip carries text ("overdue 1d").

---

## 11. Admin-side additions (from decision 3)

- **Availability override** on `/admin/staff/[id]`: admin can change a staff member's
  Available/Busy/OOO; feeds the module-3 router responsiveness factor.
- **Leave-approval queue** (new, under `/admin/staff` or an Assignment section): staff time-off
  requests with Approve / Decline; approved days mark the staff unavailable on the calendar/router.

---

## 12. Phasing

- **Phase 0:** StaffShell + staffNav + staffMock + promote shared kit.
- **Phase 1 (core loop):** My Day → My Tasks board → Task detail → DeliverableSubmit (versioned) →
  two-thread messages + leak guard.
- **Phase 2:** Calendar · Performance self-view · Notifications · Settings + AvailabilityToggle +
  time-off request. Admin: availability override + leave queue.
- **Phase 3:** power-ups parity (j/k, deep-link, copy-share, grid/table) + responsive + a11y + dark.
- **Verify** each screen with preview tools, light+dark, 375/768/1024/1440; assert no money/credit leaks.

---

## 13. Engineering decisions (eng review)

- **Scope sequencing (D2):** ship the **core loop first** (PR1 = StaffShell + nav + staffMock + My Day +
  board + task detail + DeliverableSubmit + MessageThread). T6 (admin availability/leave) and T7
  (shared-kit move) are **separate PRs**. Keeps the first diff reviewable; locks the data grain before
  fan-out.
- **A1 — one source of truth for Task/Order types:** define core `Task`/`Order` in one module
  (e.g. `data/types.ts`); `StaffTask = Omit<Task, 'value' | 'price'>` + `orderRef`. Both `adminMock`
  and `staffMock` derive from it. A money field reaching staff is a **TypeScript error**, not a runtime
  check — the no-money boundary is structural.
- **C1 — reuse the existing thread:** the admin order detail already implements internal/customer
  messaging ([OrderDetailClient.tsx:59-96](../../../apps/app/src/app/admin/orders/[id]/OrderDetailClient.tsx)).
  Extract a shared `MessageThread` (state + send + bubble + `internal` flag); admin keeps its toggle,
  staff wraps the two-tab + recipient label (D5) around the same core. One chat logic, fixed once.
- **Performance (backend phase):** load tasks with their parent-order context in a single query to
  avoid an N+1 across My Day + board. No impact in the mock phase.

## 13b. Performance page — from scorecard to coaching tool (built 2026-06-27)

The Performance screen (`/staff/performance`, "My standing") originally answered only *"how am I
doing?"* (composite, rank, earnings, trend). It now also answers *"what do I do next?"* — the half
that actually optimizes a staffer's work — using signals that already existed in `staffMock` but
were unused on the page.

### 13b.1 "Where to focus" band (under the KPI tiles, above earnings)

Three cards, actionable content placed above vanity metrics:

1. **Your lever this period** — the single coachable metric most worth moving, with a targeted
   nudge, a concrete "Do next" line, and a `+N pts` badge (composite points gainable). Personalised
   per staffer, not the same fixed advice for everyone.
2. **Latest review** — `latestReview()`: the reviewer's most recent QA note on the staffer's work,
   flagged when changes were requested. The single most actionable item; previously invisible here.
3. **From your manager** — `myManager()`: the reviewing manager's name/title + their standing
   guidance note (`MANAGER_NOTE`).

### 13b.2 Coherent scoring model (one source of truth in `lib/staff.ts`)

Replaces the old "What lifts your score" card that hard-coded weights (45/35/20) disconnected from
any logic. Now a single model drives the recommendation **and** a real "How your score is built"
breakdown so the two always agree:

- **`SCORE_MODEL`** — `quality 0.45 · on-time 0.35 · throughput 0.20` (weights sum to 1, asserted in
  tests). Goals: `QUALITY_GOAL = 95`, `ON_TIME_GOAL = 90`. `THROUGHPUT_TARGET = 45` tasks/30d maps
  to a 100 throughput score and caps above, so raw speed can't dominate the blend.
- **`modelComposite(inputs)`** — the weighted blend of the three normalised levers.
- **`scoreBreakdown(inputs, composite)`** — decomposes a composite into weighted segments + per-lever
  headroom (`(goal − score) × weight`). Segments are **scaled to sum exactly to the passed
  composite**, so the stacked bar always reconciles to the headline number (the mock's hand-authored
  `composite` may differ from `modelComposite` by a point; the bar follows the headline).
- **`improvementLever(stats)`** — weight-aware: returns the actionable lever (quality **or** on-time —
  **never** raw throughput, since "just do more" trades off the quality the score rewards) with the
  most composite headroom. Returns null when both are at/above goal.

The breakdown card renders a stacked contribution bar (coloured chunks sum to the composite, grey =
headroom to 100) + per-lever rows showing score, weight, contribution points, and remaining headroom,
with the recommended lever marked "Your lever" — visually tying the two cards into one story.

### 13b.3 Earnings history + Track record (data-dense expansion, built 2026-06-27)

Beyond the score, the page now shows the full picture of a staffer's work and pay.

**Earnings** — was a single-month card, now a history:
- Summary tiles: this-month take-home · **year-to-date** · **avg/month** · **MoM %** (+ best month).
- **Variable-pay bars** (6 months): commission + bonus stacked per month — base salary is fixed, so
  the bars show only the part that moves with performance; tasks-completed count under each bar.
- Monthly table: month · tasks · base · commission · bonus · take-home (current month highlighted).
- The current month is the **authoritative live payout** (`myEarnings`/`PAYOUTS`); prior months are
  deterministically seeded, with commission tracking that month's task volume.
- No-money boundary intact: only the staffer's **own pay** — never customer pricing.

**Track record** — lifetime delivery quality from a money-free completed-work archive:
- Stat tiles: tasks done (+ active in-flight) · first-pass % · revision rate (+ rounds/task) ·
  avg rating · on-time % · avg turnaround (days).
- **By service**: per-service count, share %, avg rating, revision rate, with the strongest service
  (highest avg rating, ≥2 tasks) badged.
- **Rating distribution**: 5★→1★ bars with counts + overall average.
- **Task history table**: per task — code · service · package · completed · versions · revisions
  (first-pass tick or rework count) · on-time · star rating. Scrollable, sticky header.

**Data model:** `WorkItem` (code, service, pkg, customer, completedAt, versions, revisions, onTime,
rating, turnaround days, reviewNote) — money-free by construction. `WORK_ARCHIVE` in `staffMock`
stands in for a real `tasks` archive (adminMock's `ORDERS` is only the current snapshot); the recent
rows mirror the staffer's real June orders, older rows extend back across the year. Pure aggregations
`workStats` (quality/service/rating/timeliness) and `summariseEarnings` (YTD/avg/MoM/best) live in
`lib/staff.ts`, fully unit-tested. Per-task **ratings** (admin manual 1–5) are introduced here — the
staff-facing mirror of module 7's `order_ratings`.

**Deeper cuts (built 2026-06-27, second pass):** six more parameter groups, all pure helpers in
`lib/staff.ts` with tests:
- **`ratingTrend`** — avg admin rating per month (mini bar chart in the rating-distribution card).
- **`firstPassStreak`** — current + best run of consecutive zero-revision deliveries (profile strip).
- **`tasksByCustomer`** — task count + avg rating per client (track-record card).
- **`revisionReasons`** + **`categorizeRevision`** — bucket the review notes on bounced tasks into
  themes (Internal links/meta · Tone/brand · Anchor diversity · Search intent · Accuracy/sources ·
  Other) with counts + an example — "why your work came back".
- **You vs team** — each scored metric (composite/quality/on-time/throughput) against the team mean,
  with a dual bar (you vs average) and signed delta. Computed in the page from `STAFF`.
- **Tenure + tasks/month** — `tenureSince(joinDate)` + total ÷ active months, in the profile strip.

**Interactive Work-activity chart (built 2026-06-27, fourth pass):** the oversized variable-pay SVG
bar chart (which scaled uniformly with width → ~700px tall on wide screens) was removed from the
Earnings card, leaving it compact (summary tiles + monthly pay table). A new **`WorkActivityChart`**
client component (`components/staff/WorkActivityChart.tsx`) replaces it: a **Day / Week / Month / Year**
toggle and a **Tasks / Earnings** metric toggle, with each bar **stacked by task type** (Content,
Keyword, Optimization, Backlink, Audit, Indexer — coloured via `serviceMeta`). It's a **fixed-height
CSS bar chart (184px)** — labels live outside the plot so bars can't overflow, and it never grows tall
on wide screens the way a uniformly-scaled SVG does. Data comes from `buildActivity(staffId)` in
`staffMock` — a deterministic synthetic series (the 16-task rated archive is too sparse for a day view),
Content-weighted, where every bucket carries per-type task counts **and** the variable pay those tasks
earned, so the chart switches metrics without refetching. Unit-tested (bucket counts, slice sums =
bucket totals, determinism).

**Notes — full-page reader/editor (built 2026-06-27, eleventh pass):** notes can now be opened and
edited as a **full page** (docs-style), not just in the modal. New routes `/staff/notes/[id]`
(reader), `/staff/notes/[id]/edit` and `/staff/notes/new` (editor) render a `max-w-3xl` document
layout reusing the same `NoteFormBody` + rich-text editor. The reader modal gains an **Open full
page** button and the composer modal an **Expand to full page** button. To keep every surface in
sync, all notes now flow through a shared **localStorage-backed store** (`data/notesStore` —
`useNotes`), seeded from `SEED_NOTES`; an edit made in the modal, the list, or a full page shows up
everywhere and persists across navigation. Editor seeds instantly from the store (no loading flash
for existing notes) and re-seeds once after hydration for correctness.

**Notes — inline media embeds + bigger editor (built 2026-06-27, tenth pass):** the note rich-text
editor now embeds media **inline**. Pasting an image file, an image URL, or a video link (YouTube /
Vimeo / direct `.mp4`) auto-converts it in place via `mediaEmbedHtml` — YouTube/Vimeo become a
responsive 16:9 `<iframe>` (nocookie host), images an `<img>`, direct files a native `<video controls>`.
Toolbar gains **Insert image** (upload → data-URL) and **Embed video** (URL prompt) buttons. The
**sanitizer** (`lib/sanitizeHtml`) was extended to allow `img` / `video` / `source` / `iframe` under a
strict scheme + host allowlist (iframes only from youtube / youtube-nocookie / player.vimeo — never an
arbitrary frame; image data-URLs raster-only, no SVG), so the save boundary stays XSS-safe. Media is
styled responsive in `.note-rte` / `.note-html`; card previews hide heavy embeds. The composer modal
grew to `max-w-4xl` with a taller editor (min 420px), and the reader to `max-w-3xl`. `mediaEmbedHtml`
+ id extractors are unit-tested.

**Topbar bell dropdown + payroll/wallet events (built 2026-06-27, ninth pass):** four more
notification kinds so the inbox covers everything that matters — **salary** (payroll paid →
payslip), **payout** (withdrawal landed → wallet), **leave** (time-off decision → schedule),
**message** (manager/customer note → thread) — each with its own icon/tone/action. New
**`NotifBell`** client component replaces the static topbar bell: an unread **count badge**, a
dropdown preview of the six most recent notifications (icon, title, 2-line body, relative time,
quick-action, unread tint), **Mark all read**, and a **"View all notifications"** footer link.
Closes on outside-click / Escape; clicking a row marks it read and routes to its task or deep link.

**Notifications upgrade (built 2026-06-27, eighth pass):** the notifications inbox now reflects the
staffer's whole world. Three new kinds — **penalty** (a fine flagged/applied → wallet), **bonus** (a
reward unlocked → wallet), **tier** (commission-tier progress → standing) — join assignment/changes/
reminder/approved, each with its own icon/tone/action. Notifications carry an ISO `ts` and are
**grouped by day** (Today / Yesterday / Earlier via the pure `dayBucket` helper). The client adds
**category filter chips** (All + each kind present, with counts), an **Unread-only** toggle, a
**contextual quick-action** per row (Resume task / View wallet / View standing…), per-row **dismiss**,
and a **left accent** on urgent kinds (penalty red, changes amber). Clicking a row marks it read and
routes to its task or deep link.

**Bonus rewards + penalty summary (built 2026-06-27, seventh pass):** below the task-history table,
two cards. **Bonus rewards** — six milestone bonuses, each a card with a **progress bar** toward its
target (Flawless Streak 20-in-a-row · Top Rated ≥4.5★/month · Podium top-3 · On the Dot 100% on-time ·
Clean Sweep ≥90% first-pass · Centurion 100 tasks), unlocked ones turning emerald with an "Earned"
check; header shows total **earned vs on-offer** ($50 / $400 for Huy). All derived from existing
performance signals via `buildRewards` in the dedicated `lib/staffRewards` module — bonuses are fixed
amounts, never tied to order value. **Penalties & reasons** — a `summarisePenalties` roll-up: status
totals (applied −$43 / pending −$12 / waived), a by-type chip row (Excess revisions / Late / Low
rating), and a full list of every fine with its **reason**, status pill, task link, rule, and date.

**Penalty column + table tidy (built 2026-06-27, sixth pass):** the task-history table gained a
**Penalty** column — per-task fines from the finance surface via `taskPenalty(code)` (rolls a task's
penalties into applied / pending / waived; applied shown red, pending amber "pending", waived muted,
clean tasks "—"). The header summary adds total applied fines (`appliedPenaltyTotal`). The **Ver**
and standalone **Completed** columns were removed; the completed **date now sits under the code** in
the same column (UTC-formatted "Jun 25, 2026"). Unit-tested (`taskPenalty` applied/pending/waived
roll-up, null for clean tasks).

**Commission column + tier (built 2026-06-27, fifth pass):** the task-history table now shows the
**commission** (the staffer's own pay) earned on each task — a per-task USD figure on `WorkItem`,
matching the finance wallet for recent tasks. A **commission tier** banner above the table
(`commissionTierFor(composite)` — Starter/Standard/Senior/Lead by composite, each a relative `mult`
of the base) communicates "do better → managers bump you up → bigger per-task commission"; Huy at
composite 84 sits in Standard, **1 point from Senior**, tying straight back to his on-time lever.
No customer price leaks: commission is a flat per-task amount, never order-value × rate. `workStats`
gained `totalCommission` / `avgCommission`. Clicking a code now opens the **full live task**
(`/staff/tasks/[id]`) when it's still on the board, falling back to the archived detail otherwise.

**Clickable tasks → history detail (built 2026-06-27, third pass):** every code in the task-history
table (and the revision-reason examples) is a link that **opens the task in a new tab**
(`target="_blank"`). New route **`/staff/history/[code]`** renders a read-only archived-task detail:
a **date timeline** (Started → Deadline → Delivered) derived by `taskTimeline` (pure, tested —
start = completed − turnaround; deadline sits after completion when on time, before it when late),
plus turnaround, version count, on-time/first-pass pills, star rating, customer/package, and the
reviewer note. When the archived code is still a live board task, an **"Open full task →"** button
links to `/staff/tasks/[id]`. Dates are UTC-pinned so they never drift by timezone. A **Customer**
column was also added to the task-history table.

### 13b.4 Files

| File | Role |
|------|------|
| `apps/app/src/lib/staff.ts` | Scoring model + `workStats`/`summariseEarnings`/`ratingTrend`/`firstPassStreak`/`tasksByCustomer`/`revisionReasons` (pure, tested) |
| `apps/app/src/data/staffMock.ts` | `WORK_ARCHIVE` (with customer + reviewNote), `workHistory`, `myWorkStats`, `earningsHistory`, `myEarningsSummary`, `activeWorkload` |
| `apps/app/src/app/staff/performance/page.tsx` | Coaching band + score breakdown + earnings history + track record + by-service/customer/reason cuts + rating trend + vs-team + task table |
| `apps/app/src/lib/staff.test.ts` | Unit tests: scoring model, all aggregates, streak/trend/customer/reason logic, archive consistency (85 total) |

## 14. Tests (mock phase — unit on pure logic; E2E deferred to backend)

100% of the pure logic is testable now without a backend. Each lands with its component:

| Function | File | Asserts |
|---|---|---|
| `slaChip(daysToDue)` | `components/staff/SlaChip` | overdue / ≤8h / today / >1d → correct label + tone |
| `nextStaffActions(status)` | `lib/staffTransitions` | only Start / Submit / Resume; **never** Approve / Cancel / reassign |
| `bumpVersion(submissions)` | `components/staff/DeliverableSubmit` | v1→v2 on resubmit; newest = `current`; older read-only |
| `StaffTask` no-money guard | `data/types.test-d.ts` (tsd) | type carries no `value` / `price` key |
| `emptyStateFor(staff, tasks)` | `components/staff/EmptyState` | new-hire vs all-caught-up variant selected correctly |
| `modelComposite` / `scoreBreakdown` | `lib/staff` | weights sum to 1; segments reconcile to the passed composite; throughput has no goal |
| `improvementLever(stats)` | `lib/staff` | weight-aware lever choice; **never** recommends throughput; null when both at/above goal |

`nextStaffActions` and the no-money guard are **invariant tests** (staff can't approve; staff never
sees money) — treat as CRITICAL. E2E (submit → review round-trip) deferred until the backend exists.

## NOT in scope (deferred, with rationale)
- Customer-facing rating of staff — admin-only for now (module 7 open item).
- Real-time presence/typing indicators in chat — Phase 2+ once Realtime is wired.
- Mobile-native app — responsive web only.
- In-app file preview/diff of deliverable versions — link out / download for v1; viewer later.
- Staff editing their own skills directly — Phase 1 is "request change", admin confirms.

## What already exists (reuse, don't rebuild)
- `dashboard.css` design system + `@heva/ui` tokens.
- Admin shared kit (`KpiTile/StatBadge/DataTable/PageHeader/SlideOver`) — promote to `components/shared/`.
- Power-up patterns already shipped in `StaffClient`/`OrdersExplorer` (j/k, `?id=` deep-link, copy-share, grid/table, toasts, activity log) — port to the staff queue.
- Portal `Toast`, `ThemeToggle`, shell pattern (`PortalShell`).
- Module-7 scoring (`composite/quality/on-time/throughput`) — staff view is a read-only mirror.

## Approved mockups
| Screen | Reference | Direction | Notes |
|---|---|---|---|
| Task detail | inline wireframe (this session; gstack designer unavailable — no OpenAI key) | list-led hierarchy, dashed dropzone, blue/amber two-thread toggle with recipient label | Re-render as PNG once `$D setup` has a key, for handoff fidelity |

---

## Implementation Tasks
Synthesized from this review's findings. Each derives from a finding above.

- [ ] **T1 (P1, human: ~3h / CC: ~25min)** — DeliverableSubmit — versioned submit (file|link + required note, v-bump on resubmit)
  - Surfaced by: D6 / §5.1
  - Files: `apps/app/src/components/staff/DeliverableSubmit.tsx`, `apps/app/src/data/staffMock.ts`
  - Verify: submit twice → v1 read-only, v2 current; submit blocked with empty note
- [ ] **T2 (P1, human: ~2h / CC: ~20min)** — MessagePanel — two threads + composer recipient label (leak guard)
  - Surfaced by: D5 / §5.2
  - Files: `apps/app/src/components/staff/MessagePanel.tsx`
  - Verify: switching tab flips the "Sending to:" label + color; Customer banner present
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — My Day — list-led Focus layout + SLA chip scale
  - Surfaced by: D3 / §3
  - Files: `apps/app/src/app/(staff)/staff/page.tsx`, `apps/app/src/components/staff/SlaChip.tsx`
  - Verify: overdue/due-today/changes-requested lead; KPI strip below
- [ ] **T4 (P1, human: ~2h / CC: ~20min)** — Interaction states — loading/empty/error/partial across screens incl. 2 My Tasks empty states
  - Surfaced by: Pass 2 / §4, §4.1
  - Files: staff screens + shared `EmptyState`, `ErrorState` components
  - Verify: new-hire vs all-caught-up render distinctly; failed load shows Retry
- [ ] **T5 (P2, human: ~1.5h / CC: ~15min)** — Responsive + a11y pass (375/768/1024, j/k, ARIA, 44px, contrast)
  - Surfaced by: Pass 6 / §8
  - Files: StaffShell + screens
  - Verify: phone single-column, keyboard nav works, pills not color-only
- [ ] **T6 (P2, human: ~2h / CC: ~20min)** — Admin: availability override + leave-approval queue
  - Surfaced by: decision 3 / §9
  - Files: `apps/app/src/app/admin/staff/[id]/StaffProfileClient.tsx`, new leave queue
  - Verify: admin changes availability; approving leave marks unavailable
- [ ] **T7 (P3, human: ~30min / CC: ~5min)** — Promote shared kit `components/admin/* → components/shared/*`
  - Surfaced by: Pass 5 / §7
  - Files: 5 kit components + import updates
  - Verify: admin still renders; staff imports from `shared`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 3 findings, 0 critical gaps, SCOPE_REDUCED |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | reviewed (FULL) | score 6/10 → 8/10, 4 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG + DESIGN CLEARED — ready to implement. Eng review (SCOPE_REDUCED): core-loop-first sequencing, 3 findings folded (A1 shared Task types + money-stripped-at-type-level, C1 reuse `MessageThread`, T1 unit tests on pure logic); 0 critical gaps. Design review: 6→8/10, 4 decisions (My Day hierarchy, dual empty states, chat leak-guard, versioned deliverables).

NO UNRESOLVED DECISIONS
