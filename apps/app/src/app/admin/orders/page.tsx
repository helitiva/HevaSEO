import { PageHeader } from '@/components/shared/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from './OrdersExplorer';
import { ORDERS, customerByCompany } from '@/data/adminMock';

export const metadata = { title: 'Orders' };

export default function OrdersPage() {
  // System sequence number: oldest order = #1 (stable, independent of table sort).
  const seqMap = new Map(
    [...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
  );
  const rows: ExplorerOrder[] = ORDERS.map((o) => {
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
