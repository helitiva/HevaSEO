import { describe, it, expect } from 'vitest';
import {
  allManagerPerf, buildManagerPerf, companyBenchmark, MGR_SCORE_MODEL,
} from './managerPerf';

describe('managerPerf — Manager Score model', () => {
  it('lever weights sum to 1', () => {
    const total = MGR_SCORE_MODEL.reduce((s, t) => s + t.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('scores every seeded manager with a 0–100 composite', () => {
    const perfs = allManagerPerf();
    expect(perfs.length).toBeGreaterThan(0);
    for (const p of perfs) {
      expect(p.composite).toBeGreaterThanOrEqual(0);
      expect(p.composite).toBeLessThanOrEqual(100);
    }
  });

  it('every lever scores 0–100 and exposes all five model levers', () => {
    for (const p of allManagerPerf()) {
      expect(p.levers.map((l) => l.key).sort()).toEqual(
        MGR_SCORE_MODEL.map((t) => t.key).sort(),
      );
      for (const l of p.levers) {
        expect(l.score).toBeGreaterThanOrEqual(0);
        expect(l.score).toBeLessThanOrEqual(100);
        expect(l.action.length).toBeGreaterThan(0);
      }
    }
  });

  it('reconciles weighted lever points to the composite headline', () => {
    for (const p of allManagerPerf()) {
      const sum = p.levers.reduce((s, l) => s + l.points, 0);
      // Points are reconciled to sum to the composite (allow rounding slack).
      expect(Math.abs(sum - p.composite)).toBeLessThanOrEqual(1.0);
    }
  });

  it('weakest lever is the one with the most composite headroom (or null at goal)', () => {
    for (const p of allManagerPerf()) {
      if (p.weakest === null) {
        expect(p.levers.every((l) => l.headroom === 0)).toBe(true);
      } else {
        const maxHeadroom = Math.max(...p.levers.map((l) => l.headroom));
        expect(p.weakest.headroom).toBe(maxHeadroom);
        expect(p.weakest.headroom).toBeGreaterThan(0);
      }
    }
  });

  it('ranks managers and ends each trend on the current composite', () => {
    const perfs = allManagerPerf();
    for (const p of perfs) {
      expect(p.rank?.total).toBe(perfs.length);
      expect(p.trend).toHaveLength(8);
      expect(p.trend[p.trend.length - 1]).toBe(p.composite);
      expect(p.trend.every((v) => v >= 0 && v <= 100)).toBe(true);
    }
  });

  it('exposes sane operating stats', () => {
    for (const p of allManagerPerf()) {
      expect(p.stats.teamSize).toBeGreaterThanOrEqual(p.stats.activeCount);
      expect(p.stats.firstPassRate).toBeGreaterThanOrEqual(0);
      expect(p.stats.firstPassRate).toBeLessThanOrEqual(100);
      expect(p.stats.util).toBeGreaterThanOrEqual(0);
      expect(p.stats.reviewTurnaroundDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds a single manager and returns null for an unknown id', () => {
    expect(buildManagerPerf('mgr1')).not.toBeNull();
    expect(buildManagerPerf('nope')).toBeNull();
  });

  it('summarizes an anonymized company benchmark', () => {
    const b = companyBenchmark();
    expect(b.pods).toBe(allManagerPerf().length);
    expect(b.avgComposite).toBeGreaterThanOrEqual(0);
    expect(b.avgComposite).toBeLessThanOrEqual(100);
    for (const t of MGR_SCORE_MODEL) {
      expect(b.avgByLever[t.key]).toBeGreaterThanOrEqual(0);
      expect(b.avgByLever[t.key]).toBeLessThanOrEqual(100);
    }
  });
});
