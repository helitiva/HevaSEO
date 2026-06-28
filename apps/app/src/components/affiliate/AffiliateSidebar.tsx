'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AFFILIATE_NAV } from '@/data/affiliateNav';

export function AffiliateSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  // The affiliate surface is a single fixed persona — no RBAC filtering (it's not a
  // role yet, by design). Consume the nav directly. See data/affiliateNav.ts.
  const isActive = (href: string) =>
    href === '/affiliate' ? pathname === '/affiliate' : pathname.startsWith(href);

  return (
    <aside className={`fixed inset-y-0 left-0 z-[60] w-40 shrink-0 border-r border-border bg-card transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[68px] items-center gap-2 border-b border-border px-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">H</span>
        <span className="display text-sm font-bold leading-tight">HevaSEO <span className="text-primary">Partners</span></span>
      </div>
      <nav className="space-y-4 p-2">
        {AFFILIATE_NAV.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((i) => (
                <Link key={i.href} href={i.href} onClick={onClose} className={`nav-item ${isActive(i.href) ? 'active' : ''}`}>
                  <i className={`ph-bold ${i.icon}`} /> {i.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
