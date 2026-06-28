'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MANAGER_NAV } from '@/data/managerNav';
import { filterNav } from '@/lib/rbac';

export function ManagerSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  // Same RBAC matrix as the admin sidebar — filtered for the manager role so the
  // money/org sections never even render. See lib/rbac.ts.
  const nav = filterNav(MANAGER_NAV, 'manager');
  const isActive = (href: string) => href === '/manager' ? pathname === '/manager' : pathname.startsWith(href);
  return (
    <aside className={`fixed inset-y-0 left-0 z-[60] flex w-52 shrink-0 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[68px] shrink-0 items-center gap-2 border-b border-border px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">H</span>
        <span className="display text-lg font-bold">HevaSEO <span className="text-emerald-600 dark:text-emerald-400">Manager</span></span>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {nav.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((i) => (
                <Link key={i.href} href={i.href} onClick={onClose} className={`nav-item ${isActive(i.href) ? 'active' : ''}`}>
                  <i className={`ph-bold ${i.icon}`} aria-hidden /> {i.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
