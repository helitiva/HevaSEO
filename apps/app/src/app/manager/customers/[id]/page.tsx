import { notFound } from 'next/navigation';
import { CustomerDetailView } from '@/app/admin/customers/[id]/view';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager customer detail — same profile as admin, but a manager may only open a
// customer their pod serves, and it is money-blind (LTV/credit/ledger hidden,
// no credit adjust, no customer impersonation) via the manager ViewerProvider +
// showMoney={false} for the server-rendered activity feed.
export default async function ManagerCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = managerScope(MANAGER_PERSONA);
  if (!scope.customerIds.has(id)) notFound();
  return <CustomerDetailView id={id} showMoney={false} />;
}
