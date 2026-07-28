'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BroadcastBanner } from './broadcast/BroadcastBanner';
import { SiteAlertBar } from './broadcast/SiteAlertBar';
import { BroadcastToaster } from './broadcast/BroadcastToaster';
import { CUSTOMERS } from '@/data/adminMock';
import { readCustomerImpersonation, clearCustomerImpersonation } from '@/lib/impersonation';

interface Impersonation { id: string; company: string; name: string; initials: string }
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function PortalShell({ children, avatarUrl, name }: { children: React.ReactNode; avatarUrl?: string; name?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [imp, setImp] = useState<Impersonation | null>(null);

  // <main> is its own scroll container, so reset it to the top on navigation —
  // Next's window-level scroll restoration doesn't touch this nested scroller.
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);

  // Detect admin impersonation from the cookie set on the admin side.
  useEffect(() => {
    const id = readCustomerImpersonation();
    const c = id ? CUSTOMERS.find((x) => x.id === id) : null;
    setImp(c ? { id: c.id, company: c.company, name: c.name, initials: initialsOf(c.company) } : null);
  }, [pathname]);

  const exitImpersonation = () => { clearCustomerImpersonation(); window.location.reload(); };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setOpen(true)}
          identity={imp ? { company: imp.company, initials: imp.initials } : undefined}
          avatarUrl={avatarUrl}
          initials={name ? initialsOf(name) : undefined}
        />
        {imp && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 lg:px-5">
            <i className="ph-bold ph-user-switch" aria-hidden />
            <span>Admin view — impersonating <b>{imp.company}</b> ({imp.name}). Read-only preview of their portal.</span>
            <button onClick={exitImpersonation} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-background/60 px-2 py-0.5 font-semibold transition hover:bg-background">
              <i className="ph-bold ph-sign-out" aria-hidden />Exit
            </button>
          </div>
        )}
        <SiteAlertBar />
        <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-5">
          {pathname === '/dashboard' && <div className="mb-4"><BroadcastBanner /></div>}
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
      <BroadcastToaster />
    </div>
  );
}
