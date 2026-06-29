import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { getOrderById } from '@/data/orders.server';
import { OrderDetailClient } from './OrderDetailClient';
import { advanceOrderAction } from '../actions';

export const metadata = { title: 'Order detail' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id); // RLS-scoped real read
  const props = order ? buildOrderDetailProps(order) : null;
  if (!props) notFound();

  return <OrderDetailClient {...props} advanceAction={advanceOrderAction} />;
}
