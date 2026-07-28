import { CustomersClient } from './CustomersClient';
import { buildCustomerRows } from './rows';
import { getCustomers, getOpenTicketCounts } from '@/data/customers.server';
import { getOrders } from '@/data/orders.server';

export const metadata = { title: 'Customers' };

export default async function CustomersPage() {
  // Ticket counts are real and keyed by id. Without them buildCustomerRows falls back to filtering the
  // adminMock TICKETS array on company NAME — and Nova, Vértice, Peak Digital and Lumen exist in both
  // the real customers table and that mock array, so they would show ticket counts belonging to someone
  // who doesn't exist.
  const [customers, orders, openTickets] = await Promise.all([
    getCustomers(), getOrders(), getOpenTicketCounts(),
  ]); // RLS-scoped real reads
  return <CustomersClient rows={buildCustomerRows(customers, orders, openTickets)} />;
}
