import { describe, it, expect } from 'vitest';
import { primaryActionFor, applyAction, undoAction, deriveKpis, type MyDayState, type MyDayTask } from './myDay';

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
