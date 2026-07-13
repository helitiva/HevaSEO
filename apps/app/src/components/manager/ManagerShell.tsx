'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ManagerSidebar } from './ManagerSidebar';
import { ManagerTopbar } from './ManagerTopbar';
import { BroadcastBanner } from '../broadcast/BroadcastBanner';
import { SiteAlertBar } from '../broadcast/SiteAlertBar';
import { BroadcastToaster } from '../broadcast/BroadcastToaster';
import { ViewerProvider } from '@/lib/viewer';

export function ManagerShell({ children, awayOn = false }: { children: React.ReactNode; awayOn?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  // Reset the nested <main> scroll on route change (same reason as AdminShell).
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);
  return (
    <ViewerProvider role="manager">
    <div className="flex h-[100dvh] overflow-hidden">
      <ManagerSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <ManagerTopbar onMenu={() => setOpen(true)} awayOn={awayOn} />
        <SiteAlertBar />
        <main ref={mainRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-5 sm:pb-6 lg:px-7">
          {pathname === '/manager' && <div className="mb-4"><BroadcastBanner /></div>}
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
      <BroadcastToaster />
    </div>
    </ViewerProvider>
  );
}
