import { BroadcastsManager } from '@/components/admin/broadcasts/BroadcastsManager';
import { getBroadcasts } from '@/data/broadcasts.server';
import { getBroadcastReadCounts } from '@/data/broadcastAnalytics.server';

export const metadata = { title: 'Broadcasts' };

// Lane C inc-C5/C6 — admin sees ALL tenant broadcasts (incl recalled) + real read/click counts.
export default async function AdminBroadcastsPage() {
  const [broadcasts, counts] = await Promise.all([getBroadcasts(), getBroadcastReadCounts()]);
  return <BroadcastsManager broadcasts={broadcasts} counts={counts} />;
}
