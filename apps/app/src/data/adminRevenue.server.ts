import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * The money book for admin — real, RLS-scoped (admin sees the whole tenant), on SaaS revenue-recognition
 * rules (ASC 606). The three numbers people conflate are kept strictly apart:
 *
 *  · DEPOSITS  — cash the customer topped up. This is NOT revenue: it is a contract liability. Money in
 *                the door only becomes revenue once we've done the work.
 *  · BOOKINGS  — order value placed (committed). Also NOT revenue: the obligation isn't satisfied yet.
 *  · RECOGNIZED— order value whose performance obligation IS satisfied, booked on the day the work was
 *                DELIVERED (orders.delivered_at). This is the real top line.
 *
 * DEFERRED REVENUE (the liability we still owe customers) = unspent credit + value of orders placed but
 * not yet delivered. The book balances: deposits − recognized − other credit spend = deferred.
 */

// Work is earned once it reaches the customer; a delivery sent back (changes_requested) is un-earned again.
// Exported so /admin/analytics recognizes revenue by the same rule — one definition, or the two pages
// disagree about the top line (they did: analytics counted only state='completed' and reported $0 while
// this book reported $296.02 for the same orders).
export const RECOGNIZED_STATES = ['delivered', 'approved', 'completed'] as const;
// Committed but not yet earned — the customer's credit is spoken for, we still owe the work.
const UNEARNED_STATES = ['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested'] as const;

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

type LedgerRow = { kind: string; amount: number | string; created_at: string; order_id: string | null };
type OrderRow = { value: number | string; state: string; created_at: string; delivered_at: string | null };

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

const day = (ts: string): string => ts.slice(0, 10);
const num = (v: number | string): number => Number(v) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export async function getRevenueBook(windowDays = 30): Promise<RevenueBook> {
  const supabase = await createClient();
  const [ledgerRes, ordersRes, balRes] = await Promise.all([
    supabase.from('credit_ledger').select('kind, amount, created_at, order_id').returns<LedgerRow[]>(),
    supabase.from('orders').select('value, state, created_at, delivered_at').returns<OrderRow[]>(),
    supabase.from('customer_balances').select('balance').returns<{ balance: number | string }[]>(),
  ]);
  if (ledgerRes.error) throw new Error(`getRevenueBook ledger: ${ledgerRes.error.message}`);
  if (ordersRes.error) throw new Error(`getRevenueBook orders: ${ordersRes.error.message}`);
  if (balRes.error) throw new Error(`getRevenueBook balances: ${balRes.error.message}`);

  const ledger = ledgerRes.data ?? [];
  const orders = (ordersRes.data ?? []).filter((o) => o.state !== 'canceled'); // a canceled order was never booked
  // Filter on KIND, never on sign. A refund is also a positive amount (see the credit_ledger migration:
  // "+ topup/refund, - debit"), so `amount > 0` silently swept refunds into deposits and reported credit
  // handed back to a customer as "cash collected". Dormant only because nothing has been cancelled yet —
  // cancel_order() is the only writer of refunds.
  const topups = ledger.filter((l) => l.kind === 'topup');

  // real clock: this book is real money, so it must not follow the Phase-0 mock "today"
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const isRecognized = (o: OrderRow) => !!o.delivered_at && (RECOGNIZED_STATES as readonly string[]).includes(o.state);
  const isUnearned = (o: OrderRow) => (UNEARNED_STATES as readonly string[]).includes(o.state);

  const sliceFor = (from: string, to: string): RevenueSlice => ({
    deposits: round2(topups.filter((l) => day(l.created_at) >= from && day(l.created_at) <= to).reduce((s, l) => s + num(l.amount), 0)),
    bookings: round2(orders.filter((o) => day(o.created_at) >= from && day(o.created_at) <= to).reduce((s, o) => s + num(o.value), 0)),
    recognized: round2(orders.filter((o) => isRecognized(o) && day(o.delivered_at!) >= from && day(o.delivered_at!) <= to)
      .reduce((s, o) => s + num(o.value), 0)),
  });

  // daily series over the window, oldest → newest
  const days: RevenueDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, ...sliceFor(d, d) });
  }

  const unspentCredit = round2((balRes.data ?? []).reduce((s, b) => s + num(b.balance), 0));
  const unearnedOrders = round2(orders.filter(isUnearned).reduce((s, o) => s + num(o.value), 0));

  const total = sliceFor('0000-01-01', '9999-12-31');
  // credit spent on something other than an order (legacy/manual debits) — needed for the book to tie out
  const nonOrderSpend = round2(ledger.filter((l) => l.kind === 'debit' && !l.order_id).reduce((s, l) => s + -num(l.amount), 0));
  // Fees we keep when a customer cancels (cancel_order takes 5%). They leave the wallet WITHOUT
  // becoming an order, so the identity has to account for them separately — and they can't ride along in
  // nonOrderSpend, because cancel_order stamps them with the cancelled order's id.
  const cancelFees = round2(ledger.filter((l) => l.kind === 'cancel_fee').reduce((s, l) => s + -num(l.amount), 0));
  const deferredTotal = round2(unspentCredit + unearnedOrders);

  // The identity, derived from the wallet:
  //   balance = topups + refunds − debits − cancelFees
  // and, since every cancelled order's debit is undone by a refund of the same value,
  //   debits(with order) − refunds = recognized + unearnedOrders
  // therefore
  //   deferred = balance + unearnedOrders = topups − recognized − nonOrderSpend − cancelFees
  // The earlier version omitted cancelFees and let refunds inflate `deposits`, so it overshot by exactly
  // (refunds + cancelFees) — invisible today at zero cancellations, wrong the moment there is one.
  const expected = round2(total.deposits - total.recognized - nonOrderSpend - cancelFees);

  return {
    today: sliceFor(today, today),
    mtd: sliceFor(monthStart, today),
    total,
    deferred: { unspentCredit, unearnedOrders, total: deferredTotal },
    reconcile: {
      deposits: total.deposits, recognized: total.recognized, nonOrderSpend, cancelFees,
      deferred: deferredTotal, balances: unspentCredit, expected,
      ok: Math.abs(expected - deferredTotal) < 0.01,
    },
    days,
  };
}

/**
 * The Finance KPI band, real. It used to render adminMock's FIN_KPIS ($18,650 gross, a "3% of gross"
 * refunds figure, $2,460 wallet liability) — none of it connected to the business.
 *
 * The two that people get backwards:
 *  · "Gross" is RECOGNIZED revenue (work delivered this month) — not cash in, not orders placed.
 *  · "Wallet liability" is prepaid credit the customer hasn't spent: cash we hold but still owe as work.
 *
 * There is deliberately no accounts-receivable figure. This business is prepaid: nobody can owe us,
 * because no work starts before the credit is in. An earlier version of this function reported
 * "outstanding AR" by counting every invoice whose status wasn't in ['paid','void','refunded'] — but
 * `invoices` is a RECEIPT per settled top-up and its CHECK constraint only permits
 * ['issued','processing','void'], so 'paid' was unreachable and every receipt counted as a debt. It
 * read $20,080 owed to us; the truth was $0 owed to us and $19,728.98 owed BY us. Cash collected
 * (depositsMtd) replaces it — the honest counterpart to gross.
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
