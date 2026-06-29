import { PageHeader } from '@/components/shared/PageHeader';
import { OrdersExplorer, type ExplorerOrder } from '@/app/admin/orders/OrdersExplorer';
import { customerByCompany } from '@/data/adminMock';
import { getPodOrders } from '@/data/orders.server';
import { getServerSession } from '@/lib/supabase/server';

export const metadata = { title: 'Orders' };

// Manager Orders — the same explorer the admin uses, but read through the money-stripped orders_mgr
// view (no `value`; OrdersExplorer also drops the value/LTV columns for the manager viewer). The
// view's WHERE is the access gate. (Pod-scoping refinement lands with staff_details.manager_id seeding.)
export default async function ManagerOrdersPage() {
  const [orders, session] = await Promise.all([getPodOrders(), getServerSession()]);
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
      <PageHeader title="Orders" subtitle={`${rows.length} orders in ${session?.name ?? 'your'}’s pod`} />
      <OrdersExplorer rows={rows} />
    </section>
  );
}
