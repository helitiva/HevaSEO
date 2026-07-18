import { describe, it, expect } from 'vitest';
import {
  computePayrollPreview,
  type OrderRow, type ProfileRow, type CompRow, type PodRow, type RunRow,
} from './adminComp';

/**
 * The payroll accrual brain (what getPayrollPreview settles) had no test. Every figure below is
 * hand-computed from the fixture, and the twin — 0850_fn_set_staff_comp + the E2E in
 * 08-revenue-payroll — pins the same numbers on the live DB.
 */

const PERIOD = '2026-07';
const S1 = 's1', S2 = 's2', M1 = 'm1';

const profiles: ProfileRow[] = [
  { id: S1, name: 'Staff One', role: 'staff' },
  { id: S2, name: 'Staff Two', role: 'staff' },
  { id: M1, name: 'Manager', role: 'manager' },
];
// S1 & S2 are both in M1's pod
const pods: PodRow[] = [
  { profile_id: S1, manager_id: M1 },
  { profile_id: S2, manager_id: M1 },
];
const comps: CompRow[] = [
  { profile_id: S1, base_salary: 1000, commission_pct: 10 },
  { profile_id: M1, base_salary: 2000, commission_pct: 5 },
  // S2 deliberately has NO comp row → unconfigured
];
const del = (assignee: string, value: number, on: string | null, state = 'delivered'): OrderRow =>
  ({ assignee_id: assignee, value, delivered_at: on, state });

// S1 earned 300 + 200 in July; the other three rows are traps that must NOT count.
const orders: OrderRow[] = [
  del(S1, 300, '2026-07-05T00:00:00Z'),
  del(S1, 200, '2026-07-10T00:00:00Z', 'completed'),
  del(S2, 400, '2026-07-12T00:00:00Z', 'approved'),
  del(S1, 999, '2026-06-30T00:00:00Z'),                // wrong month
  del(S1, 500, null, 'new'),                           // never delivered
  del(S1, 100, '2026-07-15T00:00:00Z', 'internal_review'), // delivered_at set but not a recognized state
];

const preview = (runs: RunRow[] = []) => computePayrollPreview(PERIOD, orders, profiles, comps, pods, runs);
const lineFor = (id: string) => preview().lines.find((l) => l.profileId === id)!;

describe('computePayrollPreview — ASC 606 accrual', () => {
  it('a staffer accrues commission = basis × pct% over their OWN delivered orders this period', () => {
    const s1 = lineFor(S1);
    expect(s1.basis).toBe(500);          // 300 + 200; the 999/500/100 rows are excluded
    expect(s1.orders).toBe(2);
    expect(s1.commission).toBe(50);      // 500 × 10%
    expect(s1.total).toBe(1050);         // base 1000 + 50
  });

  it('excludes undelivered, wrong-month, and non-recognized orders from basis', () => {
    // if any trap leaked in, basis would be 500+999 or +500 or +100 — pin it to exactly the two real ones
    expect(lineFor(S1).basis).toBe(500);
  });

  it('a manager accrues on their whole pod’s delivered value', () => {
    const m1 = lineFor(M1);
    expect(m1.basis).toBe(900);          // S1's 300+200 + S2's 400
    expect(m1.commission).toBe(45);      // 900 × 5%
    expect(m1.total).toBe(2045);         // base 2000 + 45
  });

  it('totals.basis counts STAFF only — summing the manager’s basis too would double-count pod value', () => {
    expect(preview().totals.basis).toBe(900); // S1 500 + S2 400, NOT + M1's 900
  });

  it('outstanding = accrued − paid', () => {
    const p = preview([{ staff_id: S1, total: 400 }]);
    const s1 = p.lines.find((l) => l.profileId === S1)!;
    expect(s1.paid).toBe(400);
    expect(s1.outstanding).toBe(650);    // 1050 − 400
  });

  it('outstanding never goes negative when a manual run over-pays the accrual', () => {
    // the guard: an over-payment is a thing to notice, not a credit that silently cancels other pay
    const p = preview([{ staff_id: S1, total: 5000 }]);
    const s1 = p.lines.find((l) => l.profileId === S1)!;
    expect(s1.outstanding).toBe(0);      // max(0, 1050 − 5000), not −3950
  });

  it('sums multiple payroll_runs rows for the same worker', () => {
    const p = preview([{ staff_id: S1, total: 600 }, { staff_id: S1, total: 450 }]);
    const s1 = p.lines.find((l) => l.profileId === S1)!;
    expect(s1.paid).toBe(1050);
    expect(s1.outstanding).toBe(0);
  });

  it('a worker with no staff_comp row is unconfigured and accrues nothing', () => {
    const s2 = lineFor(S2);
    expect(s2.configured).toBe(false);
    expect(s2.baseSalary).toBe(0);
    expect(s2.commission).toBe(0);       // basis 400 but 0% and no base → 0 pay
    expect(s2.total).toBe(0);
  });

  it('totals sum the lines', () => {
    const t = preview().totals;
    expect(t.base).toBe(3000);           // 1000 + 0 + 2000
    expect(t.commission).toBe(95);       // 50 + 0 + 45
    expect(t.total).toBe(3095);          // 1050 + 0 + 2045
    expect(t.outstanding).toBe(3095);    // nothing paid yet
  });

  it('keeps money at cent precision (fractional rate)', () => {
    const p = computePayrollPreview(
      PERIOD,
      [del('x', 333.33, '2026-07-01T00:00:00Z')],
      [{ id: 'x', name: 'X', role: 'staff' }],
      [{ profile_id: 'x', base_salary: 0, commission_pct: 7.5 }],
      [], [],
    );
    expect(p.lines[0].commission).toBe(25);   // 333.33 × 7.5% = 24.99975 → 25.00
  });
});
