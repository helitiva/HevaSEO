/**
 * The ASC 606 money rules — the definitions, with no I/O.
 *
 * Split from adminRevenue.server.ts on the convention this codebase already uses (adminPayroll.ts vs
 * adminPayroll.server.ts, adminAffiliate.ts vs adminAffiliate.server.ts): the `.server` file talks to
 * the database and is behind `server-only`; this one is pure, so it can be unit-tested and imported by
 * client components without dragging a database client into their graph.
 *
 * The three numbers people conflate are kept strictly apart:
 *
 *  · DEPOSITS   — cash the customer topped up. NOT revenue: a contract liability. Money in the door
 *                 only becomes revenue once we have done the work.
 *  · BOOKINGS   — order value placed (committed). Also NOT revenue: the obligation isn't satisfied yet.
 *  · RECOGNIZED — order value whose performance obligation IS satisfied, booked on the day the work was
 *                 DELIVERED (orders.delivered_at). This is the real top line.
 *
 * DEFERRED REVENUE (what we still owe customers) = unspent credit + value of orders placed but not yet
 * delivered. The book balances: deposits − recognized − other credit spend = deferred.
 */

/**
 * Work is earned once it reaches the customer; a delivery sent back (changes_requested) is un-earned
 * again.
 *
 * Shared with /admin/analytics so it recognizes revenue by the same rule — one definition, or the two
 * pages disagree about the top line. They did: analytics counted only state='completed' and reported $0
 * while the money book reported $296.02 for the same orders.
 */
export const RECOGNIZED_STATES = ['delivered', 'approved', 'completed'] as const;

/**
 * Is this order ON the books at all? Only a cancellation takes it off — its credit is refunded, so it
 * was never sold. Everything else counts as booked, including 'new': the credit is already debited and
 * we already owe the work.
 *
 * Shared for the same reason as RECOGNIZED_STATES. /admin/analytics used its own set
 * (`['new','canceled']`) and so dropped every unconfirmed order from its Bookings KPI, chart, service
 * mix and top-customers — while Command Center and Finance counted it. Every order passes through
 * 'new', so any order awaiting confirmation made the two pages disagree.
 */
export const isBookedState = (state: string): boolean => state !== 'canceled';

export interface RevenueDay { date: string; deposits: number; bookings: number; recognized: number }
export interface RevenueSlice { deposits: number; bookings: number; recognized: number }
export interface RevenueBook {
  today: RevenueSlice;
  mtd: RevenueSlice;
  total: RevenueSlice;
  deferred: { unspentCredit: number; unearnedOrders: number; total: number };
  /** deposits − recognized − nonOrderSpend − cancelFees should equal deferred.total; surfaced so the books can be shown to tie out. */
  reconcile: { deposits: number; recognized: number; nonOrderSpend: number; cancelFees: number; deferred: number; balances: number; expected: number; ok: boolean };
  days: RevenueDay[];
}

/** The Finance page's KPI band. Same book, framed as "where the money sits and what's due". */
export interface FinanceKpis {
  grossMtd: number;         // recognized revenue this month, before refunds
  refundsMtd: number;
  netMtd: number;           // gross − refunds
  walletLiability: number;  // prepaid customer credit we still owe as work
  payoutsDue: number;       // what this period owes staff + managers
  depositsMtd: number;      // cash collected this month — the cash counterpart to grossMtd
  paymentsInFlight: number; // charges the provider hasn't confirmed yet
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The Finance KPI band. It used to render adminMock's FIN_KPIS ($18,650 gross, a "3% of gross" refunds
 * figure, $2,460 wallet liability) — none of it connected to the business.
 *
 * The two that people get backwards:
 *  · "Gross" is RECOGNIZED revenue (work delivered this month) — not cash in, not orders placed.
 *  · "Wallet liability" is prepaid credit the customer hasn't spent: cash we hold but still owe as work.
 *
 * There is deliberately no accounts-receivable figure. This business is prepaid: nobody can owe us,
 * because no work starts before the credit is in. An earlier version reported "outstanding AR" by
 * counting every invoice whose status wasn't in ['paid','void','refunded'] — but `invoices` is a RECEIPT
 * per settled top-up and its CHECK constraint only permits ['issued','processing','void'], so 'paid' was
 * unreachable and every receipt counted as a debt. It read $20,080 owed to us; the truth was $0 owed to
 * us and $19,728.98 owed BY us. Cash collected (depositsMtd) replaces it — the honest counterpart to gross.
 *
 * PURE — it derives the band from data the page has already fetched, and issues no queries of its own.
 * It used to be async and re-fetch everything: the Finance page ended up running getRevenueBook twice
 * (3 queries each) and getPayrollPreview twice, then getLedger/getPayments read credit_ledger and
 * invoices *again* — credit_ledger three times per page load. The parameter types are structural, so
 * adminLedger's LedgerEntry/PaymentReceipt satisfy them without this module depending on that one.
 */
export function financeKpis(input: {
  book: RevenueBook;
  payrollDue: number;
  ledger: readonly { kind: string; amount: number; at: string }[];
  payments: readonly { status: string; amount: number }[];
}): FinanceKpis {
  const { book, payrollDue, ledger, payments } = input;
  const month = new Date().toISOString().slice(0, 7);
  const refundsMtd = round2(ledger
    .filter((l) => l.kind === 'refund' && l.at.slice(0, 7) === month)
    .reduce((s, l) => s + Math.abs(l.amount), 0));

  // 'processing' = the provider took the charge but hasn't confirmed it. The only money genuinely in
  // limbo; 'issued' receipts are settled cash and 'void' ones never happened.
  const paymentsInFlight = round2(payments
    .filter((p) => p.status === 'processing')
    .reduce((s, p) => s + p.amount, 0));

  const grossMtd = book.mtd.recognized;
  return {
    grossMtd,
    refundsMtd,
    netMtd: round2(grossMtd - refundsMtd),
    walletLiability: book.deferred.unspentCredit,
    payoutsDue: payrollDue,
    depositsMtd: book.mtd.deposits,
    paymentsInFlight,
  };
}
