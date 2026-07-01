'use client';
import { useState } from 'react';
import { AFFILIATE_TIERS, type TierId } from '@/lib/affiliate';
import { setPartnerTier } from '@/data/affiliateAdminStore';
import { TierBadge } from './shared';

// A small popover that shows a partner's effective tier with an "override" badge when
// pinned, and lets the admin pick any of the 4 tiers or revert to volume-derived (auto).
// onSetTier is supplied by the console (real fn in realMode); falls back to the localStorage mock.
export function TierEditControl({ partnerId, tier, rate, overridden, onSetTier }: {
  partnerId: string; tier: TierId; rate: number; overridden: boolean;
  onSetTier?: (id: string, tier: TierId | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const applyTier = (next: TierId | null) => (onSetTier ?? setPartnerTier)(partnerId, next);

  return (
    <div className="relative inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <TierBadge tier={tier} rate={rate} />
      {overridden && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary" title="Tier pinned by admin (overrides volume)">override</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Edit tier"
        aria-expanded={open}
        className="grid h-5 w-5 place-items-center rounded border border-border text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <i className="ph-bold ph-pencil-simple" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[50] mt-1 w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl">
            <p className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Set tier</p>
            {AFFILIATE_TIERS.map((t) => { const on = t.id === tier && overridden; return (
              <button
                key={t.id} type="button"
                onClick={() => { applyTier(t.id); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold capitalize transition hover:bg-accent ${on ? 'text-primary' : ''}`}
              >
                <span className="flex items-center gap-1.5"><i className="ph-fill ph-crown-simple text-[10px]" aria-hidden />{t.label}</span>
                <span className="text-[10px] text-muted-foreground">{Math.round(t.rate * 100)}%</span>
              </button>
            ); })}
            <button
              type="button"
              onClick={() => { applyTier(null); setOpen(false); }}
              disabled={!overridden}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:opacity-40"
            >
              <i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Auto (by volume)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
