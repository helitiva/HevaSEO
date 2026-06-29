import { PageHeader } from '@/components/shared/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from './OrdersExplorer';
import { customerByCompany } from '@/data/adminMock';
import { getOrders } from '@/data/orders.server';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  const orders = await getOrders(); // RLS-scoped real read (admin → all tenant orders)
  // System sequence number: oldest order = #1 (stable, independent of table sort).
  const seqMap = new Map(
    [...orders].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
  );
  const rows: ExplorerOrder[] = orders.map((o) => {
    const c = customerByCompany(o.customer);
    return {
      ...o,
      seq: seqMap.get(o.id) ?? 0,
      custName: c?.name ?? o.customer,
      custTier: c?.tier ?? 'new',
      custLtv: c?.spend ?? o.value,
      custOrders: c?.orders ?? 1,
    };
  });

  return (
    <section>
      <PageHeader title="Orders" subtitle={`${rows.length} orders · customer tier, LTV & filters`} />
      <OrdersExplorer rows={rows} />
    </section>
  );
}
