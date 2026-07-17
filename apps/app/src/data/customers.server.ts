import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { allRows } from '@/lib/supabase/allRows';
import type { AdminCustomer } from '@/data/adminMock';

// Lane A inc-3f — real (RLS-scoped) customer roster for the admin Customers page. Replaces the
// CUSTOMERS mock. Aggregates order count/spend from real orders (excl. canceled) and reads the
// authoritative balance from customer_balances (admin policy allows it; staff/manager are money-blind).
// Return shape matches AdminCustomer (CONTRACTS §2). lastActive falls back to created_at; ticket/extra
// enrichment still comes from mock in buildCustomerRows until those entities are seeded.
type CustRow = {
  id: string; name: string; company: string | null; email: string | null;
  status: AdminCustomer['status']; tier: AdminCustomer['tier'];
  last_active_at: string | null; created_at: string;
};

export async function getCustomers(): Promise<AdminCustomer[]> {
  const supabase = await createClient();
  // Every read guarded, not just the first. An RLS denial on these two used to fall through `?? []` and
  // render every customer with $0 balance and $0 LTV — indistinguishable from a customer who genuinely
  // has neither. A truncated read does the same thing to whoever falls off the end. Silent zeroes on
  // money are the failure this codebase keeps paying for.
  type BalRow = { customer_id: string; balance: number | string };
  type OrdRow = { customer_id: string; value: number | string };
  const [custRows, balRows, ordRows] = await Promise.all([
    allRows<CustRow>('getCustomers', supabase.from('customers')
      .select('id, name, company, email, status, tier, last_active_at, created_at', { count: 'exact' })
      .returns<CustRow[]>()),
    allRows<BalRow>('getCustomers balances', supabase.from('customer_balances')
      .select('customer_id, balance', { count: 'exact' }).returns<BalRow[]>()),
    allRows<OrdRow>('getCustomers orders', supabase.from('orders')
      .select('customer_id, value', { count: 'exact' }).neq('state', 'canceled').returns<OrdRow[]>()),
  ]);

  const balByCust = new Map(balRows.map((b) => [b.customer_id, Number(b.balance)]));
  const agg = new Map<string, { n: number; spend: number }>();
  for (const o of ordRows) {
    const a = agg.get(o.customer_id) ?? { n: 0, spend: 0 };
    a.n += 1; a.spend += Number(o.value);
    agg.set(o.customer_id, a);
  }

  return custRows.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company ?? c.name,
    email: c.email ?? '',
    status: c.status,
    orders: agg.get(c.id)?.n ?? 0,
    spend: agg.get(c.id)?.spend ?? 0,
    balance: balByCust.get(c.id) ?? 0,
    lastActive: (c.last_active_at ?? c.created_at).slice(0, 10),
    tier: c.tier,
  }));
}

/**
 * Open tickets per customer id — real, from the tickets table.
 *
 * The customers roster used to count these by filtering the adminMock TICKETS array on
 * `t.customer === c.company`. Real customers Nova / Vértice / Peak Digital / Lumen share names with mock
 * ones, so they'd have inherited fabricated ticket counts; every other real customer got 0 by accident
 * rather than by fact. Keyed by id, so a name collision can't reach it.
 */
export async function getOpenTicketCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  type TicketRow = { customer_id: string | null; status: string };
  const data = await allRows<TicketRow>('getOpenTicketCounts', supabase
    .from('tickets')
    .select('customer_id, status', { count: 'exact' })
    .in('status', ['open', 'pending'])
    .returns<TicketRow[]>());
  const out = new Map<string, number>();
  for (const t of data ?? []) if (t.customer_id) out.set(t.customer_id, (out.get(t.customer_id) ?? 0) + 1);
  return out;
}
