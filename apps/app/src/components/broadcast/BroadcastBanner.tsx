'use client';
import Link from 'next/link';
import { useBanners } from '@/data/broadcastStore';
import { useBroadcastAudience } from '@/lib/broadcastAudience';
import { KIND_META } from '@/data/broadcasts';

// Overview banner popups — the `banner`-flagged messages for this surface's audience that
// haven't been dismissed. Styled by kind (congrats gets a celebratory accent). Mounted at the
// top of each portal's overview page.
export function BroadcastBanner() {
  const aud = useBroadcastAudience();
  const { banners, dismiss } = useBanners(aud);
  if (banners.length === 0) return null;

  return (
    <div className="space-y-2">
      {banners.map((b) => {
        const m = KIND_META[b.kind];
        return (
          <div key={b.id} className={`broadcast-pop relative overflow-hidden rounded-2xl border bg-gradient-to-r p-4 ${m.bannerClass}`}>
            <button onClick={() => dismiss(b.id)} aria-label="Dismiss message" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-background/60 hover:text-foreground">
              <i className="ph-bold ph-x" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}22`, color: m.color }}>
                <i className={`ph-fill ${m.icon} text-xl`} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span>{b.title}</span>
                  {m.celebratory && <i className="ph-fill ph-sparkle text-amber-400" aria-hidden />}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{b.body}</p>
                {b.cta && (
                  <Link href={b.cta.href} className="mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: m.color }}>
                    {b.cta.label} <i className="ph-bold ph-arrow-right" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
