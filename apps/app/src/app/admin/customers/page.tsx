import { CustomersClient } from './CustomersClient';
import { buildCustomerRows } from './rows';
import { getCustomers } from '@/data/customers.server';
import { getOrders } from '@/data/orders.server';

export const metadata = { title: 'Customers' };

export default async function CustomersPage() {
  const [customers, orders] = await Promise.all([getCustomers(), getOrders()]); // RLS-scoped real reads
  return <CustomersClient rows={buildCustomerRows(customers, orders)} />;
}
