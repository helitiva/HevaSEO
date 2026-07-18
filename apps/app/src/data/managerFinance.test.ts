import { describe, it, expect } from 'vitest';
import { MANAGER_PAYOUTS } from './adminMock';
import { managerEarnings, managerEarningsHistory } from './managerFinance';

/**
 * A manager's pay is structurally unlike a staffer's: salary + an OVERRIDE on the pod's earnings, and
 * NOTHING else — no gig pay, no KPI bonus. Those two facts are easy to break in a refactor that reuses
 * the staff finance shapes, so pin them. The override FORMULA itself (10%·gig + 15%·commission) lives in
 * adminMock and is mirrored on the SQL side by post_staff_pay (pgTAP 0220); here we pin that the mock
 * satisfies it and that managerFinance consumes it without inventing gig/bonus.
 */

describe('manager pod-override pay', () => {
  it('every payout = round(podGig × gigPct + podCommission × commPct) — the two-rate override', () => {
    expect(MANAGER_PAYOUTS.length).toBeGreaterThan(0);
    for (const m of MANAGER_PAYOUTS) {
      expect(m.commission).toBe(Math.round(m.podGig * m.gigPct + m.podCommission * m.commPct));
      expect(m.due).toBe(m.base + m.commission);
    }
  });

  it('a manager earns NO gig and NO bonus of their own — their commission IS the pod override', () => {
    const mid = MANAGER_PAYOUTS[0].managerId;
    const e = managerEarnings(mid)!;
    expect(e.gig).toBe(0);
    expect(e.gigUnits).toBe(0);
    expect(e.bonus).toBe(0);
    expect(e.commission).toBe(MANAGER_PAYOUTS[0].commission);
  });

  it('take-home is exactly base + override commission (not base + gig + commission + bonus)', () => {
    const m = MANAGER_PAYOUTS[0];
    expect(managerEarnings(m.managerId)!.takeHome).toBe(m.base + m.commission);
  });

  it('the monthly history keeps salary flat, gig/bonus zero, and ends at the full current override', () => {
    const m = MANAGER_PAYOUTS[0];
    const hist = managerEarningsHistory(m.managerId);
    expect(hist.length).toBeGreaterThan(0);
    for (const row of hist) {
      expect(row.base).toBe(m.base);
      expect(row.gig).toBe(0);
      expect(row.bonus).toBe(0);
      expect(row.takeHome).toBe(row.base + row.commission);
    }
    // the last month (factor 1.0) is the full current-cycle override
    expect(hist[hist.length - 1].commission).toBe(m.commission);
    // commission ramps up, never exceeding the current cycle
    for (const row of hist) expect(row.commission).toBeLessThanOrEqual(m.commission);
  });
});
