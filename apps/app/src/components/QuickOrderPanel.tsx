'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SERVICES, type ServiceKey } from '@/data/mock';
import { SERVICE_BLURBS, SERVICE_CATALOG, getCatalog } from '@/data/services';
import { ServiceOrder } from './ServiceOrder';

const LIVE_KEYS = (Object.keys(SERVICES) as ServiceKey[]).filter((k) => !!SERVICE_CATALOG[k]);

/**
 * Quick-order slide-over, driven by the `?neworder=` URL param:
 *   - `?neworder=pick` (or any non-service value) → opens the service picker
 *   - `?neworder=<serviceKey>` → opens straight into that service's order form
 * Pick a service, fill the same form used on /services/[svc]. Placing closes the panel.
 */
export function QuickOrderPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get('neworder');
  const open = param != null;
  const preset = param && param in SERVICE_CATALOG ? (param as ServiceKey) : null;

  const [svc, setSvc] = useState<ServiceKey | null>(preset);
  const [closing, setClosing] = useState(false);

  // Re-sync whenever the panel (re)opens — e.g. "Order again" presets the service.
  useEffect(() => { if (open) { setSvc(preset); setClosing(false); } }, [param]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => router.push(pathname, { scroll: false }), 230);
  }, [pathname, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  const catalog = svc ? getCatalog(svc) : undefined;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 bg-black/60 backdrop-blur-sm`} onClick={close} />
      <aside className={`${closing ? 'order-panel-out' : 'order-panel'} scrollbar-thin absolute right-0 top-0 flex h-full w-full flex-col overflow-y-auto border-l border-border bg-card max-w-[680px] ${catalog ? 'lg:max-w-[760px]' : ''}`}>
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-[30px]">
          {catalog ? (
            <button onClick={() => setSvc(null)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <i className="ph-bold ph-arrow-left" /> Services
            </button>
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><i className="ph-bold ph-plus text-lg" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">New order</p>
            <h2 className="display truncate text-lg font-semibold tracking-tight">{catalog ? catalog.name : 'Pick a service'}</h2>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-x" /></button>
        </div>

        <div className="p-5 sm:p-[30px]">
          {!catalog ? (
            /* step 1 — service picker */
            <div className="grid gap-3 sm:grid-cols-2">
              {LIVE_KEYS.map((k) => {
                const s = SERVICES[k];
                return (
                  <button
                    key={k}
                    onClick={() => setSvc(k)}
                    className="group flex flex-col rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><i className={`ph-bold ${s.icon} text-xl`} /></span>
                    <p className="mt-3 font-semibold">{s.label}</p>
                    <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">{SERVICE_BLURBS[k]}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                      Order now <i className="ph-bold ph-arrow-right transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* step 2 — the order form */
            <>
              <p className="mb-4 text-sm text-muted-foreground">{catalog.hero}</p>
              <ServiceOrder catalog={catalog} onPlaced={close} stacked />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
