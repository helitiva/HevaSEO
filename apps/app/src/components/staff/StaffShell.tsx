'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { StaffSidebar } from './StaffSidebar';
import { StaffTopbar } from './StaffTopbar';
import { BroadcastBanner } from '../broadcast/BroadcastBanner';
import { STAFF } from '@/data/adminMock';
import { readImpersonation, readImpersonationMode, clearImpersonation } from '@/lib/impersonation';
import { StaffViewOnlyProvider } from '@/lib/staffView';

interface Impersonation { id: string; name: string; initials: string; viewOnly: boolean }
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function StaffShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [imp, setImp] = useState<Impersonation | null>(null);

  // <main> is its own scroll container, so Next's window-level scroll restoration
  // doesn't reset it on navigation — the previous page's scrollTop would leave the
  // new page's top (e.g. "Back to tasks") hidden under the sticky topbar. Reset it.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // Detect impersonation from the cookie set on the admin/manager side. 'view'
  // mode = a manager looking in: read-only, finance hidden.
  useEffect(() => {
    const id = readImpersonation();
    const s = id ? STAFF.find((x) => x.id === id) : null;
    setImp(s ? { id: s.id, name: s.name, initials: initialsOf(s.name), viewOnly: readImpersonationMode() === 'view' } : null);
  }, [pathname]);

  const exitImpersonation = () => { clearImpersonation(); window.location.reload(); };
  const viewOnly = imp?.viewOnly ?? false;

  return (
    <StaffViewOnlyProvider viewOnly={viewOnly}>
    <div className="flex h-screen overflow-hidden">
      <StaffSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar onMenu={() => setOpen(true)} identity={imp ? { name: imp.name, initials: imp.initials } : undefined} />
        {imp && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 lg:px-7">
            <i className="ph-bold ph-user-switch" aria-hidden />
            {viewOnly ? (
              <span>Manager view — observing <b>{imp.name}</b>’s portal. Read-only; their finance is hidden and you can’t act on their behalf.</span>
            ) : (
              <span>Admin view — impersonating <b>{imp.name}</b>. You&apos;re seeing their portal (read-only preview).</span>
            )}
            <button onClick={exitImpersonation} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-background/60 px-2 py-0.5 font-semibold transition hover:bg-background">
              <i className="ph-bold ph-sign-out" aria-hidden />Exit
            </button>
          </div>
        )}
        <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-6 lg:px-7">
          {pathname === '/staff' && <div className="mb-4"><BroadcastBanner /></div>}
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
    </div>
    </StaffViewOnlyProvider>
  );
}
