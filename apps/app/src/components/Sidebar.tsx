'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { NAV } from '@/data/nav';
import { CREDIT_BALANCE } from '@/data/mock';

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar"
      className={`flex w-52 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur-xl${open ? ' open' : ''}`}
    >
      <div className="flex h-[68px] items-center gap-2 border-b border-border px-4">
        <Logo />
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="ml-auto grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"
        >
          <i className="ph-bold ph-x" />
        </button>
      </div>

      <div className="px-2.5 pt-3">
        <Link
          href="/services"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-[13px] font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-px hover:bg-primary/90 active:scale-[.98]"
        >
          <i className="ph-bold ph-plus" /> Order service
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-4 pt-3">
        {NAV.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground first:pt-1">
              {section.title}
            </p>
            {section.items.map((item) => {
              const base = item.href.split('?')[0];
              const active = !item.href.includes('?') && pathname === base;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className={`nav-item${active ? ' active' : ''}`}
                >
                  <i className={`ph-bold ${item.icon}`} /> {item.label}
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2.5">
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Credit</p>
            <span className="pill pill-good">Pro</span>
          </div>
          <p className="mt-1 text-lg font-semibold tracking-tight">${CREDIT_BALANCE.toLocaleString('en-US')}</p>
          <div className="bar mt-2"><i style={{ width: '62%' }} /></div>
          <Link
            href="/credit"
            className="mt-2.5 block w-full rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"
          >
            Top up
          </Link>
        </div>
      </div>
    </aside>
  );
}
