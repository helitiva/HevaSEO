// Period payroll explorer data for the admin Finance → Payouts tab.
// Lets an admin pick a month or quarter and see, per staffer, how base salary + gig pay + commission
// + bonus stacked up and what penalties were withheld that period — netting to take-home. Built from
// the per-staff monthly earnings series (now generated for the whole team) + the penalty record.
// Mirrors the cycle-comp formula in lib/payOverrides.ts effectivePay (base + gig + commission + bonus).
// Note: the historical mock only models gig for the current cycle, so past months contribute gig = 0.
import { STAFF } from './adminMock';
import { earningsHistory, myPenalties } from './staffMock';

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES_MONTHS = 12; // how far back the explorer reaches

export type PayGran = 'month' | 'quarter';

export interface StaffPayLine {
  staffId: string; staff: string; role: string; active: boolean;
  base: number; gig: number; commission: number; bonus: number;
  penalties: number;      // applied fines withheld this period (positive number)
  net: number;            // base + gig + commission + bonus − penalties
  tasks: number;          // billable tasks completed in the period (commission driver)
}
export interface PayPeriodTotals { base: number; gig: number; commission: number; bonus: number; penalties: number; net: number; tasks: number }
export interface PayPeriod {
  key: string; label: string; from: string; to: string;
  lines: StaffPayLine[];
  totals: PayPeriodTotals;
}

// Applied penalties for a staffer whose createdAt month falls inside the period's month set.
function appliedPenaltiesIn(staffId: string, months: Set<string>): number {
  return myPenalties(staffId)
    .filter((p) => p.status === 'applied' && months.has(p.createdAt.slice(0, 7)))
    .reduce((a, p) => a + p.amount, 0);
}

const sumBy = (lines: StaffPayLine[], sel: (l: StaffPayLine) => number): number => lines.reduce((a, l) => a + sel(l), 0);

// All selectable periods at the given granularity, newest-first.
export function buildPayrollPeriods(gran: PayGran): PayPeriod[] {
  const series = STAFF.map((s) => ({ s, months: earningsHistory(s.id, SERIES_MONTHS) }));
  const axis = series[0]?.months.map((m) => m.month) ?? []; // shared month axis, oldest→newest

  // Group the month axis into periods.
  const groups: { key: string; label: string; months: string[] }[] = [];
  if (gran === 'month') {
    for (const m of axis) {
      const [y, mo] = m.split('-');
      groups.push({ key: m, label: `${MONTH_LABEL[Number(mo) - 1]} ${y}`, months: [m] });
    }
  } else {
    const byQ = new Map<string, string[]>();
    for (const m of axis) {
      const [y, mo] = m.split('-');
      const q = Math.floor((Number(mo) - 1) / 3) + 1;
      const key = `${y}-Q${q}`;
      byQ.set(key, [...(byQ.get(key) ?? []), m]);
    }
    for (const [key, months] of byQ) groups.push({ key, label: key.replace('-', ' '), months });
  }

  const periods = groups.map((g) => {
    const monthSet = new Set(g.months);
    const lines: StaffPayLine[] = series.map(({ s, months }) => {
      const inP = months.filter((m) => monthSet.has(m.month));
      const base = inP.reduce((a, m) => a + m.base, 0);
      const gig = inP.reduce((a, m) => a + (m.gig ?? 0), 0); // 0 for historical months (mock models gig only for the current cycle)
      const commission = inP.reduce((a, m) => a + m.commission, 0);
      const bonus = inP.reduce((a, m) => a + m.bonus, 0);
      const tasks = inP.reduce((a, m) => a + m.tasks, 0);
      const penalties = appliedPenaltiesIn(s.id, monthSet);
      return { staffId: s.id, staff: s.name, role: s.role, active: s.active, base, gig, commission, bonus, penalties, net: base + gig + commission + bonus - penalties, tasks };
    });
    return {
      key: g.key, label: g.label, from: g.months[0], to: g.months[g.months.length - 1], lines,
      totals: {
        base: sumBy(lines, (l) => l.base), gig: sumBy(lines, (l) => l.gig),
        commission: sumBy(lines, (l) => l.commission),
        bonus: sumBy(lines, (l) => l.bonus), penalties: sumBy(lines, (l) => l.penalties),
        net: sumBy(lines, (l) => l.net), tasks: sumBy(lines, (l) => l.tasks),
      },
    };
  });

  return periods.reverse(); // newest period first
}

// Penalty snapshot for one staffer in the CURRENT run (the live editable payout cycle = this month).
export interface CurrentPenalty { applied: number; pending: number; pendingCount: number }
export function currentPenalties(staffId: string, month = '2026-06'): CurrentPenalty {
  const items = myPenalties(staffId).filter((p) => p.createdAt.slice(0, 7) === month);
  const sum = (st: string) => items.filter((p) => p.status === st).reduce((a, p) => a + p.amount, 0);
  return { applied: sum('applied'), pending: sum('pending'), pendingCount: items.filter((p) => p.status === 'pending').length };
}
