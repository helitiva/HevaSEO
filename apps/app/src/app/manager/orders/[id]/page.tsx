import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { OrderDetailClient } from '@/app/admin/orders/[id]/OrderDetailClient';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager order detail — same panel/page as admin (money-blind via the manager
// ViewerProvider), but only for an order worked by this manager's pod. Lets the
// order-detail slide-over's prev/next/customer links resolve inside /manager.
export default async function ManagerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const props = buildOrderDetailProps(id);
  if (!props) notFound();

  // A manager may open an order their pod works, OR an unassigned order (which they
  // can route from the shared queue). Anything else is another pod's — hide it.
  const scope = managerScope(MANAGER_PERSONA);
  const inScope = scope.orderCodes.has(props.order.code) || props.order.staff === null;
  if (!inScope) notFound();

  return <OrderDetailClient {...props} />;
}
