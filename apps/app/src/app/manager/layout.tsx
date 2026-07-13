import { ManagerShell } from '@/components/manager/ManagerShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';
import { getAwayAutoAssign } from './away.actions';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds, awayOn] = await Promise.all([
    getMyBroadcasts(), getMyBroadcastReadIds(), getAwayAutoAssign(),
  ]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <ManagerShell awayOn={awayOn}>{children}</ManagerShell>
    </BroadcastProvider>
  );
}
