import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { RevenueBook, RevenueSlice } from '@/data/adminRevenue';

/**
 * Fetching the money book. The RULES live in adminRevenue.ts — pure, unit-tested, importable by client
 * components. This file is only the I/O half.
 *
 * Re-exported below so the existing importers (and any client component that only wants the types) keep
 * working through either path.
 */
export type { RevenueDay, RevenueSlice, RevenueBook, FinanceKpis } from '@/data/adminRevenue';
export { RECOGNIZED_STATES, isBookedState, financeKpis } from '@/data/adminRevenue';

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

const num = (v: Money): number => Number(v) || 0;
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
 *
 * The ASC 606 state rules therefore exist in two places — the `recognized`/`unearned` CTEs in the RPC,
 * and RECOGNIZED_STATES/isBookedState in adminRevenue.ts, which /admin/analytics still needs in TS for
 * the per-service and per-customer breakdowns the RPC doesn't return. 0830_revenue_book_test.sql pins
 * the SQL side and adminRevenue.test.ts pins the TS side against the same documented rule, so a drift
 * fails a test rather than quietly making two pages disagree — which is exactly what happened when the
 * catalog was duplicated.
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
