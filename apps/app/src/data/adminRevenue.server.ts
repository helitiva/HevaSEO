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
const RECOGNIZED_STATES = ['delivered', 'approved', 'completed'] as const;
// Committed but not yet earned — the customer's credit is spoken for, we still owe the work.
const UNEARNED_STATES = ['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested'] as const;

export interface RevenueDay { date: string; deposits: number; bookings: number; recognized: number }
export interface RevenueSlice { deposits: number; bookings: number; recognized: number }
export interface RevenueBook {
  today: RevenueSlice;
  mtd: RevenueSlice;
  total: RevenueSlice;
  deferred: { unspentCredit: number; unearnedOrders: number; total: number };
  /** deposits − recognized − nonOrderSpend should equal deferred.total; surfaced so the books can be shown to tie out. */
  reconcile: { deposits: number; recognized: number; nonOrderSpend: number; deferred: number; balances: number; ok: boolean };
  days: RevenueDay[];
}

type LedgerRow = { kind: string; amount: number | string; created_at: string; order_id: string | null };
type OrderRow = { value: number | string; state: string; created_at: string; delivered_at: string | null };

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
  const topups = ledger.filter((l) => num(l.amount) > 0);

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
  const nonOrderSpend = round2(ledger.filter((l) => num(l.amount) < 0 && !l.order_id).reduce((s, l) => s + -num(l.amount), 0));
  const deferredTotal = round2(unspentCredit + unearnedOrders);
  const expected = round2(total.deposits - total.recognized - nonOrderSpend);

  return {
    today: sliceFor(today, today),
    mtd: sliceFor(monthStart, today),
    total,
    deferred: { unspentCredit, unearnedOrders, total: deferredTotal },
    reconcile: {
      deposits: total.deposits, recognized: total.recognized, nonOrderSpend,
      deferred: deferredTotal, balances: unspentCredit,
      ok: Math.abs(expected - deferredTotal) < 0.01,
    },
    days,
  };
}
