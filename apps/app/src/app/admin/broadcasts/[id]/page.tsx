import { notFound } from 'next/navigation';
import { BroadcastDetailClient } from '@/components/admin/broadcasts/BroadcastDetailClient';
import { getBroadcasts } from '@/data/broadcasts.server';

export const metadata = { title: 'Broadcast detail' };

export default async function BroadcastAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const broadcast = (await getBroadcasts()).find((b) => b.id === id); // real record (analytics mock → C6)
  if (!broadcast) notFound();
  return <BroadcastDetailClient id={id} broadcast={broadcast} />;
}
