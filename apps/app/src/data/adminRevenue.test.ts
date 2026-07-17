import { describe, it, expect } from 'vitest';
import { RECOGNIZED_STATES, isBookedState, financeKpis, type RevenueBook } from './adminRevenue';

/**
 * The ASC 606 rules had no test at all. Every bug this file now pins was found by hand, by reading a
 * page and disbelieving the number on it — which is not a process that scales past the person who
 * happened to look.
 *
 * The rules also live in SQL now (the revenue_book RPC), so these assertions have a twin:
 * supabase/tests/0830_revenue_book_test.sql pins the same rule on the database side. Both must agree,
 * or Finance and Analytics start reporting different top lines — exactly what happened before, when
 * analytics counted only state='completed' and showed $0 while Finance showed $296.02 for the same
 * orders.
 */

const slice = (deposits: number, bookings: number, recognized: number) => ({ deposits, bookings, recognized });
const book = (over: Partial<RevenueBook> = {}): RevenueBook => ({
  today: slice(0, 0, 0),
  mtd: slice(20080, 2736.02, 296.02),
  total: slice(20080, 2736.02, 296.02),
  deferred: { unspentCredit: 17288.98, unearnedOrders: 2440, total: 19728.98 },
  reconcile: { deposits: 20080, recognized: 296.02, nonOrderSpend: 55, cancelFees: 0, deferred: 19728.98, balances: 17288.98, expected: 19728.98, ok: true },
  days: [],
  ...over,
});

describe('ASC 606 state rules', () => {
  it('recognizes revenue only once work has reached the customer', () => {
    expect([...RECOGNIZED_STATES]).toEqual(['delivered', 'approved', 'completed']);
  });

  it.each(['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested'])(
    'does NOT recognize %s — the obligation is not satisfied yet',
    (state) => {
      expect((RECOGNIZED_STATES as readonly string[]).includes(state)).toBe(false);
    },
  );

  it('un-recognizes work sent back for changes', () => {
    // changes_requested means the delivery bounced. It was earned; it is not earned now.
    expect((RECOGNIZED_STATES as readonly string[]).includes('changes_requested')).toBe(false);
  });

  it('books every state except canceled — including new', () => {
    // The bug this pins: analytics excluded 'new' as well as 'canceled', so every order awaiting
    // confirmation vanished from Bookings while Finance counted it. Every order passes through 'new'.
    for (const s of ['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered', 'approved', 'completed']) {
      expect(isBookedState(s)).toBe(true);
    }
  });

  it('takes a canceled order off the books — its credit was refunded, so it was never sold', () => {
    expect(isBookedState('canceled')).toBe(false);
  });

  it('every recognized state is also a booked state', () => {
    // If a state could be recognized but not booked, recognized > bookings and the book is nonsense.
    for (const s of RECOGNIZED_STATES) expect(isBookedState(s)).toBe(true);
  });
});

describe('financeKpis', () => {
  const noLedger: { kind: string; amount: number; at: string }[] = [];
  const noPayments: { status: string; amount: number }[] = [];
  const month = new Date().toISOString().slice(0, 7);

  it('reports gross as RECOGNIZED revenue — not cash in, not orders placed', () => {
    const k = financeKpis({ book: book(), payrollDue: 0, ledger: noLedger, payments: noPayments });
    expect(k.grossMtd).toBe(296.02);       // recognized
    expect(k.grossMtd).not.toBe(20080);    // deposits — the conflation this whole module exists to prevent
    expect(k.grossMtd).not.toBe(2736.02);  // bookings
  });

  it('reports deposits separately from gross, so cash never reads as revenue', () => {
    const k = financeKpis({ book: book(), payrollDue: 0, ledger: noLedger, payments: noPayments });
    expect(k.depositsMtd).toBe(20080);
  });

  it('reports wallet liability as UNSPENT credit, not the whole deferred balance', () => {
    // deferred.total (19728.98) also contains undelivered order value, which is no longer the
    // customer's to spend. Reporting it as "wallet liability" would overstate what they can withdraw.
    const k = financeKpis({ book: book(), payrollDue: 0, ledger: noLedger, payments: noPayments });
    expect(k.walletLiability).toBe(17288.98);
    expect(k.walletLiability).not.toBe(19728.98);
  });

  it('nets refunds out of gross', () => {
    const k = financeKpis({
      book: book(),
      payrollDue: 0,
      ledger: [{ kind: 'refund', amount: 96.02, at: `${month}-05T00:00:00Z` }],
      payments: noPayments,
    });
    expect(k.refundsMtd).toBe(96.02);
    expect(k.netMtd).toBe(200);
  });

  it('counts a refund by absolute value however the ledger signed it', () => {
    const k = financeKpis({
      book: book(), payrollDue: 0,
      ledger: [{ kind: 'refund', amount: -50, at: `${month}-05T00:00:00Z` }],
      payments: noPayments,
    });
    expect(k.refundsMtd).toBe(50);
    expect(k.netMtd).toBe(246.02);
  });

  it('ignores refunds from other months', () => {
    const k = financeKpis({
      book: book(), payrollDue: 0,
      ledger: [{ kind: 'refund', amount: 500, at: '2020-01-05T00:00:00Z' }],
      payments: noPayments,
    });
    expect(k.refundsMtd).toBe(0);
    expect(k.netMtd).toBe(296.02);
  });

  it('counts only refunds — a debit is not a refund', () => {
    const k = financeKpis({
      book: book(), payrollDue: 0,
      ledger: [
        { kind: 'debit', amount: -40, at: `${month}-05T00:00:00Z` },
        { kind: 'topup', amount: 20000, at: `${month}-05T00:00:00Z` },
        { kind: 'cancel_fee', amount: -10, at: `${month}-05T00:00:00Z` },
      ],
      payments: noPayments,
    });
    expect(k.refundsMtd).toBe(0);
  });

  it('counts only PROCESSING charges as in-flight — issued is settled cash, void never happened', () => {
    const k = financeKpis({
      book: book(), payrollDue: 0, ledger: noLedger,
      payments: [
        { status: 'processing', amount: 80 },
        { status: 'issued', amount: 20000 },
        { status: 'void', amount: 999 },
      ],
    });
    expect(k.paymentsInFlight).toBe(80);
  });

  it('never invents accounts receivable — this business is prepaid', () => {
    // The bug: every receipt counted as a debt because status 'paid' was unreachable, so the page read
    // "$20,080 outstanding AR" when the truth was $0 owed TO us and $19,728.98 owed BY us.
    const k = financeKpis({ book: book(), payrollDue: 0, ledger: noLedger, payments: noPayments });
    expect(k).not.toHaveProperty('outstandingAr');
    expect(Object.values(k)).not.toContain(20080 - 296.02);
  });

  it('passes payroll due through untouched', () => {
    const k = financeKpis({ book: book(), payrollDue: 2014.8, ledger: noLedger, payments: noPayments });
    expect(k.payoutsDue).toBe(2014.8);
  });

  it('keeps money arithmetic at cent precision', () => {
    // 0.1 + 0.2 territory: without rounding this lands on 246.01999999999998 and renders as $246.02
    // anyway — right until someone compares two of them for equality.
    const k = financeKpis({
      book: book(), payrollDue: 0,
      ledger: [{ kind: 'refund', amount: 0.1, at: `${month}-05T00:00:00Z` }, { kind: 'refund', amount: 0.2, at: `${month}-05T00:00:00Z` }],
      payments: noPayments,
    });
    expect(k.refundsMtd).toBe(0.3);
    expect(k.netMtd).toBe(295.72);
  });
});

describe('the reconcile identity', () => {
  it('holds for the real book: deposits − recognized − nonOrderSpend − cancelFees = deferred', () => {
    const r = book().reconcile;
    expect(r.deposits - r.recognized - r.nonOrderSpend - r.cancelFees).toBeCloseTo(r.deferred, 2);
    expect(r.expected).toBeCloseTo(r.deferred, 2);
    expect(r.ok).toBe(true);
  });

  it('deferred splits into unspent credit + undelivered work, and nothing else', () => {
    const d = book().deferred;
    expect(d.unspentCredit + d.unearnedOrders).toBeCloseTo(d.total, 2);
  });
});
