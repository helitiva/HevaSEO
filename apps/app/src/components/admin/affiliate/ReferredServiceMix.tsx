'use client';
import { useMemo } from 'react';
import { referredServiceMix } from '@/data/adminAffiliate';

// What the customers a partner referred actually order, as labelled % bars.
// Counts/percentages only (no money) so it is safe in the money-blind view.
export function ReferredServiceMix({ affiliateId, limit = 5, emptyHint }: {
  affiliateId: string;
  limit?: number;
  emptyHint?: string;
}) {
  const mix = useMemo(() => referredServiceMix(affiliateId), [affiliateId]);

  if (mix.length === 0) {
    return emptyHint ? <p className="text-[11px] text-muted-foreground">{emptyHint}</p> : null;
  }

  return (
    <div className="space-y-1.5">
      {mix.slice(0, limit).map((m) => (
        <div key={m.service} title={`${m.count} orders · ${m.pct}%`}>
          <div className="flex items-center gap-1.5 text-xs">
            <i className={`ph-fill ${m.icon} shrink-0`} style={{ color: m.color }} aria-hidden />
            <span className="truncate font-medium capitalize">{m.service}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{m.count} · {m.pct}%</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} /></div>
        </div>
      ))}
    </div>
  );
}
