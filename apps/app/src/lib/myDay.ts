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
    : state.focus.map((x) => (x.id === id ? { ...x, status: 'in_progress' as const } : x));
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

export type UrgencyKey = 'overdue' | 'today' | 'week' | 'later';
export interface FocusGroup { key: UrgencyKey; label: string; items: MyDayTask[]; }

const GROUP_ORDER: { key: UrgencyKey; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
];

export function urgencyGroup(days: number | null): UrgencyKey {
  if (days === null) return 'later';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

// Non-empty urgency groups, in order. Items keep the caller's sort.
export function groupFocus(tasks: MyDayTask[]): FocusGroup[] {
  return GROUP_ORDER
    .map(({ key, label }) => ({ key, label, items: tasks.filter((t) => urgencyGroup(t.days) === key) }))
    .filter((g) => g.items.length > 0);
}

export function matchesQuery(t: MyDayTask, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return t.code.toLowerCase().includes(s) || t.service.toLowerCase().includes(s) || t.pkg.toLowerCase().includes(s);
}

export function filterFocus(tasks: MyDayTask[], status: 'all' | OrderStatus, q: string): MyDayTask[] {
  return tasks.filter((t) => (status === 'all' || t.status === status) && matchesQuery(t, q));
}
