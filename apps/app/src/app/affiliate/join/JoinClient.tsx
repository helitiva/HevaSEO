'use client';
import { useState } from 'react';
import Link from 'next/link';
import { genCode, isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import { CopyButton } from '@/components/affiliate/CopyButton';
import { FauxQR } from '@/components/affiliate/FauxQR';

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'Blog'] as const;
const AUDIENCES = ['< 10k', '10k–50k', '50k–250k', '250k–500k', '500k+'] as const;
const NICHES = ['SEO', 'Marketing', 'Business', 'Tech', 'Lifestyle', 'Other'] as const;
const PAYOUTS = ['PayPal', 'Bank transfer', 'Crypto'] as const;

const labelCls = 'mb-1 block text-xs font-semibold text-muted-foreground';
const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary';

export function JoinClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState<string>('Instagram');
  const [handle, setHandle] = useState('');
  const [audience, setAudience] = useState<string>(AUDIENCES[1]);
  const [niche, setNiche] = useState<string>(NICHES[0]);
  const [promo, setPromo] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const [payout, setPayout] = useState<string>(PAYOUTS[0]);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState<null | { code: string; url: string }>(null);

  // Code auto-fills from the name until the user edits it themselves.
  const effectiveCode = (codeEdited ? code : genCode(name || 'partner')).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codeOk = isCodeValid(effectiveCode);
  const canSubmit = name.trim() && /\S+@\S+\.\S+/.test(email) && handle.trim() && codeOk && agree;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setDone({ code: effectiveCode, url: buildAffiliateUrl(effectiveCode) });
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <i className="ph-fill ph-check-circle text-2xl" aria-hidden />
          </span>
          <div>
            <h2 className="display text-xl font-bold">You&apos;re in, {name.split(' ')[0]} 🎉</h2>
            <p className="text-sm text-muted-foreground">Your affiliate link is live. Start sharing to earn.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <div>
              <p className={labelCls}>Your affiliate link</p>
              <div className="flex items-stretch gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                  <i className="ph-bold ph-link text-primary" aria-hidden />
                  <span className="truncate font-mono text-sm">{done.url}</span>
                </div>
                <CopyButton value={done.url} label="Copy" />
              </div>
            </div>
            <div>
              <p className={labelCls}>Your code</p>
              <div className="flex items-stretch gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2.5">
                  <span className="font-mono text-sm font-bold tracking-wider">{done.code}</span>
                </div>
                <CopyButton value={done.code} label="Copy" iconOnly />
              </div>
            </div>
          </div>
          <div className="hidden sm:block"><FauxQR seed={done.url} /></div>
        </div>

        <Link href="/affiliate"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          Go to your dashboard <i className="ph-bold ph-arrow-right" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="display text-xl font-bold">Create your affiliate account</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Instant approval — your link works the moment you sign up.</p>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="name">Full / display name</label>
            <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Rivera" />
          </div>
          <div>
            <label className={labelCls} htmlFor="email">Email</label>
            <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className={labelCls} htmlFor="platform">Primary platform</label>
            <select id="platform" className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="handle">Handle / channel</label>
            <input id="handle" className={inputCls} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@janeseo" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="audience">Audience size</label>
            <select id="audience" className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="niche">Niche / category</label>
            <select id="niche" className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)}>
              {NICHES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="promo">How will you promote HevaSEO? <span className="font-normal">(optional)</span></label>
          <textarea id="promo" rows={2} className={`${inputCls} resize-none`} value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="YouTube reviews, newsletter, client referrals…" />
        </div>

        <div>
          <label className={labelCls} htmlFor="code">Affiliate code</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">hevaseo.com/?ref=</span>
            <input
              id="code"
              className={`${inputCls} font-mono font-bold tracking-wider ${!codeOk && (codeEdited && code) ? 'border-rose-500' : ''}`}
              value={effectiveCode}
              onChange={(e) => { setCode(e.target.value); setCodeEdited(true); }}
            />
          </div>
          <p className={`mt-1 text-xs ${!codeOk && codeEdited && code ? 'text-rose-500' : 'text-muted-foreground'}`}>
            {!codeOk && codeEdited && code ? '3–20 letters and numbers only.' : 'Auto-filled from your name — edit it to make it yours.'}
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="payout">Preferred payout method</label>
          <select id="payout" className={inputCls} value={payout} onChange={(e) => setPayout(e.target.value)}>
            {PAYOUTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border text-primary" />
          <span className="text-muted-foreground">I agree to the <a href="#" className="font-semibold text-primary hover:underline">affiliate terms</a> and commission policy.</span>
        </label>
      </div>

      <button type="submit" disabled={!canSubmit}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        Create my affiliate link <i className="ph-bold ph-arrow-right" aria-hidden />
      </button>
    </form>
  );
}
