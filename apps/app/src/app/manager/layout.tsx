import { ManagerShell } from '@/components/manager/ManagerShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds] = await Promise.all([getMyBroadcasts(), getMyBroadcastReadIds()]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <ManagerShell>{children}</ManagerShell>
    </BroadcastProvider>
  );
}
