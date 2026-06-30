import { StaffShell } from '@/components/staff/StaffShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts } from '@/data/broadcasts.server';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const broadcasts = await getMyBroadcasts(); // RLS-scoped: real broadcasts for the staff audience
  return (
    <BroadcastProvider broadcasts={broadcasts}>
      <StaffShell>{children}</StaffShell>
    </BroadcastProvider>
  );
}
