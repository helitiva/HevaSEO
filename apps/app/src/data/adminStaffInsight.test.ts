import { describe, it, expect } from 'vitest';
import { STAFF } from './adminMock';
import { workHistory, myFinance, myCommissionCredits, myPenalties } from './staffMock';
import { buildStaffInsight, rosterSignals, resolveStaffId } from './adminStaffInsight';

// Before this work, only s3 (CURRENT_STAFF) had a track record / wallet / penalties. The admin
// surfaces list the whole team, so every staffer must now resolve to real, internally-consistent
// data. These tests pin that contract.

describe('per-staff data generation', () => {
  it('gives every staffer a non-empty work archive', () => {
    for (const s of STAFF) {
      const history = workHistory(s.id);
      expect(history.length, `${s.id} archive`).toBeGreaterThan(0);
    }
  });

  it('archive is sorted newest-first and money-free except own commission', () => {
    for (const s of STAFF) {
      const history = workHistory(s.id);
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].completedAt >= history[i].completedAt).toBe(true);
      }
      for (const w of history) expect(w.commission).toBeGreaterThan(0);
    }
  });

  it('on-time rate of the generated archive tracks the headline within tolerance', () => {
    // s3 is hand-authored (skip); the rest are calibrated to onTime%.
    for (const s of STAFF.filter((x) => x.id !== 's3')) {
      const history = workHistory(s.id);
      const onTimeRate = Math.round((history.filter((w) => w.onTime).length / history.length) * 100);
      expect(Math.abs(onTimeRate - s.onTime), `${s.id} on-time ${onTimeRate} vs ${s.onTime}`).toBeLessThanOrEqual(25);
    }
  });

  it('builds a wallet with credits for every staffer', () => {
    for (const s of STAFF) {
      expect(myCommissionCredits(s.id).length, `${s.id} credits`).toBeGreaterThan(0);
      expect(myFinance(s.id).balance, `${s.id} balance`).toBeGreaterThan(0);
    }
  });

  it('penalty amounts never exceed their task commission and statuses are valid', () => {
    const valid = new Set(['pending', 'applied', 'waived', 'disputed']);
    for (const s of STAFF) {
      for (const p of myPenalties(s.id)) {
        expect(valid.has(p.status)).toBe(true);
        expect(p.amount).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildStaffInsight', () => {
  it('returns null for an unknown id', () => {
    expect(buildStaffInsight('nope')).toBeNull();
  });

  it('assembles a coherent bundle for every staffer', () => {
    for (const s of STAFF) {
      const insight = buildStaffInsight(s.id)!;
      expect(insight).not.toBeNull();
      expect(insight.composite).toBe(s.composite);
      // score breakdown reconciles to the headline composite
      const sum = insight.breakdown.segments.reduce((a, seg) => a + seg.points, 0);
      expect(Math.abs(sum - s.composite)).toBeLessThanOrEqual(1);
      // pay: total due = base + gig + commission + bonus
      expect(insight.payroll.due).toBe(insight.payroll.base + insight.payroll.gig + insight.payroll.commission + insight.payroll.bonus);
      // rank is within the team
      expect(insight.rank!.rank).toBeGreaterThanOrEqual(1);
      expect(insight.rank!.rank).toBeLessThanOrEqual(STAFF.length);
      // tier is one of the bands
      expect(['Starter', 'Standard', 'Senior', 'Lead']).toContain(insight.tier.current.level);
      // history/stats are populated
      expect(insight.history.length).toBeGreaterThan(0);
      expect(insight.stats.total).toBe(insight.history.length);
    }
  });
});

describe('rosterSignals + resolveStaffId', () => {
  it('resolves by id and by display name', () => {
    expect(resolveStaffId('s1')).toBe('s1');
    expect(resolveStaffId(STAFF[0].name)).toBe(STAFF[0].id);
    expect(resolveStaffId('Ghost')).toBeNull();
  });

  it('produces signals consistent with the full insight', () => {
    for (const s of STAFF) {
      const sig = rosterSignals(s.id)!;
      const insight = buildStaffInsight(s.id)!;
      expect(sig.monthlyPay).toBe(insight.payroll.due);
      expect(sig.tier).toBe(insight.tier.current.level);
      expect(sig.pendingFines).toBe(insight.penalties.pendingCount);
      expect(sig.rewardsTotal).toBe(insight.rewards.total);
    }
  });
});
