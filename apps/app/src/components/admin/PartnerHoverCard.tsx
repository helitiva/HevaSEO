'use client';

// Hover/focus dossier for an affiliate partner mention (e.g. "referred by @janeseo" on the
// Customers page). Wrap a name/handle; on hover it floats a partner summary — tier, refs,
// volume/commission/unclaimed, a volume trend chart (1M/3M/6M/1Y), and the service mix of the
// customers they referred — plus a one-click "Open dashboard" (impersonate, new tab). Money
// (figures + chart) is gated behind showMoney so the shared money-blind manager view stays clean.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { money as fmtMoney } from '@/data/adminMock';
import { tierFor } from '@/lib/affiliate';
import { affiliateById, partnerUnclaimed, partnerVolumeSeries } from '@/data/adminAffiliate';
import { impersonateAffiliate } from '@/lib/impersonation';
import { useShowMoney } from '@/lib/viewer';
import { PartnerVolumeChart } from './affiliate/PartnerVolumeChart';
import { ReferredServiceMix } from './affiliate/ReferredServiceMix';

const CARD_W = 360;

const STATUS_CLS: Record<string, string> = {
  active: 'pill-good', pending: 'pill-warn', suspended: 'pill',
};

export function PartnerHoverCard({ affiliateId, children, className = '' }: { affiliateId: string; children: ReactNode; className?: string }) {
  const showMoney = useShowMoney();
  const a = useMemo(() => affiliateById(affiliateId), [affiliateId]);
  const series = useMemo(() => (a ? partnerVolumeSeries(a) : []), [a]);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; flip: boolean }>({ left: 0, top: 0, flip: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const flip = window.innerHeight - r.bottom < 340 && r.top > 340;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - CARD_W - 8);
    setCoords({ left, top: flip ? r.top : r.bottom, flip });
  }, []);

  const show = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { place(); setOpen(true); }, 110); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };

  if (!a) return <span className={className}>{children}</span>;
  const tier = tierFor(a.volume);
  const unclaimed = partnerUnclaimed(a);

  const card = open && mounted ? createPortal(
    <div
      id={cardId} role="tooltip" onMouseEnter={show} onMouseLeave={hide}
      // React events bubble through the component tree, not the DOM — so without this a
      // click inside the portal would reach the clickable row behind it and open the panel.
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left: coords.left, top: coords.top, width: CARD_W, transform: coords.flip ? 'translateY(-100%)' : undefined }}
      className={`z-[90] ${coords.flip ? 'pb-2' : 'pt-2'}`}
    >
      <div className="pop-in max-h-[88vh] cursor-default overflow-y-auto rounded-2xl border border-border bg-card p-3 text-left shadow-xl">
        {/* header */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white" aria-hidden>{a.avatarInitials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{a.handle} · {a.platform}</p>
          </div>
          <span className={`pill shrink-0 capitalize ${STATUS_CLS[a.status] ?? 'pill'}`}>{a.status}</span>
        </div>

        {/* tier + refs */}
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-bold capitalize text-amber-600"><i className="ph-fill ph-crown-simple text-[11px]" />{tier.label} · {Math.round(tier.rate * 100)}%</span>
          <span className="text-[11px] text-muted-foreground">{a.refs} referrals</span>
        </div>

        {showMoney ? (
          <>
            <div className="mt-2 flex items-stretch divide-x divide-border/60 rounded-lg border border-border/60 text-center">
              <div className="flex-1 py-1.5"><p className="text-xs font-bold tabular-nums">{fmtMoney(a.volume)}</p><p className="text-[9px] text-muted-foreground">volume</p></div>
              <div className="flex-1 py-1.5"><p className="text-xs font-bold tabular-nums text-emerald-600">{fmtMoney(a.commission)}</p><p className="text-[9px] text-muted-foreground">commission</p></div>
              <div className="flex-1 py-1.5"><p className="text-xs font-bold tabular-nums text-amber-600">{fmtMoney(unclaimed)}</p><p className="text-[9px] text-muted-foreground">unclaimed</p></div>
            </div>

            {/* volume trend */}
            {a.volume > 0 && <div className="mt-2.5 rounded-lg border border-border/60 p-2"><PartnerVolumeChart series={series} heightClass="h-8" /></div>}
          </>
        ) : (
          <p className="mt-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">Earnings hidden in this view.</p>
        )}

        {/* service mix of referred customers */}
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Referred customers order</p>
          <ReferredServiceMix affiliateId={affiliateId} emptyHint="No referred orders yet." />
        </div>

        {/* action */}
        {showMoney && a.status !== 'pending' && (
          <button
            onClick={() => impersonateAffiliate(a.id)}
            className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <i className="ph-bold ph-arrow-square-out" aria-hidden />Open dashboard
          </button>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <span ref={triggerRef} className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-describedby={open ? cardId : undefined}>
      {children}
      {card}
    </span>
  );
}
