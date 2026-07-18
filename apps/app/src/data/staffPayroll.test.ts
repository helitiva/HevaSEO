import { describe, it, expect } from 'vitest';
import { payslipsToEarnings } from './staffPayroll';
import type { Payslip } from '@/lib/staffFinance';

const slip = (period: string, salary: number, gig: number, bonus: number, total: number): Payslip =>
  ({ id: period, period, salary, gig, bonus, total });

// as getMyStaffWallet returns them: newest period first
const payslips: Payslip[] = [
  slip('2026-07', 1000, 0, 0, 1120),   // commission = 120
  slip('2026-06', 1000, 50, 100, 1200), // commission = 50
  slip('2026-05', 1000, 0, 0, 1000),   // commission = 0
];

describe('payslipsToEarnings — staff pay from real payroll runs', () => {
  it('returns null when there are no runs (keeps the mock for never-paid staffers)', () => {
    expect(payslipsToEarnings([])).toBeNull();
  });

  it('derives commission as total − salary − gig − bonus', () => {
    const { history } = payslipsToEarnings(payslips)!;
    // history is chronological (oldest first): May, Jun, Jul
    expect(history.map((h) => h.commission)).toEqual([0, 50, 120]);
  });

  it('orders history oldest-first for the chart, regardless of input order', () => {
    const { history } = payslipsToEarnings(payslips)!;
    expect(history.map((h) => h.month)).toEqual(['2026-05', '2026-06', '2026-07']);
    expect(history.map((h) => h.label)).toEqual(['May', 'Jun', 'Jul']);
  });

  it('takes current earnings from the LATEST run, not the first array element by accident', () => {
    const e = payslipsToEarnings(payslips)!.earnings;
    expect(e.takeHome).toBe(1120);        // July's total
    expect(e.base).toBe(1000);
    expect(e.commission).toBe(120);
    expect(e.bonus).toBe(0);
    expect(e.lastPaid).toEqual({ month: '2026-07', amount: 1120 });
  });

  it('carries salary/gig/bonus/take-home straight through from the run', () => {
    const jun = payslipsToEarnings(payslips)!.history.find((h) => h.month === '2026-06')!;
    expect(jun).toMatchObject({ base: 1000, gig: 50, bonus: 100, takeHome: 1200, commission: 50 });
  });

  it('summarises YTD as the sum of take-home across runs', () => {
    const { summary } = payslipsToEarnings(payslips)!;
    expect(summary.ytd).toBe(1120 + 1200 + 1000);
  });

  it('keeps commission at cent precision', () => {
    const { earnings } = payslipsToEarnings([slip('2026-07', 1000, 0, 0, 1024.99)])!;
    expect(earnings.commission).toBe(24.99);
  });
});
