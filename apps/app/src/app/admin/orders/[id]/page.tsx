import { notFound } from 'next/navigation';
import { buildOrderDetailProps, orderNavFrom } from '@/lib/orderDetail';
import { getOrderById, getOrderDetail, getOrders } from '@/data/orders.server';
import { OrderDetailClient } from './OrderDetailClient';
import { advanceOrderAction, cancelOrderAction } from '../actions';

export const metadata = { title: 'Order detail' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // getOrders() is the real list. Without it buildOrderDetailProps falls back to the adminMock ORDERS
  // for seq and prev/next, which are keyed by mock ids — so a real order rendered "#0" (the same order
  // the list calls "#5"), and its '›' caret pointed at a mock order id that 404s.
  const [order, detail, all] = await Promise.all([getOrderById(id), getOrderDetail(id), getOrders()]); // RLS-scoped
  const props = order ? buildOrderDetailProps(order, detail, orderNavFrom(all, id)) : null;
  if (!props) notFound();

  return <OrderDetailClient {...props} advanceAction={advanceOrderAction} cancelAction={cancelOrderAction} />;
}
