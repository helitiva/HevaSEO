// Manager personal finance — the manager's OWN compensation only. A manager is paid a fixed salary
// plus an OVERRIDE on what their pod's STAFF earn: a % of the pod's gig pay + a % of the pod's
// commission (see MANAGER_PAYOUTS in adminMock). They have NO KPI/delivery bonus (that's a staff
// mechanism) and stay money-blind to customer/order value and to other people's pay. Mirrors
// /staff/finance and reuses its money-leak-safe pure helpers.

import type { StaffEarnings, StaffFinance } from './staffMock';
import { MANAGER_PAYOUTS } from './adminMock';
import { summariseEarnings, type MonthEarning, type EarningsSummary } from '@/lib/staff';
import {
  walletBalance, availableToWithdraw, clearingTotal, pendingPenaltyCount,
  type WalletEntry, type PayoutMethod, type PayoutRequest, type PenaltyRule,
} from '@/lib/staffFinance';

// Resolve the manager payout row (salary + pod-override commission) for a manager id.
function mp(mid: string) {
  return MANAGER_PAYOUTS.find((m) => m.managerId === mid) ?? MANAGER_PAYOUTS[0] ?? null;
}

// Monthly take-home series: salary is flat, the pod-override commission ramps toward the current month.
const MONTH_FACTORS: { month: string; label: string; f: number }[] = [
  { month: '2026-01', label: 'Jan', f: 0.70 },
  { month: '2026-02', label: 'Feb', f: 0.78 },
  { month: '2026-03', label: 'Mar', f: 0.85 },
  { month: '2026-04', label: 'Apr', f: 0.90 },
  { month: '2026-05', label: 'May', f: 0.95 },
  { month: '2026-06', label: 'Jun', f: 1.00 },
];

export function managerEarnings(mid: string): StaffEarnings | null {
  const m = mp(mid);
  if (!m) return null;
  // Managers earn no gig pay or KPI bonus of their own; their "commission" IS the pod override.
  return {
    base: m.base, gig: 0, gigUnits: 0, commission: m.commission, bonus: 0,
    takeHome: m.base + m.commission,
    lastPaid: { month: 'May', amount: m.base + Math.round(m.commission * 0.95) },
  };
}

export function managerEarningsHistory(mid: string): MonthEarning[] {
  const m = mp(mid);
  if (!m) return [];
  return MONTH_FACTORS.map(({ month, label, f }) => {
    const commission = Math.round(m.commission * f);
    return { month, label, base: m.base, commission, bonus: 0, takeHome: m.base + commission, gig: 0, tasks: 0 };
  });
}

export function managerEarningsSummary(mid: string): EarningsSummary {
  return summariseEarnings(managerEarningsHistory(mid));
}

// Wallet ledger: the manager's pod-override commission ACCRUES here each cycle (their salary is paid
// automatically and is not part of the wallet). Positive entries only; the newest is still clearing.
// Kept consistent with the per-cycle override so the available balance and "Request payout" make sense.
function managerCredits(mid: string): WalletEntry[] {
  const m = mp(mid);
  const comm = m?.commission ?? 0; // current-cycle pod override
  return MONTH_FACTORS.map((mf, i) => {
    const isLatest = i === MONTH_FACTORS.length - 1;
    return {
      id: `mgc${i + 1}`,
      kind: 'commission' as const,
      label: `Pod override — ${mf.label} (gig + commission)`,
      taskCode: null,
      at: `${mf.month}-18`,
      amount: Math.max(1, Math.round(comm * mf.f)),
      pending: isLatest, // newest cycle still in its clearing window
    };
  });
}

const METHODS: PayoutMethod[] = [
  { id: 'mm1', kind: 'bank', label: 'Vietcombank ••4821', isDefault: true, feePct: 1, etaDays: 2 },
];

// No outstanding payout requests yet — the override has been accruing in the wallet.
const PAYOUTS: PayoutRequest[] = [];

// Managers carry no penalties (penalties are a delivery-staff mechanism).
const RULES: PenaltyRule[] = [];

export function managerFinance(mid: string): StaffFinance {
  const credits = managerCredits(mid);
  return {
    credits, penalties: [], methods: METHODS, payouts: PAYOUTS, rules: RULES,
    balance: walletBalance(credits, [], PAYOUTS),
    available: availableToWithdraw(credits, [], PAYOUTS),
    clearing: clearingTotal(credits),
    pendingFines: pendingPenaltyCount([]),
  };
}
