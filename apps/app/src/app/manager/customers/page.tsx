import { PageHeader } from '@/components/shared/PageHeader';
import { CustomersClient } from '@/app/admin/customers/CustomersClient';
import { buildCustomerRows } from '@/app/admin/customers/rows';
import { getCustomers } from '@/data/customers.server';
import { getPodOrders } from '@/data/orders.server';

export const metadata = { title: 'Customers' };

// Manager Customers — REAL tenant customers (customers_visibility RLS covers managers) with order stats
// from the money-stripped orders_mgr view, so the list reflects live data and stays money-blind
// (CustomersClient hides LTV/credit/AOV columns for the manager viewer).
export default async function ManagerCustomersPage() {
  const [customers, orders] = await Promise.all([getCustomers(), getPodOrders()]);
  const rows = buildCustomerRows(customers, orders);
  return (
    <section>
      <PageHeader title="Customers" subtitle={`${rows.length} customers served by your pod`} />
      <CustomersClient rows={rows} />
    </section>
  );
}
