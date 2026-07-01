'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import type { Affiliate } from '@/data/affiliateMock';
import { useToast } from '@/components/Toast';
import { updateAffiliateProfileAction } from '@/app/affiliate/(dash)/payout.actions';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
    {children}
  </label>
);

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

// `editable` gates the real Save (a genuine affiliate session); demo/impersonation views stay read-only.
export function SettingsClient({ me, editable = false }: { me: Affiliate; editable?: boolean }) {
  const [code, setCode] = useState(me.code);
  const [saved, setSaved] = useState(false);
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = isCodeValid(normalized);
  const changed = normalized !== me.code;

  // Marketing profile (inc-E12) — the only fields wired to the backend so far.
  const router = useRouter();
  const toast = useToast();
  const [platform, setPlatform] = useState(me.platform === '—' ? '' : me.platform);
  const [niche, setNiche] = useState(me.niche === '—' ? '' : me.niche);
  const [audience, setAudience] = useState(me.audience === '—' ? '' : me.audience);
  const [savingProfile, setSavingProfile] = useState(false);
  const profileDirty = platform !== (me.platform === '—' ? '' : me.platform)
    || niche !== (me.niche === '—' ? '' : me.niche)
    || audience !== (me.audience === '—' ? '' : me.audience);
  const saveProfile = async () => {
    if (!editable || !profileDirty || savingProfile) return;
    setSavingProfile(true);
    const res = await updateAffiliateProfileAction({ platform, niche, audience });
    setSavingProfile(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast('Profile saved', 'success');
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Profile */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user text-primary" aria-hidden /> Profile</p>
        <div className="mt-4 space-y-3">
          <Field label="Display name"><input className={input} defaultValue={me.name} /></Field>
          <Field label="Email"><input className={input} defaultValue={me.email} type="email" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary platform"><input className={input} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. YouTube" /></Field>
            <Field label="Handle"><input className={input} defaultValue={me.handle} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience size"><input className={input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 120k subscribers" /></Field>
            <Field label="Niche"><input className={input} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. SEO & Marketing" /></Field>
          </div>
          {editable && (
            <button type="button" disabled={!profileDirty || savingProfile} onClick={saveProfile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              <i className={`ph-bold ${savingProfile ? 'ph-circle-notch animate-spin' : 'ph-floppy-disk'}`} aria-hidden /> {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {/* Affiliate code */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-ticket text-primary" aria-hidden /> Affiliate code</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Your shareable code. Keep it short and memorable.</p>
          <div className="mt-3">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setSaved(false); }}
              className={`${input} font-mono font-bold tracking-wider ${!valid && code ? 'border-rose-500' : ''}`}
            />
            <p className={`mt-1.5 text-xs ${!valid && code ? 'text-rose-500' : 'text-muted-foreground'}`}>
              {!valid && code
                ? '3–20 letters and numbers only.'
                : <>Link: <span className="font-mono">{buildAffiliateUrl(normalized || me.code)}</span></>}
            </p>
          </div>
          <button
            type="button" disabled={!valid || !changed || saved} onClick={() => setSaved(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <i className={`ph-bold ${saved ? 'ph-check' : 'ph-floppy-disk'}`} aria-hidden /> {saved ? 'Saved' : 'Save code'}
          </button>
        </section>

        {/* Payout method */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bank text-primary" aria-hidden /> Payout method</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2"><i className="ph-bold ph-paypal-logo text-[#003087]" aria-hidden /> {me.payoutLabel}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">default</span>
          </div>
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted">
            <i className="ph-bold ph-plus" aria-hidden /> Add payout method
          </button>
        </section>
      </div>
    </div>
  );
}
