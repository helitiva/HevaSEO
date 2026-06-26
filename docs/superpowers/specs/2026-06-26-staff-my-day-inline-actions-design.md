# Spec — Staff "My Day" inline actions redesign

**Date:** 2026-06-26
**Surface:** `/staff` (apps/app/src/app/staff/page.tsx)
**Part of:** [Staff surface](2026-06-26-staff-surface-design.md). Brainstormed via the brainstorming skill.

Turn My Day from a read-only list into the place a staffer *works*: act on tasks inline
(Start / Submit / Resume) without opening each one, with momentum feedback and keyboard control.
Customer pricing stays hidden — this screen never shows money.

## Decisions (locked in brainstorm)

1. **Inline actions per row**, driven by the staffer's allowed transitions only.
2. **Start / Resume = 1-click** in place (optimistic). **Submit = quick-submit slide-over** reusing
   `DeliverableSubmit` (file/link + required note) — the whole loop happens on My Day.
3. **After-action:** optimistic update + toast with **Undo** + a **"Cleared today"** section that
   accumulates; KPI strip updates live.
4. **Keyboard:** `j/k` move highlight · `enter` open detail · `Space` run the highlighted row's
   primary action · `Esc` close slide-over. Ignored while typing in an input/textarea.

## Architecture

Approach A (chosen): one client island, `MyDayClient`, owns the interactive state; the page stays a
Server Component that computes initial data + greeting and passes it down. Mirrors the existing
`StaffClient` / `TaskDetailClient` pattern.

```
app/staff/page.tsx (server)
  ├─ computes greeting(hour), focus[] (actionable, sorted), KPIs seed
  └─ <MyDayClient initialFocus greeting capacity />   (client)
        ├─ FocusRow[]  — SLA chip · code · service · badges · primary action · ⋯ menu
        ├─ SlideOver + DeliverableSubmit   (Submit flow)
        ├─ ClearedToday — running tally + list
        ├─ KpiStrip — load / overdue / due today / cleared  (live)
        └─ keyboard handler (j/k/enter/space/esc) + Toast w/ Undo
```

## Components & files

- **New** `apps/app/src/components/staff/MyDayClient.tsx` — client island (focus list + KPIs +
  cleared-today + slide-over + toast + keyboard).
- **Modify** `apps/app/src/app/staff/page.tsx` — server page: compute `focus`, `greeting`,
  `capacity`; render `<MyDayClient/>`. Keep the existing empty-state path for zero tasks.
- **New** `apps/app/src/lib/myDay.ts` — pure logic (unit-tested): `primaryActionFor(status)`,
  the cleared-today reducer (`applyAction`, `undoAction`).
- **Reuse** `components/shared/SlideOver`, `components/staff/DeliverableSubmit`, `components/staff/SlaChip`,
  `components/shared/StatBadge`, `lib/staff` (`nextStaffActions`, `daysToDue`, `PRIORITY_RANK`).

## Row anatomy & inline actions

Each Focus row: `SlaChip` · `code` · `service · pkg` · priority + status badges · **primary action
button** · `⋯` menu (Open, Copy link).

| Status | Primary action | Behaviour |
|---|---|---|
| `assigned` | **Start** (`ph-play`) | optimistic → `in_progress`; row stays, action flips to Submit |
| `in_progress` | **Submit** (`ph-paper-plane-tilt`) | opens quick-submit slide-over |
| `changes_requested` | **Resume** (`ph-arrow-counter-clockwise`) | optimistic → `in_progress`; action flips to Submit |

`primaryActionFor(status)` returns `nextStaffActions(status)[0]`. Overdue rows keep the
`bg-destructive/5` tint; the highlighted (keyboard-selected) row gets a `ring`.

## Quick-submit slide-over

Primary "Submit" → `SlideOver` (title = task code) holding `DeliverableSubmit` (dropzone file/link +
required note, version-aware). On submit: task → `internal_review`, leaves Focus, lands in Cleared
today as "Submitted", toast "Sent to review · Undo". `Esc` / backdrop closes.

## Cleared today + Undo + live KPIs

- **Cleared today**: count badge + list of entries `{verb, code, time}` where verb ∈ Started /
  Submitted / Resumed. Sits below the Focus card.
- **Undo**: every action shows a toast (~5s) with Undo that restores the row to Focus and removes the
  cleared entry (reducer `undoAction`).
- **KPI strip** stays 4 tiles but **"Needs rework" is replaced by "Cleared"** (rework tasks are
  already surfaced in the Focus list with a Resume button, so the tile is redundant; "Cleared" adds the
  momentum signal). Tiles: My load · Overdue · Due today · **Cleared** — recomputed from live client
  state so numbers move as you act.

## States & edge cases

- **All cleared** (Focus empty after acting): show a warm "You cleared N today 🎉" summary above the
  existing `EmptyState` (`caught-up`).
- **Zero tasks ever**: server still renders the `new-hire` empty state (no client island needed).
- **Keyboard**: handler no-ops when `document.activeElement` is an input/textarea or the slide-over is
  open (except `Esc`). `Space` on a row whose primary action is Submit opens the slide-over.
- **Undo window**: after the toast expires the action stands (mock; no persistence).
- **Submit guard**: required note already enforced inside `DeliverableSubmit`.

## Testing (vitest, pure logic)

- `primaryActionFor`: assigned→Start, in_progress→Submit, changes_requested→Resume, terminal→none.
- Reducer: `applyAction` moves a task out of focus + appends a cleared entry with the right verb;
  `undoAction` restores it and drops the entry; KPI counts derive correctly before/after.
- No-money guard stays satisfied (MyDay data is `StaffTask`, money-free at the type level).

## NOT in scope (deferred)

- "Next up" single-task hero, richer rows (checklist %, time-in-status), streaks/momentum ring — other
  brainstorm directions, not chosen this round.
- Real persistence of Cleared today across reloads/days (needs backend).
- Bulk actions / multi-select on My Day.

## What already exists (reuse, don't rebuild)

`DeliverableSubmit`, `SlideOver`, `SlaChip`, `StatBadge`, `nextStaffActions`, the toast + optimistic
pattern from `TaskDetailClient`, and the current `page.tsx` focus-sort + empty-state logic.
