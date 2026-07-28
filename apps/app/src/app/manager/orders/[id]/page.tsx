import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { getPodOrderById, getOrderDetail } from '@/data/orders.server';
import { OrderDetailClient } from '@/app/admin/orders/[id]/OrderDetailClient';

export const metadata = { title: 'Order detail' };

// Manager order detail — same panel as admin (money-blind via the manager ViewerProvider), read via
// the money-stripped orders_mgr view. The view's WHERE is the visibility gate (manager → tenant
// orders, money-stripped), so an order the manager can't see resolves to notFound. order_details
// (non-money brief) is readable by managers tenant-wide.
export default async function ManagerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, detail] = await Promise.all([getPodOrderById(id), getOrderDetail(id)]);
  const props = order ? buildOrderDetailProps(order, detail) : null;
  if (!props) notFound();

  return <OrderDetailClient {...props} />;
}
