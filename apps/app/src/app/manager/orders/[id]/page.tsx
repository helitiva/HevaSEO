import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { getPodOrderById } from '@/data/orders.server';
import { OrderDetailClient } from '@/app/admin/orders/[id]/OrderDetailClient';

export const metadata = { title: 'Order detail' };

// Manager order detail — same panel as admin (money-blind via the manager ViewerProvider), read via
// the money-stripped orders_mgr view. The view's WHERE is the visibility gate (manager → tenant
// orders, money-stripped), so an order the manager can't see resolves to notFound.
export default async function ManagerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPodOrderById(id);
  const props = order ? buildOrderDetailProps(order) : null;
  if (!props) notFound();

  return <OrderDetailClient {...props} />;
}
