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
// NOTE: the unearned-state list now lives in the revenue_book RPC (20260717160000), which is the only
// thing that used it. The two lists below stay because /admin/analytics still needs them in TS — it
// computes per-service and per-customer breakdowns the RPC doesn't return.
//
// That means the ASC 606 state rules exist in TWO places: here and in the SQL. adminRevenue.test.ts
// pins the TS side and 0830_revenue_book_test.sql pins the SQL side against the same documented rule,
// so a drift fails a test rather than quietly making two pages disagree — which is exactly what
// happened when the catalog was duplicated.

/**
 * Is this order ON the books at all? Only a cancellation takes it off — its credit is refunded, so it
 * was never sold. Everything else counts as booked, including 'new': the credit is already debited and
 * we already owe the work.
 *
 * Exported for the same reason RECOGNIZED_STATES is. /admin/analytics used its own set
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

/** What the revenue_book RPC returns. Numerics arrive as strings when large, hence `number | string`. */
type Money = number | string;
type RawSlice = { deposits: Money; bookings: Money; recognized: Money };
type RawBook = {
  today: RawSlice; mtd: RawSlice; total: RawSlice;
  deferred: { unspentCredit: Money; unearnedOrders: Money; total: Money };
  reconcile: {
    deposits: Money; recognized: Money; nonOrderSpend: Money; cancelFees: Money;
    deferred: Money; balances: Money; expected: Money; ok: boolean;
  };
  days: { date: string; deposits: Money; bookings: Money; recognized: Money }[];
};

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

/**
 * The money book — computed in SQL by the `revenue_book` RPC (20260717160000).
 *
 * It used to read credit_ledger, orders and customer_balances with unbounded select()s and sum them
 * here. PostgREST caps every response at max_rows (1000, supabase/config.toml) and **does not error
 * when it truncates** — it just returns fewer rows. At 1,001 ledger rows this would have started
 * reporting wrong deposits, wrong recognized and wrong deferred, silently, forever; and since those
 * reads had no ORDER BY, the surviving 1,000 rows were arbitrary, so it would have been wrong
 * differently on each load. Summing 20k rows in Node was the wrong shape regardless — these are SUMs.
 *
 * Row count is now irrelevant: one JSON object comes back however large the ledger grows. The RPC is
 * SECURITY DEFINER (so it bypasses RLS) and gates on current_app_role() = 'admin' internally.
 */
export async function getRevenueBook(windowDays = 30): Promise<RevenueBook> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('revenue_book', { p_window_days: windowDays });
  if (error) throw new Error(`getRevenueBook: ${error.message}`);
  if (!data) throw new Error('getRevenueBook: no book returned');
  // Postgres numerics arrive as strings once they outgrow a JS number's safe range, so every figure is
  // coerced rather than trusted to already be a number.
  const book = data as unknown as RawBook;
  const slice = (s: RawSlice): RevenueSlice => ({
    deposits: round2(num(s.deposits)), bookings: round2(num(s.bookings)), recognized: round2(num(s.recognized)),
  });
  return {
    today: slice(book.today),
    mtd: slice(book.mtd),
    total: slice(book.total),
    deferred: {
      unspentCredit: round2(num(book.deferred.unspentCredit)),
      unearnedOrders: round2(num(book.deferred.unearnedOrders)),
      total: round2(num(book.deferred.total)),
    },
    reconcile: {
      deposits: round2(num(book.reconcile.deposits)),
      recognized: round2(num(book.reconcile.recognized)),
      nonOrderSpend: round2(num(book.reconcile.nonOrderSpend)),
      cancelFees: round2(num(book.reconcile.cancelFees)),
      deferred: round2(num(book.reconcile.deferred)),
      balances: round2(num(book.reconcile.balances)),
      expected: round2(num(book.reconcile.expected)),
      ok: Boolean(book.reconcile.ok),
    },
    days: book.days.map((d) => ({
      date: d.date, deposits: round2(num(d.deposits)), bookings: round2(num(d.bookings)), recognized: round2(num(d.recognized)),
    })),
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
