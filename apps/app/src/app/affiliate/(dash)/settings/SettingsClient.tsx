'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import type { Affiliate } from '@/data/affiliateMock';
import { useToast } from '@/components/Toast';
import { updateAffiliateProfileAction, setAffiliateCodeAction } from '@/app/affiliate/(dash)/payout.actions';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
    {children}
  </label>
);

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

// `editable` gates the real Save (a genuine affiliate session); demo/impersonation views stay read-only.
export function SettingsClient({ me, editable = false }: { me: Affiliate; editable?: boolean }) {
  const router = useRouter();
  const toast = useToast();

  // Profile (inc-E12/E14): display name + marketing metadata, saved together.
  const clean = (v: string) => (v === '—' ? '' : v);
  const [name, setName] = useState(me.name);
  const [platform, setPlatform] = useState(clean(me.platform));
  const [niche, setNiche] = useState(clean(me.niche));
  const [audience, setAudience] = useState(clean(me.audience));
  const [savingProfile, setSavingProfile] = useState(false);
  const profileDirty = name !== me.name || platform !== clean(me.platform)
    || niche !== clean(me.niche) || audience !== clean(me.audience);
  const saveProfile = async () => {
    if (!editable || !profileDirty || savingProfile || !name.trim()) return;
    setSavingProfile(true);
    const res = await updateAffiliateProfileAction({ name, platform, niche, audience });
    setSavingProfile(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast('Profile saved', 'success');
    router.refresh();
  };

  // Referral code (inc-E14) — real edit, unique per tenant.
  const [code, setCode] = useState(me.code);
  const [savingCode, setSavingCode] = useState(false);
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = isCodeValid(normalized);
  const changed = normalized !== me.code;
  const saveCode = async () => {
    if (!editable || !valid || !changed || savingCode) return;
    setSavingCode(true);
    const res = await setAffiliateCodeAction(normalized);
    setSavingCode(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast('Code updated', 'success');
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Profile */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user text-primary" aria-hidden /> Profile</p>
        <div className="mt-4 space-y-3">
          <Field label="Display name"><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></Field>
          <Field label="Email">
            <input className={`${input} cursor-not-allowed opacity-70`} value={me.email} type="email" readOnly disabled />
            <span className="mt-1 block text-[11px] text-muted-foreground">Contact support to change your sign-in email.</span>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary platform"><input className={input} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. YouTube" /></Field>
            <Field label="Handle"><input className={`${input} cursor-not-allowed opacity-70`} value={me.handle} readOnly disabled /></Field>
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
              onChange={(e) => setCode(e.target.value)}
              className={`${input} font-mono font-bold tracking-wider ${!valid && code ? 'border-rose-500' : ''}`}
            />
            <p className={`mt-1.5 text-xs ${!valid && code ? 'text-rose-500' : 'text-muted-foreground'}`}>
              {!valid && code
                ? '3–20 letters and numbers only.'
                : <>Link: <span className="font-mono">{buildAffiliateUrl(normalized || me.code)}</span></>}
            </p>
          </div>
          {editable && (
            <button
              type="button" disabled={!valid || !changed || savingCode} onClick={saveCode}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <i className={`ph-bold ${savingCode ? 'ph-circle-notch animate-spin' : 'ph-floppy-disk'}`} aria-hidden /> {savingCode ? 'Saving…' : 'Save code'}
            </button>
          )}
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
