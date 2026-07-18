import type { Payslip } from '@/lib/staffFinance';
import { summariseEarnings, type MonthEarning, type EarningsSummary } from '@/lib/staff';
import type { StaffEarnings } from './staffMock';

/**
 * Payroll is the single source of truth for staff pay (run_payroll → payroll_runs). getMyStaffWallet
 * already surfaces the real runs as `payslips`, and the Payslips tab renders them — but the finance
 * hero card, the earnings-trend chart and the YTD KPI still read the mock earnings. This maps the SAME
 * real payslips into those shapes so every number on /staff/finance comes from one real source, and the
 * staff wallet stays what it actually is (penalties + payouts), advertising no commission it never mints.
 *
 * commission = total − salary − gig − bonus: the Payslip type drops the column, but `total` carries it.
 * Returns null when there are no runs, so the page keeps the mock for demo / never-paid staffers.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const labelOf = (period: string): string => MONTHS[Number(period.slice(5, 7)) - 1] ?? period;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const commissionOf = (p: Payslip): number => round2(p.total - p.salary - p.gig - p.bonus);

export interface StaffPay {
  earnings: StaffEarnings;
  history: MonthEarning[];
  summary: EarningsSummary;
}

export function payslipsToEarnings(payslips: Payslip[]): StaffPay | null {
  if (payslips.length === 0) return null;

  // payroll_runs arrive newest-first; the chart + summary want oldest-first
  const chrono = [...payslips].reverse();
  const history: MonthEarning[] = chrono.map((p) => ({
    month: p.period,
    label: labelOf(p.period),
    base: p.salary,
    commission: commissionOf(p),
    bonus: p.bonus,
    takeHome: p.total,
    gig: p.gig,
    tasks: 0,          // payroll_runs don't carry a task count
  }));

  const latest = payslips[0]; // newest run = current take-home
  const earnings: StaffEarnings = {
    base: latest.salary,
    gig: latest.gig,
    gigUnits: 0,
    commission: commissionOf(latest),
    bonus: latest.bonus,
    takeHome: latest.total,
    lastPaid: { month: latest.period, amount: latest.total },
  };

  return { earnings, history, summary: summariseEarnings(history) };
}
