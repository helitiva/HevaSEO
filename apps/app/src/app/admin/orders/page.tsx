import { PageHeader } from '@/components/admin/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from './OrdersExplorer';
import { ORDERS, customerByCompany } from '@/data/adminMock';

export default function OrdersPage() {
  const rows: ExplorerOrder[] = ORDERS.map((o) => {
    const c = customerByCompany(o.customer);
    return {
      ...o,
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
