'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { StaffSidebar } from './StaffSidebar';
import { StaffTopbar } from './StaffTopbar';

export function StaffShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // <main> is its own scroll container, so Next's window-level scroll restoration
  // doesn't reset it on navigation — the previous page's scrollTop would leave the
  // new page's top (e.g. "Back to tasks") hidden under the sticky topbar. Reset it.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <StaffSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar onMenu={() => setOpen(true)} />
        <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-7">
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
    </div>
  );
}
