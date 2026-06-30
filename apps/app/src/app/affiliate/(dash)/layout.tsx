import { AffiliateShell } from '@/components/affiliate/AffiliateShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts } from '@/data/broadcasts.server';

// Wraps only the logged-in affiliate surface. The public /affiliate/join page lives
// OUTSIDE this route group, so it renders without the dashboard shell.
export default async function AffiliateDashLayout({ children }: { children: React.ReactNode }) {
  const broadcasts = await getMyBroadcasts(); // RLS-scoped: real broadcasts for the affiliate audience
  return (
    <BroadcastProvider broadcasts={broadcasts}>
      <AffiliateShell>{children}</AffiliateShell>
    </BroadcastProvider>
  );
}
