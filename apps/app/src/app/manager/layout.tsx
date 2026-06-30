import { ManagerShell } from '@/components/manager/ManagerShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts } from '@/data/broadcasts.server';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const broadcasts = await getMyBroadcasts(); // RLS-scoped: real broadcasts for the manager audience
  return (
    <BroadcastProvider broadcasts={broadcasts}>
      <ManagerShell>{children}</ManagerShell>
    </BroadcastProvider>
  );
}
