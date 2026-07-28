import { ManagerShell } from '@/components/manager/ManagerShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';
import { getManagerModes } from './modes.actions';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds, modes] = await Promise.all([
    getMyBroadcasts(), getMyBroadcastReadIds(), getManagerModes(),
  ]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <ManagerShell awayOn={modes.away} autoReviewOn={modes.autoReview}>{children}</ManagerShell>
    </BroadcastProvider>
  );
}
