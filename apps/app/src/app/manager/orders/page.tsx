import { PageHeader } from '@/components/shared/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from '@/app/admin/orders/OrdersExplorer';
import { ORDERS, customerByCompany } from '@/data/adminMock';
import { managerScope, ordersForPod, MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'Orders' };

// Manager Orders — the same explorer the admin uses, but scoped to this pod's
// orders and money-blind (the OrdersExplorer drops the value/LTV columns for the
// manager viewer). Order numbers stay global so they match the admin's view.
export default function ManagerOrdersPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const seqMap = new Map(
    [...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
  );
  const rows: ExplorerOrder[] = ordersForPod(scope).map((o) => {
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
      <PageHeader title="Orders" subtitle={`${rows.length} orders in ${scope.manager?.name ?? 'your'}’s pod`} />
      <OrdersExplorer rows={rows} />
    </section>
  );
}
