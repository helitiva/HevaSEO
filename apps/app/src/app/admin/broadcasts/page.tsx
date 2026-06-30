import { BroadcastsManager } from '@/components/admin/broadcasts/BroadcastsManager';
import { getBroadcasts } from '@/data/broadcasts.server';

export const metadata = { title: 'Broadcasts' };

// Lane C inc-C5 — admin sees ALL tenant broadcasts (incl recalled) and manages them via real CRUD.
export default async function AdminBroadcastsPage() {
  const broadcasts = await getBroadcasts();
  return <BroadcastsManager broadcasts={broadcasts} />;
}
