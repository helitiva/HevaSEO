'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // <main> is its own scroll container, so reset it to the top on navigation —
  // Next's window-level scroll restoration doesn't touch this nested scroller.
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);

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
        <Topbar onMenu={() => setOpen(true)} />
        <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-7">
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
    </div>
  );
}
