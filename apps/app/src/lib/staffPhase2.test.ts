import { describe, it, expect } from 'vitest';
import { availabilityMeta, availabilityShort, acceptsWork, AVAILABILITY, type Availability } from './availability';
import { leaveDays, validateLeave, leaveStatusMeta } from './leave';
import { monthGrid, monthOf, monthLabel, WEEKDAYS } from './calendar';
import { myDeliverables, reworkCount, STAFF_NOTIFICATIONS, MY_TASKS, myEarnings, myCustomers } from '@/data/staffMock';
import { rankByComposite } from './staff';
import { STAFF } from '@/data/adminMock';

describe('rankByComposite', () => {
  const team = [{ id: 'a', composite: 90 }, { id: 'b', composite: 80 }, { id: 'c', composite: 70 }];
  it('returns null for empty team or unknown id', () => {
    expect(rankByComposite([], 'a')).toBeNull();
    expect(rankByComposite(team, 'zzz')).toBeNull();
  });
  it('ranks highest composite as #1 and counts who is behind', () => {
    expect(rankByComposite(team, 'a')).toMatchObject({ rank: 1, total: 3, aheadOf: 2 });
    expect(rankByComposite(team, 'c')).toMatchObject({ rank: 3, total: 3, aheadOf: 0 });
  });
  it('keeps rank within bounds and topPercent in 1..100 for real staff', () => {
    const r = rankByComposite(STAFF, 's3');
    expect(r).not.toBeNull();
    expect(r!.rank).toBeLessThanOrEqual(r!.total);
    expect(r!.topPercent).toBeGreaterThanOrEqual(1);
    expect(r!.topPercent).toBeLessThanOrEqual(100);
  });
});

describe('myEarnings (own pay, no customer-pricing leak)', () => {
  const e = myEarnings('s3');
  it('returns the staffer’s own aggregates with take-home = base + gig + commission + bonus', () => {
    expect(e).not.toBeNull();
    expect(typeof e!.base).toBe('number');
    expect(typeof e!.gig).toBe('number');
    expect(typeof e!.commission).toBe('number');
    expect(e!.takeHome).toBe(e!.base + e!.gig + e!.commission + e!.bonus);
  });
  it('NEVER exposes basis or rate (those would reveal customer revenue)', () => {
    expect(Object.keys(e!)).not.toContain('basis');
    expect(Object.keys(e!)).not.toContain('rate');
  });
  it('returns null for an unknown staffer', () => {
    expect(myEarnings('nobody')).toBeNull();
  });
});

describe('myCustomers', () => {
  const cs = myCustomers();
  it('lists active customers with a task count and no money fields', () => {
    expect(Array.isArray(cs)).toBe(true);
    for (const c of cs) {
      expect(c.active).toBeGreaterThanOrEqual(1);
      expect(Object.keys(c)).not.toContain('value');
      expect(Object.keys(c)).not.toContain('price');
    }
  });
  it('is sorted by active task count, descending', () => {
    for (let i = 1; i < cs.length; i++) expect(cs[i - 1].active).toBeGreaterThanOrEqual(cs[i].active);
  });
});

describe('availability', () => {
  it('exposes exactly three states', () => {
    expect(AVAILABILITY).toEqual(['available', 'busy', 'ooo']);
  });
  it('maps each state to a label + icon + color', () => {
    for (const v of AVAILABILITY) {
      const m = availabilityMeta(v);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.icon).toMatch(/^ph-/);
      expect(m.dot).toMatch(/bg-/);
    }
  });
  it('shortens OOO for compact pills', () => {
    expect(availabilityShort('ooo')).toBe('OOO');
    expect(availabilityShort('available')).toBe('Available');
  });
  it('only "available" accepts new routed work', () => {
    expect(acceptsWork('available')).toBe(true);
    expect(acceptsWork('busy')).toBe(false);
    expect(acceptsWork('ooo')).toBe(false);
  });
});

describe('leaveDays', () => {
  it('counts inclusively', () => {
    expect(leaveDays('2026-07-03', '2026-07-07')).toBe(5);
    expect(leaveDays('2026-07-03', '2026-07-03')).toBe(1);
  });
  it('rejects inverted or invalid ranges', () => {
    expect(leaveDays('2026-07-07', '2026-07-03')).toBeNull();
    expect(leaveDays('nope', '2026-07-03')).toBeNull();
  });
});

describe('validateLeave', () => {
  it('requires both dates', () => {
    expect(validateLeave({ from: '', to: '2026-07-07', reason: 'x' })).toMatch(/start and end/i);
  });
  it('requires a non-inverted range', () => {
    expect(validateLeave({ from: '2026-07-07', to: '2026-07-03', reason: 'x' })).toMatch(/on or after/i);
  });
  it('requires a reason', () => {
    expect(validateLeave({ from: '2026-07-03', to: '2026-07-07', reason: '  ' })).toMatch(/reason/i);
  });
  it('passes a valid request', () => {
    expect(validateLeave({ from: '2026-07-03', to: '2026-07-07', reason: 'Trip' })).toBeNull();
  });
});

describe('leaveStatusMeta', () => {
  it('maps statuses to pills', () => {
    expect(leaveStatusMeta('approved').pill).toBe('pill-live');
    expect(leaveStatusMeta('declined').pill).toBe('pill-bad');
    expect(leaveStatusMeta('pending').pill).toBe('pill-warn');
  });
});

describe('calendar grid', () => {
  it('returns a Monday-first 42-cell grid', () => {
    const cells = monthGrid('2026-06', '2026-06-26');
    expect(cells).toHaveLength(42);
    expect(WEEKDAYS[0]).toBe('Mon');
  });
  it('marks the in-month days and today', () => {
    const cells = monthGrid('2026-06', '2026-06-26');
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30); // June has 30 days
    const today = cells.find((c) => c.isToday);
    expect(today?.date).toBe('2026-06-26');
    expect(today?.inMonth).toBe(true);
  });
  it('derives month + human label', () => {
    expect(monthOf('2026-06-28')).toBe('2026-06');
    expect(monthLabel('2026-06')).toBe('June 2026');
  });
});

describe('staff deliverables helpers (no money)', () => {
  it('flattens submissions across the board, newest first', () => {
    const rows = myDeliverables();
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect((rows[i - 1].d.submittedAt ?? '') >= (rows[i].d.submittedAt ?? '')).toBe(true);
    }
  });
  it('counts rework rounds = changes_requested versions', () => {
    // o4 (CNT-1004) had v1 sent back → exactly one rework round.
    expect(reworkCount('o4')).toBe(1);
  });
  it('seeds an unread-bearing notification inbox', () => {
    expect(STAFF_NOTIFICATIONS.some((n) => !n.read)).toBe(true);
    expect(STAFF_NOTIFICATIONS.some((n) => n.read)).toBe(true);
  });
  it('keeps no money keys on staff tasks', () => {
    const t = MY_TASKS[0] as unknown as Record<string, unknown>;
    expect(t).toBeDefined();
    expect('value' in t).toBe(false);
    expect('price' in t).toBe(false);
  });
});
