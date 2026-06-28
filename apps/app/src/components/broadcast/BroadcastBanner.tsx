'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useBanners, markBroadcastClicked } from '@/data/broadcastStore';
import { useBroadcastAudience } from '@/lib/broadcastAudience';
import { KIND_META, type Broadcast } from '@/data/broadcasts';

// Overview banner popups — the `banner`-flagged, non-critical messages for this surface's
// audience that haven't been dismissed. Critical kinds (maintenance/outage) show in the
// site-wide alert bar instead. When several stack up we collapse to the first + "N more".
export function BroadcastBanner() {
  const aud = useBroadcastAudience();
  const { banners, dismiss, acknowledge } = useBanners(aud);
  const [expanded, setExpanded] = useState(false);
  if (banners.length === 0) return null;

  const visible = expanded ? banners : banners.slice(0, 1);
  const hiddenCount = banners.length - visible.length;

  return (
    <div className="space-y-2">
      {visible.map((b) => (
        <BannerCard key={b.id} b={b} onDismiss={() => dismiss(b.id)} onAck={() => acknowledge(b.id)} onCta={() => markBroadcastClicked(aud, b.id)} />
      ))}
      {banners.length > 1 && (
        <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <i className={`ph-bold ${expanded ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />
          {expanded ? 'Show less' : `${hiddenCount} more message${hiddenCount > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

function BannerCard({ b, onDismiss, onAck, onCta }: { b: Broadcast; onDismiss: () => void; onAck: () => void; onCta: () => void }) {
  const m = KIND_META[b.kind];
  return (
    <div className={`broadcast-pop relative overflow-hidden rounded-2xl border bg-gradient-to-r p-4 ${m.bannerClass}`}>
      {!b.requireAck && (
        <button onClick={onDismiss} aria-label="Dismiss message" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-background/60 hover:text-foreground">
          <i className="ph-bold ph-x" aria-hidden />
        </button>
      )}
      <div className={`flex items-start gap-3 ${b.requireAck ? '' : 'pr-8'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}22`, color: m.color }}>
          <i className={`ph-fill ${m.icon} text-xl`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span>{b.title}</span>
            {m.celebratory && <i className="ph-fill ph-sparkle text-amber-400" aria-hidden />}
            {b.requireAck && <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Action required</span>}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{b.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {b.cta && (
              <Link href={b.cta.href} onClick={onCta} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: m.color }}>
                {b.cta.label} <i className="ph-bold ph-arrow-right" aria-hidden />
              </Link>
            )}
            {b.requireAck && (
              <button onClick={onAck} className="inline-flex items-center gap-1 rounded-lg border border-current px-2.5 py-1 text-xs font-semibold transition hover:bg-background/60" style={{ color: m.color }}>
                <i className="ph-bold ph-check" aria-hidden /> Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
