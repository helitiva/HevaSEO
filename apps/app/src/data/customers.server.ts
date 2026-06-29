import 'server-only';
import { createClient } from '@/lib/supabase/server';
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
  const [custs, bals, ords] = await Promise.all([
    supabase.from('customers').select('id, name, company, email, status, tier, last_active_at, created_at').returns<CustRow[]>(),
    supabase.from('customer_balances').select('customer_id, balance'),
    supabase.from('orders').select('customer_id, value').neq('state', 'canceled'),
  ]);
  if (custs.error) throw new Error(`getCustomers: ${custs.error.message}`);

  const balByCust = new Map((bals.data ?? []).map((b) => [b.customer_id as string, Number(b.balance)]));
  const agg = new Map<string, { n: number; spend: number }>();
  for (const o of ords.data ?? []) {
    const a = agg.get(o.customer_id as string) ?? { n: 0, spend: 0 };
    a.n += 1; a.spend += Number(o.value);
    agg.set(o.customer_id as string, a);
  }

  return (custs.data ?? []).map((c) => ({
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
