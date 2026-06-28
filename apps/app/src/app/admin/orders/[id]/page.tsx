import { notFound } from 'next/navigation';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { OrderDetailClient } from './OrderDetailClient';

export const metadata = { title: 'Order detail' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const props = buildOrderDetailProps(id);
  if (!props) notFound();

  return <OrderDetailClient {...props} />;
}
