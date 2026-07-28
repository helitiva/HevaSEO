import { StaffShell } from '@/components/staff/StaffShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds] = await Promise.all([getMyBroadcasts(), getMyBroadcastReadIds()]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <StaffShell>{children}</StaffShell>
    </BroadcastProvider>
  );
}
