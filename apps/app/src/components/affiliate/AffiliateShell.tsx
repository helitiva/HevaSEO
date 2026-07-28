'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AffiliateSidebar } from './AffiliateSidebar';
import { AffiliateTopbar, type AffiliateIdentity } from './AffiliateTopbar';
import { BroadcastBanner } from '../broadcast/BroadcastBanner';
import { SiteAlertBar } from '../broadcast/SiteAlertBar';
import { BroadcastToaster } from '../broadcast/BroadcastToaster';
import { adminAffiliates } from '@/data/adminAffiliate';
import { DEFAULT_AFFILIATE_ID } from '@/data/affiliatePortal';
import { readAffiliateImpersonation, clearAffiliateImpersonation } from '@/lib/impersonation';

const identityFor = (id: string): AffiliateIdentity => {
  const a = adminAffiliates().find((x) => x.id === id) ?? adminAffiliates().find((x) => x.id === DEFAULT_AFFILIATE_ID)!;
  return { name: a.name, handle: a.handle, platform: a.platform, avatarInitials: a.avatarInitials, volume: a.volume, impersonated: id !== DEFAULT_AFFILIATE_ID };
};

export function AffiliateShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  // Starts as the default partner (SSR-safe); the impersonation cookie is read after
  // mount, so an admin-impersonated view swaps in without a hydration mismatch.
  const [identity, setIdentity] = useState<AffiliateIdentity>(() => identityFor(DEFAULT_AFFILIATE_ID));

  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    const id = readAffiliateImpersonation() ?? DEFAULT_AFFILIATE_ID;
    setIdentity(identityFor(id));
  }, [pathname]);

  const exit = () => { clearAffiliateImpersonation(); window.location.reload(); };

  return (
    <div className="flex h-screen overflow-hidden">
      <AffiliateSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <AffiliateTopbar onMenu={() => setOpen(true)} identity={identity} />
        {identity.impersonated && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 lg:px-7">
            <i className="ph-bold ph-user-switch" aria-hidden />
            <span>Admin view — you&apos;re seeing <b>{identity.name}</b>&apos;s affiliate dashboard.</span>
            <button onClick={exit} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-background/60 px-2 py-0.5 font-semibold transition hover:bg-background">
              <i className="ph-bold ph-sign-out" aria-hidden />Exit
            </button>
          </div>
        )}
        <SiteAlertBar />
        <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-7">
          {pathname === '/affiliate' && <div className="mb-4"><BroadcastBanner /></div>}
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
      <BroadcastToaster />
    </div>
  );
}
