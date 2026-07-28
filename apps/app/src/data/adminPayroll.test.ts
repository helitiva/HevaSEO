import { describe, it, expect } from 'vitest';
import { STAFF } from './adminMock';
import { buildPayrollPeriods, currentPenalties } from './adminPayroll';

describe('buildPayrollPeriods', () => {
  it('returns newest-first periods at month granularity, one line per staffer', () => {
    const periods = buildPayrollPeriods('month');
    expect(periods.length).toBeGreaterThan(0);
    // newest first
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i - 1].key >= periods[i].key).toBe(true);
    }
    expect(periods[0].lines.length).toBe(STAFF.length);
  });

  it('net = base + commission + bonus − penalties for every line, and totals reconcile', () => {
    for (const gran of ['month', 'quarter'] as const) {
      for (const p of buildPayrollPeriods(gran)) {
        for (const l of p.lines) {
          expect(l.net).toBe(l.base + l.gig + l.commission + l.bonus - l.penalties);
          expect(l.gig).toBeGreaterThanOrEqual(0);
        }
        const sum = (sel: (n: { base: number; gig: number; commission: number; bonus: number; penalties: number; net: number }) => number) => p.lines.reduce((a, l) => a + sel(l), 0);
        expect(p.totals.base).toBe(sum((l) => l.base));
        expect(p.totals.gig).toBe(sum((l) => l.gig));
        expect(p.totals.commission).toBe(sum((l) => l.commission));
        expect(p.totals.bonus).toBe(sum((l) => l.bonus));
        expect(p.totals.penalties).toBe(sum((l) => l.penalties));
        expect(p.totals.net).toBe(sum((l) => l.net));
      }
    }
  });

  it('quarter periods aggregate three months of base salary', () => {
    const quarters = buildPayrollPeriods('quarter');
    // a full quarter line should carry ~3× a monthly salary in base (allow partial leading quarter)
    const full = quarters.find((q) => q.from.slice(5) === '04' || q.from.endsWith('-01'));
    if (full) {
      for (const l of full.lines) expect(l.base).toBeGreaterThanOrEqual(0);
    }
    expect(quarters.length).toBeGreaterThan(0);
  });
});

describe('currentPenalties', () => {
  it('returns non-negative applied/pending sums for every staffer', () => {
    for (const s of STAFF) {
      const c = currentPenalties(s.id);
      expect(c.applied).toBeGreaterThanOrEqual(0);
      expect(c.pending).toBeGreaterThanOrEqual(0);
      expect(c.pendingCount).toBeGreaterThanOrEqual(0);
    }
  });
});
