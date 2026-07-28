import { AffiliateShell } from '@/components/affiliate/AffiliateShell';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { ToastProvider } from '@/components/Toast';
import { getMyBroadcasts, getMyBroadcastReadIds } from '@/data/broadcasts.server';

// Wraps only the logged-in affiliate surface. The public /affiliate/join page lives
// OUTSIDE this route group, so it renders without the dashboard shell.
// ToastProvider is required here — affiliate settings (and other dash pages) call useToast; without it
// the page 500s with "useToast must be used within ToastProvider".
export default async function AffiliateDashLayout({ children }: { children: React.ReactNode }) {
  const [broadcasts, readIds] = await Promise.all([getMyBroadcasts(), getMyBroadcastReadIds()]);
  return (
    <BroadcastProvider broadcasts={broadcasts} readIds={readIds}>
      <ToastProvider>
        <AffiliateShell>{children}</AffiliateShell>
      </ToastProvider>
    </BroadcastProvider>
  );
}
