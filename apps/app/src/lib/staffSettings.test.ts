import { describe, it, expect } from 'vitest';
import { leaveSummary, workingHoursSummary, LEAVE_ALLOWANCE, type LeaveEntry, type DaySchedule } from './staffSettings';

describe('leaveSummary', () => {
  it('counts approved days as used and pending separately', () => {
    const entries: LeaveEntry[] = [
      { from: '2026-06-30', to: '2026-07-02', status: 'approved' }, // 3 days
      { from: '2026-08-10', to: '2026-08-10', status: 'pending' },  // 1 day
      { from: '2026-09-01', to: '2026-09-05', status: 'declined' }, // ignored
    ];
    const s = leaveSummary(entries);
    expect(s.allowance).toBe(LEAVE_ALLOWANCE);
    expect(s.used).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.remaining).toBe(LEAVE_ALLOWANCE - 3);
  });

  it('never goes negative on remaining', () => {
    const entries: LeaveEntry[] = [{ from: '2026-01-01', to: '2026-12-31', status: 'approved' }];
    expect(leaveSummary(entries, 20).remaining).toBe(0);
  });

  it('empty → full allowance remaining', () => {
    expect(leaveSummary([])).toEqual({ allowance: 20, used: 0, pending: 0, remaining: 20 });
  });
});

describe('workingHoursSummary', () => {
  const week: DaySchedule[] = [
    { on: true, start: '09:00', end: '17:00' },  // 8h
    { on: true, start: '09:00', end: '17:00' },  // 8h
    { on: true, start: '09:00', end: '17:00' },  // 8h
    { on: true, start: '09:00', end: '17:00' },  // 8h
    { on: true, start: '09:00', end: '15:00' },  // 6h
    { on: false, start: '09:00', end: '17:00' },
    { on: false, start: '09:00', end: '17:00' },
  ];
  it('sums working days and weekly hours, skipping days off', () => {
    expect(workingHoursSummary(week)).toEqual({ days: 5, weekly: 38 });
  });
  it('handles an all-off schedule', () => {
    expect(workingHoursSummary(week.map((d) => ({ ...d, on: false })))).toEqual({ days: 0, weekly: 0 });
  });
});
