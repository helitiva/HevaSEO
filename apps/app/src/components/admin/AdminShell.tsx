'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <AdminSidebar open={open} onClose={() => setOpen(false)} />
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setOpen(true)} />
        <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-5 sm:pb-6 lg:px-7">
          <div key={pathname} className="page-anim">{children}</div>
        </main>
      </div>
    </div>
  );
}
