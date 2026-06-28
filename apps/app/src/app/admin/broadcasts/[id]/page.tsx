import { BroadcastDetailClient } from '@/components/admin/broadcasts/BroadcastDetailClient';

export default async function BroadcastAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BroadcastDetailClient id={id} />;
}
