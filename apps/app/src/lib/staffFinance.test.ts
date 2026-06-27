import { describe, it, expect } from 'vitest';
import {
  walletBalance, availableToWithdraw, clearingTotal, pendingPenaltyCount,
  appliedPenaltyTotal, committedPayoutTotal, buildLedger, withdrawalFee, summarisePenalties,
  maskTail, maskEmail,
  type WalletEntry, type StaffPenalty, type PayoutRequest, type PayoutMethod,
} from './staffFinance';
import { myFinance, myCommissionCredits, myPenalties, myPayouts } from '@/data/staffMock';

const credits: WalletEntry[] = [
  { id: 'c1', kind: 'commission', label: 'A', taskCode: 'T-1', at: '2026-06-10', amount: 100 },
  { id: 'c2', kind: 'commission', label: 'B', taskCode: 'T-2', at: '2026-06-25', amount: 40, pending: true },
  { id: 'c3', kind: 'bonus', label: 'Bonus', taskCode: null, at: '2026-06-20', amount: 60 },
];
const penalties: StaffPenalty[] = [
  { id: 'p1', type: 'late', taskCode: 'T-1', reason: 'late', sizing: 'flat', amount: 25, detail: '', status: 'applied', createdAt: '2026-06-11', by: 'rule' },
  { id: 'p2', type: 'revision', taskCode: 'T-2', reason: 'rev', sizing: 'pct', amount: 18, detail: '', status: 'pending', createdAt: '2026-06-12', by: 'rule' },
  { id: 'p3', type: 'rating', taskCode: 'T-3', reason: 'low', sizing: 'flat', amount: 15, detail: '', status: 'disputed', createdAt: '2026-06-13', by: 'rule' },
];
const payouts: PayoutRequest[] = [
  { id: 'o1', amount: 50, methodId: 'm1', status: 'paid', requestedAt: '2026-06-05' },
  { id: 'o2', amount: 30, methodId: 'm1', status: 'rejected', requestedAt: '2026-06-06' },
];

describe('wallet balance math', () => {
  it('balance = credits − applied penalties − non-rejected payouts', () => {
    // 200 credits − 25 applied − 50 committed = 125 (pending/disputed fines + rejected payout ignored)
    expect(creditSum()).toBe(200);
    expect(appliedPenaltyTotal(penalties)).toBe(25);
    expect(committedPayoutTotal(payouts)).toBe(50);
    expect(walletBalance(credits, penalties, payouts)).toBe(125);
  });

  it('available excludes still-clearing commission', () => {
    expect(clearingTotal(credits)).toBe(40);
    expect(availableToWithdraw(credits, penalties, payouts)).toBe(125 - 40);
  });

  it('pending and disputed penalties never move the balance', () => {
    const noFines = penalties.map((p) => ({ ...p, status: 'pending' as const }));
    expect(walletBalance(credits, noFines, payouts)).toBe(200 - 0 - 50);
  });

  it('available is floored at zero', () => {
    const huge: PayoutRequest[] = [{ id: 'x', amount: 9999, methodId: 'm', status: 'requested', requestedAt: '2026-06-01' }];
    expect(availableToWithdraw(credits, penalties, huge)).toBe(0);
  });

  function creditSum() { return credits.reduce((a, c) => a + c.amount, 0); }
});

describe('penalty + payout helpers', () => {
  it('counts only pending penalties', () => {
    expect(pendingPenaltyCount(penalties)).toBe(1);
  });

  it('withdrawal fee rounds on method feePct', () => {
    const m: PayoutMethod = { id: 'm', kind: 'paypal', label: 'x', isDefault: false, feePct: 2, etaDays: 1 };
    expect(withdrawalFee(100, m)).toBe(2);
    expect(withdrawalFee(100, undefined)).toBe(0);
  });
});

describe('ledger', () => {
  it('merges credits + applied fines + committed payouts, newest first, with signed amounts', () => {
    const rows = buildLedger(credits, penalties, payouts);
    // 3 credits + 1 applied fine + 1 committed payout = 5 rows (pending fine + rejected payout excluded)
    expect(rows).toHaveLength(5);
    expect(rows[0].at >= rows[rows.length - 1].at).toBe(true);
    expect(rows.find((r) => r.kind === 'penalty')?.amount).toBe(-25);
    expect(rows.find((r) => r.kind === 'payout')?.amount).toBe(-50);
  });
});

describe('payment-method masking', () => {
  it('keeps only the last 4 of an account number', () => {
    expect(maskTail('123456789')).toBe('••6789');
    expect(maskTail('1234 5678 9012', 4)).toBe('••9012');
    expect(maskTail('99')).toBe('••99'); // shorter than keep → as-is
  });
  it('masks the local part of an email but keeps the domain', () => {
    expect(maskEmail('huyleader@gmail.com')).toBe('huy•••@gmail.com');
    expect(maskEmail('ab@wise.com')).toBe('ab•••@wise.com');
    expect(maskEmail('notanemail')).toBe('notanemail'); // no @ → untouched
  });
});

describe('penalty summary', () => {
  it('rolls up status totals, this-month, and a by-type breakdown', () => {
    const s = summarisePenalties(penalties, '2026-06');
    expect(s.total).toBe(3);
    expect(s.applied).toBe(1);
    expect(s.appliedTotal).toBe(25);   // only the applied 'late' fine
    expect(s.pendingTotal).toBe(18);   // the pending 'revision'
    expect(s.monthTotal).toBe(25);     // applied fine dated 2026-06
    // by-type only includes types with at least one penalty
    expect(s.byType.map((t) => t.type).sort()).toEqual(['late', 'rating', 'revision']);
  });
});

describe('money-leak invariant', () => {
  it('finance selectors never expose order value / payout basis / commission rate', () => {
    const blob = JSON.stringify({
      finance: myFinance('s3'),
      credits: myCommissionCredits('s3'),
      penalties: myPenalties('s3'),
      payouts: myPayouts('s3'),
    });
    // `basis` and `rate` are the PAYOUTS fields that could reconstruct the customer price.
    // (PenaltyRule legitimately has its own config `value`, so we don't blanket-ban "value".)
    expect(blob).not.toMatch(/"basis"/);
    expect(blob).not.toMatch(/"rate"/);
  });

  it('myFinance balance reconciles with its own parts', () => {
    const f = myFinance('s3');
    expect(f.balance).toBe(walletBalance(f.credits, f.penalties, f.payouts));
    expect(f.available).toBe(availableToWithdraw(f.credits, f.penalties, f.payouts));
  });
});
