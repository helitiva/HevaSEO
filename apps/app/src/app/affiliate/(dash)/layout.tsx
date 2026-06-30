import { AffiliateShell } from '@/components/affiliate/AffiliateShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';

// Wraps only the logged-in affiliate surface. The public /affiliate/join page lives
// OUTSIDE this route group, so it renders without the dashboard shell.
export default async function AffiliateDashLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds] = await Promise.all([getMyBroadcasts(), getMyBroadcastReadIds()]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <AffiliateShell>{children}</AffiliateShell>
    </BroadcastProvider>
  );
}
