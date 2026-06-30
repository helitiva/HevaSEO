import { notFound } from 'next/navigation';
import { BroadcastDetailClient } from '@/components/admin/broadcasts/BroadcastDetailClient';
import { getBroadcasts } from '@/data/broadcasts.server';
import { getBroadcastAnalytics } from '@/data/broadcastAnalytics.server';

export const metadata = { title: 'Broadcast detail' };

export default async function BroadcastAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [list, realEvents] = await Promise.all([getBroadcasts(), getBroadcastAnalytics(id)]);
  const broadcast = list.find((b) => b.id === id);
  if (!broadcast) notFound();
  return <BroadcastDetailClient id={id} broadcast={broadcast} realEvents={realEvents} />; // real analytics (inc-C6)
}
