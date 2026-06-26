# Staff My Day — Inline Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/staff` (My Day) into a place to work — act on tasks inline (Start/Resume 1-click, Submit via slide-over), with an Undo-able "Cleared today" log, live KPIs, and j/k/enter/space keyboard control.

**Architecture:** One client island `MyDayClient` owns optimistic state; `app/staff/page.tsx` stays a Server Component that computes the focus list + greeting and passes them down. All mutating logic lives in a pure, unit-tested `lib/myDay.ts` (TDD). Reuses `SlideOver`, `DeliverableSubmit`, `SlaChip`, `StatBadge`, `nextStaffActions`.

**Tech Stack:** Next 15 App Router, React 19, Tailwind + `dashboard.css`, vitest. App commands: `pnpm --filter @heva/app <cmd>`. Spec: [2026-06-26-staff-my-day-inline-actions-design.md](../specs/2026-06-26-staff-my-day-inline-actions-design.md).

**Sandbox note:** the preview harness can't spawn processes here. Verify with `tsc` + `vitest` + `curl http://localhost:4400/...` against the running dev server.

**Hard constraint:** no money/customer pricing anywhere on `/staff`. `MyDayTask` is money-free by construction.

---

## File Structure

- **Create** `apps/app/src/lib/myDay.ts` — pure logic: `MyDayTask`/`LogEntry`/`MyDayState` types, `primaryActionFor`, `applyAction`, `undoAction`, `deriveKpis`.
- **Create** `apps/app/src/lib/myDay.test.ts` — vitest for the above.
- **Create** `apps/app/src/components/staff/MyDayClient.tsx` — the client island (rows + inline actions + slide-over + cleared-today + toast + keyboard + KPIs).
- **Modify** `apps/app/src/app/staff/page.tsx` — server page builds `MyDayTask[]` + greeting and renders `<MyDayClient/>`.

---

## Task 1: Pure logic — types + `primaryActionFor`

**Files:**
- Create: `apps/app/src/lib/myDay.ts`
- Test: `apps/app/src/lib/myDay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/lib/myDay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { primaryActionFor } from './myDay';

describe('primaryActionFor', () => {
  it('maps each actionable status to its single staff action', () => {
    expect(primaryActionFor('assigned')?.label).toBe('Start');
    expect(primaryActionFor('in_progress')?.label).toBe('Submit for review');
    expect(primaryActionFor('changes_requested')?.label).toBe('Resume');
  });
  it('returns null when there is no staff action', () => {
    expect(primaryActionFor('internal_review')).toBeNull();
    expect(primaryActionFor('completed')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `pnpm --filter @heva/app exec vitest run src/lib/myDay.test.ts`
Expected: FAIL — `myDay` has no export `primaryActionFor`.

- [ ] **Step 3: Implement minimal `myDay.ts`**

Create `apps/app/src/lib/myDay.ts`:

```ts
// Pure My-Day logic. No React, no money — unit-tested in myDay.test.ts.
import { nextStaffActions, type StaffAction } from './staff';
import type { OrderStatus, Priority } from '@/data/adminMock';

// Money-free row VM passed from the server page into the client island.
export interface MyDayTask {
  id: string; code: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; days: number | null;
}

// The single action a staffer may take on a row (Start/Submit/Resume), or null.
export function primaryActionFor(status: OrderStatus): StaffAction | null {
  return nextStaffActions(status)[0] ?? null;
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `pnpm --filter @heva/app exec vitest run src/lib/myDay.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/myDay.ts apps/app/src/lib/myDay.test.ts
git commit -m "feat(staff): myDay primaryActionFor + MyDayTask type"
```

---

## Task 2: Pure logic — reducer (`applyAction`, `undoAction`, `deriveKpis`)

**Files:**
- Modify: `apps/app/src/lib/myDay.ts`
- Test: `apps/app/src/lib/myDay.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `apps/app/src/lib/myDay.test.ts`:

```ts
import { applyAction, undoAction, deriveKpis, type MyDayState, type MyDayTask } from './myDay';

const t = (over: Partial<MyDayTask>): MyDayTask => ({
  id: 'o1', code: 'AUD-1', service: 'Audit', pkg: 'Std', status: 'assigned', priority: 'med', days: 1, ...over,
});
const seed = (): MyDayState => ({
  focus: [t({ id: 'a', status: 'assigned', days: 2 }), t({ id: 'b', status: 'in_progress', days: 0 }), t({ id: 'c', status: 'changes_requested', days: -1 })],
  log: [],
});
let n = 0; const ids = () => `e${n++}`;

describe('applyAction', () => {
  it('Start keeps the task in focus as in_progress and logs "Started"', () => {
    const s = applyAction(seed(), 'a', '09:00', ids);
    expect(s.focus.find((x) => x.id === 'a')?.status).toBe('in_progress');
    expect(s.log[0]).toMatchObject({ verb: 'Started', code: 'AUD-1', leftFocus: false });
  });
  it('Submit removes the task from focus and logs "Submitted"', () => {
    const s = applyAction(seed(), 'b', '09:00', ids);
    expect(s.focus.some((x) => x.id === 'b')).toBe(false);
    expect(s.log[0]).toMatchObject({ verb: 'Submitted', leftFocus: true });
  });
  it('Resume keeps the task in focus as in_progress and logs "Resumed"', () => {
    const s = applyAction(seed(), 'c', '09:00', ids);
    expect(s.focus.find((x) => x.id === 'c')?.status).toBe('in_progress');
    expect(s.log[0].verb).toBe('Resumed');
  });
  it('is a no-op for an unknown id', () => {
    const before = seed();
    expect(applyAction(before, 'zzz', '09:00', ids)).toBe(before);
  });
});

describe('undoAction', () => {
  it('restores a submitted task back into focus, sorted soonest-due first', () => {
    const s = applyAction(seed(), 'b', '09:00', ids);
    const u = undoAction(s, s.log[0].id);
    expect(u.focus.map((x) => x.id)).toContain('b');
    expect(u.log).toHaveLength(0);
    const days = u.focus.map((x) => x.days ?? 99);
    expect(days).toEqual([...days].sort((p, q) => p - q));
  });
  it('reverts a Start back to assigned', () => {
    const s = applyAction(seed(), 'a', '09:00', ids);
    const u = undoAction(s, s.log[0].id);
    expect(u.focus.find((x) => x.id === 'a')?.status).toBe('assigned');
  });
});

describe('deriveKpis', () => {
  it('counts load/overdue/dueToday from focus and cleared from the log', () => {
    const s = applyAction(seed(), 'b', '09:00', ids); // submit b (was due today)
    const k = deriveKpis(s);
    expect(k.load).toBe(2);
    expect(k.overdue).toBe(1);
    expect(k.dueToday).toBe(0);
    expect(k.cleared).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @heva/app exec vitest run src/lib/myDay.test.ts`
Expected: FAIL — `applyAction`/`undoAction`/`deriveKpis` not exported.

- [ ] **Step 3: Implement the reducer**

Append to `apps/app/src/lib/myDay.ts`:

```ts
export type ActionVerb = 'Started' | 'Resumed' | 'Submitted';

export interface LogEntry {
  id: string; verb: ActionVerb; code: string; at: string;
  task: MyDayTask;     // pre-action snapshot, for undo
  leftFocus: boolean;  // true only for Submitted
}

export interface MyDayState { focus: MyDayTask[]; log: LogEntry[]; }

const VERB: Partial<Record<OrderStatus, ActionVerb>> = {
  assigned: 'Started', changes_requested: 'Resumed', in_progress: 'Submitted',
};
const PRIO: Record<Priority, number> = { high: 0, med: 1, low: 2 };
const bySoonest = (a: MyDayTask, b: MyDayTask) =>
  (a.days ?? 99) - (b.days ?? 99) || PRIO[a.priority] - PRIO[b.priority];

// Run a row's primary action. Start/Resume → in_progress (stays in focus);
// Submit → internal_review (leaves focus). Always prepends a log entry.
export function applyAction(state: MyDayState, id: string, at: string, makeId: () => string): MyDayState {
  const task = state.focus.find((x) => x.id === id);
  if (!task) return state;
  const verb = VERB[task.status];
  if (!verb) return state;
  const leftFocus = verb === 'Submitted';
  const entry: LogEntry = { id: makeId(), verb, code: task.code, at, task: { ...task }, leftFocus };
  const focus = leftFocus
    ? state.focus.filter((x) => x.id !== id)
    : state.focus.map((x) => (x.id === id ? { ...x, status: 'in_progress' } : x));
  return { focus, log: [entry, ...state.log] };
}

// Undo a logged action: restore the pre-action snapshot (re-insert if it had left focus).
export function undoAction(state: MyDayState, entryId: string): MyDayState {
  const entry = state.log.find((e) => e.id === entryId);
  if (!entry) return state;
  const log = state.log.filter((e) => e.id !== entryId);
  const focus = (entry.leftFocus
    ? [...state.focus, entry.task]
    : state.focus.map((x) => (x.id === entry.task.id ? entry.task : x))
  ).sort(bySoonest);
  return { focus, log };
}

export interface MyDayKpis { load: number; overdue: number; dueToday: number; cleared: number; }

// Live counters. `load` = actionable items still in focus; `cleared` = actions taken today.
export function deriveKpis(state: MyDayState): MyDayKpis {
  return {
    load: state.focus.length,
    overdue: state.focus.filter((x) => (x.days ?? 0) < 0).length,
    dueToday: state.focus.filter((x) => x.days === 0).length,
    cleared: state.log.length,
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm --filter @heva/app exec vitest run src/lib/myDay.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/lib/myDay.ts apps/app/src/lib/myDay.test.ts
git commit -m "feat(staff): myDay reducer (applyAction/undoAction/deriveKpis) + tests"
```

---

## Task 3: `MyDayClient` island

**Files:**
- Create: `apps/app/src/components/staff/MyDayClient.tsx`

- [ ] **Step 1: Write the component**

Create `apps/app/src/components/staff/MyDayClient.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { DeliverableSubmit } from '@/components/staff/DeliverableSubmit';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { deliverablesFor } from '@/data/staffMock';
import { primaryActionFor, applyAction, undoAction, deriveKpis, type MyDayTask, type MyDayState } from '@/lib/myDay';

interface Props { greeting: string; capacity: number; everHadTasks: boolean; initialFocus: MyDayTask[]; }

const VERB_TONE: Record<string, string> = { Submitted: 'text-emerald-500', Started: 'text-primary', Resumed: 'text-amber-500' };

export function MyDayClient({ greeting, capacity, everHadTasks, initialFocus }: Props) {
  const router = useRouter();
  const [state, setState] = useState<MyDayState>({ focus: initialFocus, log: [] });
  const [sel, setSel] = useState(0);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; entryId: string } | null>(null);
  const idc = useRef(0);
  const makeId = () => `c${idc.current++}`;
  const kpis = deriveKpis(state);

  const subtitle =
    kpis.overdue > 0 ? `${kpis.overdue} overdue — clear ${kpis.overdue === 1 ? 'it' : 'these'} first`
      : kpis.dueToday > 0 ? `${kpis.dueToday} due today`
        : kpis.load > 0 ? `${kpis.load} task${kpis.load === 1 ? '' : 's'} need you`
          : 'Nothing needs you right now';

  function flash(text: string, entryId: string) {
    setToast({ text, entryId });
    setTimeout(() => setToast((c) => (c?.entryId === entryId ? null : c)), 5000);
  }

  function act(id: string) {
    const task = state.focus.find((x) => x.id === id);
    if (!task) return;
    const action = primaryActionFor(task.status);
    if (!action) return;
    if (action.to === 'internal_review') { setSubmitId(id); return; } // Submit → slide-over
    const next = applyAction(state, id, now(), makeId);
    setState(next);
    flash(`${task.code} · ${verbPast(action.label)}`, next.log[0].id);
  }

  function confirmSubmit() {
    if (!submitId) return;
    const task = state.focus.find((x) => x.id === submitId);
    const next = applyAction(state, submitId, now(), makeId);
    setState(next);
    setSubmitId(null);
    if (task) flash(`${task.code} · sent to review`, next.log[0].id);
  }

  function undo(entryId: string) { setState((s) => undoAction(s, entryId)); setToast(null); }

  // Keyboard: j/k move, enter open, space = run the selected row's primary action.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (submitId || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const max = state.focus.length - 1;
      if (e.key === 'j') { e.preventDefault(); setSel((i) => Math.min(i + 1, max)); }
      else if (e.key === 'k') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && state.focus[sel]) router.push(`/staff/tasks/${state.focus[sel].id}`);
      else if (e.key === ' ' && state.focus[sel]) { e.preventDefault(); act(state.focus[sel].id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, sel, submitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTask = submitId ? state.focus.find((x) => x.id === submitId) : null;

  return (
    <section>
      <div className="mb-3">
        <h1 className="display text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="kcard mb-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <i className="ph-bold ph-target text-primary" aria-hidden /> Focus today
            {state.focus.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{state.focus.length}</span>}
          </p>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            <kbd className="rounded border border-border bg-muted px-1">j</kbd>/<kbd className="rounded border border-border bg-muted px-1">k</kbd> move · <kbd className="rounded border border-border bg-muted px-1">space</kbd> act
          </span>
        </div>

        {state.focus.length === 0 ? (
          <div>
            {kpis.cleared > 0 && <p className="mb-3 text-center text-sm font-semibold text-emerald-500">You cleared {kpis.cleared} today 🎉</p>}
            <EmptyState kind={emptyKindFor(everHadTasks || kpis.cleared > 0)} />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {state.focus.map((task, i) => {
              const action = primaryActionFor(task.status);
              const overdue = (task.days ?? 0) < 0;
              return (
                <li key={task.id} className={`-mx-2 rounded-lg px-2 ${overdue ? 'bg-destructive/5' : ''} ${i === sel ? 'ring-2 ring-primary/50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                    <SlaChip daysToDue={task.days} />
                    <Link href={`/staff/tasks/${task.id}`} className="font-medium hover:underline">{task.code}</Link>
                    <span className="text-sm text-muted-foreground">{task.service} · {task.pkg}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {action && (
                        <button onClick={() => act(task.id)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 ${action.primary ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
                          <i className={`ph-bold ${action.icon}`} aria-hidden /> {shortLabel(action.label)}
                        </button>
                      )}
                      <button onClick={() => copyLink(task.id, () => flash(`${task.code} · link copied`, makeId()))} aria-label="Copy link"
                        className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent"><i className="ph-bold ph-link" aria-hidden /></button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {state.log.length > 0 && (
        <div className="mb-3 rounded-2xl bg-muted/40 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-check-circle mr-1 text-emerald-500" aria-hidden /> Cleared today · {state.log.length}</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {state.log.map((e) => (
              <li key={e.id}><span className={VERB_TONE[e.verb] ?? ''}>{e.verb}</span> · {e.code} · {e.at}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="My load" value={`${kpis.load}/${capacity}`} icon="ph-gauge" tone={kpis.load >= capacity ? 'warn' : undefined} />
        <Stat label="Overdue" value={String(kpis.overdue)} icon="ph-warning" tone={kpis.overdue ? 'bad' : undefined} />
        <Stat label="Due today" value={String(kpis.dueToday)} icon="ph-calendar-check" tone={kpis.dueToday ? 'warn' : undefined} />
        <Stat label="Cleared" value={String(kpis.cleared)} icon="ph-check-circle" tone={kpis.cleared ? 'good' : undefined} />
      </div>

      <SlideOver open={!!submitId} onClose={() => setSubmitId(null)} title={submitTask ? `Submit ${submitTask.code}` : 'Submit'}>
        {submitTask && <DeliverableSubmit history={deliverablesFor(submitTask.id)} onSubmit={confirmSubmit} />}
      </SlideOver>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {toast.text}
          <button onClick={() => undo(toast.entryId)} className="font-semibold text-amber-400 hover:underline">Undo</button>
        </div>
      )}
    </section>
  );
}

function now() { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function shortLabel(label: string) { return label === 'Submit for review' ? 'Submit' : label; }
function verbPast(label: string) { return label === 'Start' ? 'started' : label === 'Resume' ? 'resumed' : 'submitted'; }
function copyLink(id: string, done: () => void) {
  navigator.clipboard?.writeText(`${window.location.origin}/staff/tasks/${id}`).then(done, done);
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'bad' | 'warn' | 'good' }) {
  const color = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${color}`} aria-hidden />
      </div>
      <p className="display mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @heva/app exec tsc --noEmit`
Expected: no new errors referencing `MyDayClient.tsx` (pre-existing admin `StaffClient` managerId error, if still present, is out of scope).

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/components/staff/MyDayClient.tsx
git commit -m "feat(staff): MyDayClient island — inline actions, slide-over submit, cleared-today, keyboard"
```

---

## Task 4: Wire the server page + verify

**Files:**
- Modify: `apps/app/src/app/staff/page.tsx`

- [ ] **Step 1: Replace `page.tsx` with the server wrapper**

Replace `apps/app/src/app/staff/page.tsx` entirely:

```tsx
import { MyDayClient } from '@/components/staff/MyDayClient';
import { MY_TASKS, CURRENT_STAFF } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { daysToDue, PRIORITY_RANK } from '@/lib/staff';
import type { MyDayTask } from '@/lib/myDay';

const ACTIONABLE = new Set(['assigned', 'in_progress', 'changes_requested']);
const CAPACITY = STAFF.find((s) => s.id === CURRENT_STAFF.id)?.capacity ?? 6;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function MyDayPage() {
  const focus: MyDayTask[] = MY_TASKS
    .filter((t) => ACTIONABLE.has(t.status))
    .map((t) => ({ id: t.id, code: t.code, service: t.service, pkg: t.pkg, status: t.status, priority: t.priority, days: daysToDue(t.deadline) }))
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const firstName = CURRENT_STAFF.name.split(' ')[0];

  return (
    <MyDayClient
      greeting={`${greeting(new Date().getHours())}, ${firstName}`}
      capacity={CAPACITY}
      everHadTasks={MY_TASKS.length > 0}
      initialFocus={focus}
    />
  );
}
```

- [ ] **Step 2: Type-check + full test suite**

Run: `pnpm --filter @heva/app exec tsc --noEmit` → no new errors.
Run: `pnpm --filter @heva/app test` → all green (existing 42 + new myDay tests).

- [ ] **Step 3: Verify the live route**

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4400/staff
curl -s http://localhost:4400/staff | grep -oiE "Focus today|Cleared|My load" | sort -u
curl -s http://localhost:4400/staff | grep -oiE '\$[0-9]|toLocaleString' || echo "no money (good)"
```
Expected: `200`; "Focus today" + "My load" + "Cleared" present; no money tokens.

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/app/staff/page.tsx
git commit -m "feat(staff): wire My Day server page to MyDayClient"
```

---

## Self-Review

- **Spec coverage:** inline Start/Resume (Task 3 `act` + reducer) ✓ · Submit slide-over (Task 3 `confirmSubmit` + `SlideOver`/`DeliverableSubmit`) ✓ · Cleared-today + Undo (Task 2 reducer + Task 3 toast/section) ✓ · live KPIs incl. Cleared-replaces-Needs-rework (Task 2 `deriveKpis` + Task 3 Stat strip) ✓ · keyboard j/k/enter/space/esc (Task 3 handler; Esc handled inside `SlideOver`) ✓ · no money (MyDayTask money-free, Task 4 grep) ✓ · empty states (Task 3 caught-up/new-hire + "cleared N") ✓.
- **Placeholders:** none — every step has full code/commands.
- **Type consistency:** `MyDayTask`/`MyDayState`/`LogEntry` defined in Task 1-2 and consumed unchanged in Task 3-4; `primaryActionFor`/`applyAction`/`undoAction`/`deriveKpis` signatures match call sites; reused component props match (`DeliverableSubmit {history,onSubmit}`, `SlideOver {open,onClose,title,children}`, `SlaChip {daysToDue}`, `StatusBadge {status}`/`PriorityBadge {priority}`).

## NOT in scope
"Next up" hero, richer rows, streak ring, multi-select, cross-day persistence of Cleared today (needs backend).
