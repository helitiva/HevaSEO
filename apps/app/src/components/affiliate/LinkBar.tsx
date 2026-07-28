'use client';
import { useEffect, useState } from 'react';
import { CopyButton } from './CopyButton';
import { FauxQR } from './FauxQR';
import { buildTrackedUrl, buildDeepLink } from '@/lib/affiliate';
import { LINK_TARGETS } from '@/data/affiliateMock';

export function LinkBar({ code }: { code: string }) {
  // Tracked share link (inc-E16): app origin from env, else the current window origin after mount.
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_ORIGIN ?? '');
  useEffect(() => { if (!origin && typeof window !== 'undefined') setOrigin(window.location.origin); }, [origin]);
  const url = buildTrackedUrl(code, origin);
  const [targetPath, setTargetPath] = useState(LINK_TARGETS[1].path); // default: Free SEO audit
  const deepLink = buildDeepLink(code, targetPath);

  const share = (kind: 'x' | 'facebook' | 'whatsapp' | 'email') => {
    const text = encodeURIComponent('I trust HevaSEO for SEO — get started with my link:');
    const u = encodeURIComponent(url);
    const href =
      kind === 'x' ? `https://twitter.com/intent/tweet?text=${text}&url=${u}`
      : kind === 'facebook' ? `https://www.facebook.com/sharer/sharer.php?u=${u}`
      : kind === 'whatsapp' ? `https://wa.me/?text=${text}%20${u}`
      : `mailto:?subject=${encodeURIComponent('A tool I recommend')}&body=${text}%20${u}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const SHARE = [
    { kind: 'x', icon: 'ph-x-logo', label: 'Share on X' },
    { kind: 'facebook', icon: 'ph-facebook-logo', label: 'Share on Facebook' },
    { kind: 'whatsapp', icon: 'ph-whatsapp-logo', label: 'Share on WhatsApp' },
    { kind: 'email', icon: 'ph-envelope-simple', label: 'Share by email' },
  ] as const;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-500/[0.08] via-card to-card">
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:gap-7 md:p-6">
        {/* Link + code + share */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
            </span>
            <p className="text-xs text-muted-foreground">Your affiliate link & code</p>
          </div>

          <div className="mt-3 flex flex-wrap items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <i className="ph-bold ph-link text-primary" aria-hidden />
              <span className="truncate font-mono text-sm">{url}</span>
            </div>
            <CopyButton value={url} label="Copy link" />
          </div>

          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5">
              <i className="ph-bold ph-ticket text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Code</span>
              <span className="font-mono text-sm font-bold tracking-wider">{code}</span>
            </div>
            <CopyButton value={code} label="Copy code" iconOnly />
            <div className="flex-1" />
            <div className="flex items-center gap-1.5">
              {SHARE.map((s) => (
                <button key={s.kind} type="button" onClick={() => share(s.kind)} aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground">
                  <i className={`ph-bold ${s.icon}`} aria-hidden />
                </button>
              ))}
            </div>
          </div>

          {/* Deep-link builder */}
          <div className="mt-4 rounded-xl border border-border bg-card/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <i className="ph-bold ph-magic-wand" aria-hidden /> Build a tracked link to any page
            </p>
            <div className="flex flex-wrap items-stretch gap-2">
              <div className="flex flex-wrap gap-1.5">
                {LINK_TARGETS.map((t) => (
                  <button key={t.path} type="button" onClick={() => setTargetPath(t.path)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      targetPath === t.path ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    <i className={`ph-bold ${t.icon}`} aria-hidden /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span className="truncate font-mono text-xs text-muted-foreground">{deepLink}</span>
              </div>
              <CopyButton value={deepLink} label="Copy" iconOnly />
            </div>
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center justify-center gap-2 md:border-l md:border-border md:pl-7">
          <FauxQR seed={url} />
          <p className="text-center text-[11px] text-muted-foreground">Scan to open<br />your link</p>
        </div>
      </div>
    </section>
  );
}
