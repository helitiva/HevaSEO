import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { getOrderById, getOrderDetail } from '@/data/orders.server';
import { OrderDetailClient } from './OrderDetailClient';
import { advanceOrderAction, cancelOrderAction } from '../actions';

export const metadata = { title: 'Order detail' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, detail] = await Promise.all([getOrderById(id), getOrderDetail(id)]); // RLS-scoped
  const props = order ? buildOrderDetailProps(order, detail) : null;
  if (!props) notFound();

  return <OrderDetailClient {...props} advanceAction={advanceOrderAction} cancelAction={cancelOrderAction} />;
}
