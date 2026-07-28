import { notFound } from 'next/navigation';
import { CustomerDetailView } from '@/app/admin/customers/[id]/view';
import { getCustomers } from '@/data/customers.server';

export const metadata = { title: 'Customer' };

// Manager customer detail — same profile as admin, gated to a REAL customer the manager may see
// (getCustomers is RLS-scoped to the tenant) so the real customers list → profile never 404s. Money-blind
// (LTV/credit/ledger hidden, no credit adjust, no impersonation) via the manager ViewerProvider +
// showMoney={false} for the server-rendered activity feed.
export default async function ManagerCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customers = await getCustomers();
  if (!customers.some((c) => c.id === id)) notFound();
  return <CustomerDetailView id={id} showMoney={false} />;
}
