import { PageHeader } from '@/components/shared/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from './OrdersExplorer';
import { getOrders } from '@/data/orders.server';
import { getCustomers } from '@/data/customers.server';
import { advanceOrderAction, cancelOrderAction } from './actions';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  // RLS-scoped real reads. The customer facts on each row (tier / LTV / order count) used to come from
  // customerByCompany() — a lookup into the adminMock CUSTOMERS array BY COMPANY NAME. Two ways to be
  // wrong, and it was both:
  //
  //  · A real customer with no mock twin ("henro co") fell through to `?? o.value` / `?? 1` / `?? 'new'`,
  //    so the LTV column showed the order's own value — $59 for an account that has spent $296.02 — and
  //    the "Customer LTV" sort therefore sorted by order value instead.
  //  · A real customer that DOES share a name with a mock one — Nova, Vértice, Peak Digital and Lumen
  //    all exist in both — would inherit the mock's tier and spend. Dormant only because those accounts
  //    have no orders yet; the first real Nova order would have rendered as VIP with $3,180 LTV.
  //
  // Joined on the real customer id now, so a name collision cannot reach it.
  const [orders, customers] = await Promise.all([getOrders(), getCustomers()]);
  const custById = new Map(customers.map((c) => [c.id, c]));
  // System sequence number: oldest order = #1 (stable, independent of table sort).
  const seqMap = new Map(
    [...orders].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
  );
  const rows: ExplorerOrder[] = orders.map((o) => {
    const c = o.customerId ? custById.get(o.customerId) : undefined;
    return {
      ...o,
      seq: seqMap.get(o.id) ?? 0,
      custName: c?.name ?? o.customer,
      custTier: c?.tier ?? 'new',
      // No fabricated stand-in: a customer we can't resolve has no known LTV or order count, and 0 says
      // so. `?? o.value` used to make an unknown look like a $59 lifetime.
      custLtv: c?.spend ?? 0,
      custOrders: c?.orders ?? 0,
    };
  });

  return (
    <section>
      <PageHeader title="Orders" subtitle={`${rows.length} orders · customer tier, LTV & filters`} />
      <OrdersExplorer rows={rows} advanceAction={advanceOrderAction} cancelAction={cancelOrderAction} />
    </section>
  );
}
