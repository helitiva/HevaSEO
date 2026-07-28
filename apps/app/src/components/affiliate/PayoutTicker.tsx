'use client';
import { useEffect, useState } from 'react';
import { money } from '@/data/adminMock';
import { recentPayoutTicks } from '@/data/affiliatePulse';

// Rotating "someone just got paid" ticker — social proof + urgency on the join page.
export function PayoutTicker() {
  const ticks = recentPayoutTicks();
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % ticks.length), 2600);
    return () => clearInterval(id);
  }, [ticks.length]);

  const t = ticks[i];
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1.5 text-xs">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span key={t.who} className="page-anim font-medium">
        <b>{t.who}</b> just earned <b className="text-emerald-600">{money(t.amount)}</b>
        <span className="text-muted-foreground"> · {t.ago}</span>
      </span>
    </div>
  );
}
