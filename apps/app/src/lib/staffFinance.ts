// Staff Finance — pure types + math for the wallet / penalties / payout-request surface.
// Lives in lib (no data) so it can be unit-tested in isolation, mirroring lib/staff.ts.
// Money-leak invariant: amounts here are concrete commission-derived USD figures. Nothing in
// this module references a customer order's value, the payout `basis`, or the commission `rate`,
// so a fine can never be reverse-engineered back into the price a customer paid.

// ---- Penalties ----
export type PenaltyType = 'revision' | 'late' | 'rating' | 'manual';
export type PenaltySizing = 'pct' | 'flat' | 'progressive';
export type PenaltyStatus = 'pending' | 'applied' | 'waived' | 'disputed';

export interface StaffPenalty {
  id: string;
  type: PenaltyType;
  taskCode: string | null;   // the task it's tied to (null for a manual, task-less penalty)
  reason: string;            // what tripped it, in plain words
  sizing: PenaltySizing;     // how the amount was derived
  amount: number;            // concrete USD debit (positive number; subtracted from the wallet)
  detail: string;            // human label of the sizing, e.g. "25% of task commission"
  status: PenaltyStatus;
  createdAt: string;         // YYYY-MM-DD
  by: string;                // the rule that flagged it, or the manager who applied it
  disputeNote?: string;      // staff's note when contesting
}

// Auto-flagging rules shown in the Penalties tab so staff understand the system.
export interface PenaltyRule {
  type: PenaltyType;
  label: string;
  threshold: string;   // human-readable trigger, e.g. "> 2 revision rounds"
  sizing: PenaltySizing;
  value: number;       // pct (0–100) or flat USD, by sizing
  enabled: boolean;
}

// ---- Payouts ----
export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected';
export type PayoutMethodKind = 'bank' | 'paypal' | 'wise';

export interface PayoutMethod {
  id: string;
  kind: PayoutMethodKind;
  label: string;     // masked, e.g. "Vietcombank ••4821"
  isDefault: boolean;
  feePct: number;    // withdrawal fee, % of amount
  etaDays: number;   // expected days to land
}

export interface PayoutRequest {
  id: string;
  amount: number;        // requested USD (positive; subtracted from the wallet)
  methodId: string;
  status: PayoutStatus;
  requestedAt: string;   // YYYY-MM-DD
  note?: string;
}

// ---- Payslip (a posted payroll run: fixed pay for one period) ----
export interface Payslip {
  id: string;
  period: string;        // YYYY-MM
  salary: number;
  gig: number;
  bonus: number;
  total: number;
}

// ---- Wallet ledger (unified activity feed) ----
export type WalletEntryKind = 'commission' | 'bonus' | 'penalty' | 'payout';
export interface WalletEntry {
  id: string;
  kind: WalletEntryKind;
  label: string;
  taskCode: string | null;
  at: string;            // YYYY-MM-DD
  amount: number;        // signed: + credit, − debit
  pending?: boolean;     // commission still in its clearing window (not yet withdrawable)
}

// ---- Display meta ----
export const PENALTY_TYPE_META: Record<PenaltyType, { label: string; icon: string; blurb: string }> = {
  revision: { label: 'Excess revisions', icon: 'ph-arrows-counter-clockwise', blurb: 'More revision rounds than the free allowance.' },
  late: { label: 'Late delivery', icon: 'ph-clock-countdown', blurb: 'Submitted after the deadline.' },
  rating: { label: 'Low rating', icon: 'ph-star-half', blurb: 'QA or customer rating below the quality bar.' },
  manual: { label: 'Manual penalty', icon: 'ph-gavel', blurb: 'Applied by a manager, with a reason.' },
};
export const PENALTY_STATUS_META: Record<PenaltyStatus, { label: string; pill: string }> = {
  pending: { label: 'Pending review', pill: 'pill-warn' },
  applied: { label: 'Applied', pill: 'pill-bad' },
  waived: { label: 'Waived', pill: 'pill-live' },
  disputed: { label: 'Disputed', pill: 'pill-good' },
};
export const PAYOUT_STATUS_META: Record<PayoutStatus, { label: string; pill: string }> = {
  requested: { label: 'Requested', pill: 'pill-warn' },
  approved: { label: 'Approved', pill: 'pill-good' },
  paid: { label: 'Paid', pill: 'pill-live' },
  rejected: { label: 'Rejected', pill: 'pill-bad' },
};
export const PAYOUT_METHOD_META: Record<PayoutMethodKind, { label: string; icon: string }> = {
  bank: { label: 'Bank transfer', icon: 'ph-bank' },
  paypal: { label: 'PayPal', icon: 'ph-paypal-logo' },
  wise: { label: 'Wise', icon: 'ph-globe-hemisphere-west' },
};
// Default fee/ETA per method kind — applied when a staffer adds a new method.
export const METHOD_DEFAULTS: Record<PayoutMethodKind, { feePct: number; etaDays: number }> = {
  bank: { feePct: 0, etaDays: 2 },
  paypal: { feePct: 2, etaDays: 1 },
  wise: { feePct: 1, etaDays: 1 },
};

// Masking — we keep only a masked label on a method, never the full account number/email.
export function maskTail(value: string, keep = 4): string {
  const digits = value.replace(/[\s-]+/g, '');
  return digits.length <= keep ? `••${digits}` : `••${digits.slice(-keep)}`;
}
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const head = local.slice(0, Math.min(3, local.length));
  return `${head}•••${email.slice(at)}`;
}
export const WALLET_KIND_META: Record<WalletEntryKind, { label: string; icon: string }> = {
  commission: { label: 'Commission', icon: 'ph-plus-circle' },
  bonus: { label: 'Bonus', icon: 'ph-gift' },
  penalty: { label: 'Penalty', icon: 'ph-minus-circle' },
  payout: { label: 'Payout', icon: 'ph-hand-coins' },
};

// ---- Pure math ----
// Only `applied` penalties and non-`rejected` payouts move the balance; `pending`/`disputed`
// fines and `rejected` requests are visible but do not debit the wallet.
export function appliedPenaltyTotal(penalties: StaffPenalty[]): number {
  return penalties.filter((p) => p.status === 'applied').reduce((a, p) => a + p.amount, 0);
}
export function committedPayoutTotal(payouts: PayoutRequest[]): number {
  return payouts.filter((p) => p.status !== 'rejected').reduce((a, p) => a + p.amount, 0);
}
export function creditTotal(credits: WalletEntry[]): number {
  return credits.reduce((a, e) => a + e.amount, 0);
}
// Money still clearing — recent commission not yet withdrawable.
export function clearingTotal(credits: WalletEntry[]): number {
  return credits.filter((e) => e.pending).reduce((a, e) => a + e.amount, 0);
}

// Full wallet balance (earned − applied fines − committed payouts), clearing money included.
export function walletBalance(credits: WalletEntry[], penalties: StaffPenalty[], payouts: PayoutRequest[]): number {
  return creditTotal(credits) - appliedPenaltyTotal(penalties) - committedPayoutTotal(payouts);
}
// What the staffer can actually request right now (balance minus still-clearing money).
export function availableToWithdraw(credits: WalletEntry[], penalties: StaffPenalty[], payouts: PayoutRequest[]): number {
  return Math.max(0, walletBalance(credits, penalties, payouts) - clearingTotal(credits));
}

export function pendingPenaltyCount(penalties: StaffPenalty[]): number {
  return penalties.filter((p) => p.status === 'pending').length;
}

// Merge credits + applied/waived penalties + committed payouts into one newest-first ledger.
export function buildLedger(credits: WalletEntry[], penalties: StaffPenalty[], payouts: PayoutRequest[]): WalletEntry[] {
  const penaltyRows: WalletEntry[] = penalties
    .filter((p) => p.status === 'applied')
    .map((p) => ({ id: `pen-${p.id}`, kind: 'penalty', label: `${PENALTY_TYPE_META[p.type].label} fine`, taskCode: p.taskCode, at: p.createdAt, amount: -p.amount }));
  const payoutRows: WalletEntry[] = payouts
    .filter((p) => p.status !== 'rejected')
    .map((p) => ({ id: `pay-${p.id}`, kind: 'payout', label: 'Payout', taskCode: null, at: p.requestedAt, amount: -p.amount }));
  return [...credits, ...penaltyRows, ...payoutRows].sort((a, b) => b.at.localeCompare(a.at));
}

// Withdrawal fee for an amount on a method.
export function withdrawalFee(amount: number, method: PayoutMethod | undefined): number {
  if (!method) return 0;
  return Math.round((amount * method.feePct) / 100);
}

// ---- Penalty summary (the "what & why" roll-up shown atop the Penalties tab) ----
export interface PenaltyTypeStat { type: PenaltyType; count: number; amount: number }
export interface PenaltySummary {
  total: number;                 // all penalties on record
  applied: number; pending: number; waived: number; disputed: number;  // counts by status
  appliedTotal: number;          // $ actually debited
  pendingTotal: number;          // $ flagged but not yet confirmed
  monthTotal: number;            // $ applied this month
  byType: PenaltyTypeStat[];     // count + applied $ per type, busiest first
}
export function summarisePenalties(penalties: StaffPenalty[], month: string): PenaltySummary {
  const byStatus = (s: PenaltyStatus) => penalties.filter((p) => p.status === s);
  const sum = (list: StaffPenalty[]) => list.reduce((a, p) => a + p.amount, 0);
  const applied = byStatus('applied');
  const types: PenaltyType[] = ['revision', 'late', 'rating', 'manual'];
  const byType: PenaltyTypeStat[] = types
    .map((type) => {
      const rows = penalties.filter((p) => p.type === type);
      return { type, count: rows.length, amount: sum(rows.filter((p) => p.status === 'applied')) };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
  return {
    total: penalties.length,
    applied: applied.length,
    pending: byStatus('pending').length,
    waived: byStatus('waived').length,
    disputed: byStatus('disputed').length,
    appliedTotal: sum(applied),
    pendingTotal: sum(byStatus('pending')),
    monthTotal: sum(applied.filter((p) => p.createdAt.slice(0, 7) === month)),
    byType,
  };
}
