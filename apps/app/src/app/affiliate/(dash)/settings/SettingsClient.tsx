'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import type { Affiliate } from '@/data/affiliateMock';
import type { AffiliatePayoutMethod } from '@/data/affiliate.server';
import { useToast } from '@/components/Toast';
import {
  updateAffiliateProfileAction, setAffiliateCodeAction,
  addAffiliatePayoutMethodAction, setDefaultAffiliatePayoutMethodAction, removeAffiliatePayoutMethodAction,
} from '@/app/affiliate/(dash)/payout.actions';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
    {children}
  </label>
);

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

const KINDS: { v: AffiliatePayoutMethod['kind']; label: string; icon: string }[] = [
  { v: 'paypal', label: 'PayPal', icon: 'ph-paypal-logo' },
  { v: 'bank', label: 'Bank', icon: 'ph-bank' },
  { v: 'wise', label: 'Wise', icon: 'ph-globe-hemisphere-west' },
  { v: 'crypto', label: 'Crypto', icon: 'ph-currency-btc' },
];
const kindMeta = (k: string) => KINDS.find((x) => x.v === k) ?? KINDS[0];

// `editable` gates the real Save (a genuine affiliate session); demo/impersonation views stay read-only.
export function SettingsClient({ me, editable = false, methods = [] }: { me: Affiliate; editable?: boolean; methods?: AffiliatePayoutMethod[] }) {
  const router = useRouter();
  const toast = useToast();

  // Payout methods (inc-E15).
  const [addKind, setAddKind] = useState<AffiliatePayoutMethod['kind']>('paypal');
  const [addDetail, setAddDetail] = useState('');
  const [busyMethod, setBusyMethod] = useState(false);
  const runMethod = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    if (busyMethod) return;
    setBusyMethod(true);
    const res = await fn();
    setBusyMethod(false);
    if (!res.ok) { toast(res.error ?? 'Something went wrong', 'error'); return; }
    toast(okMsg, 'success');
    router.refresh();
  };
  const addMethod = () => {
    if (!addDetail.trim()) return;
    void runMethod(() => addAffiliatePayoutMethodAction({ kind: addKind, detail: addDetail, makeDefault: methods.length === 0 }), 'Payout method added')
      .then(() => setAddDetail(''));
  };

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

        {/* Payout methods (inc-E15) */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bank text-primary" aria-hidden /> Payout methods</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Where we send your commission when you withdraw.</p>

          <div className="mt-3 space-y-2">
            {methods.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">No payout method yet — add one below.</p>}
            {methods.map((m) => {
              const meta = kindMeta(m.kind);
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><i className={`ph-bold ${meta.icon} text-primary`} aria-hidden /> <span className="truncate">{m.detail}</span></span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {m.isDefault
                      ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">default</span>
                      : editable && <button type="button" disabled={busyMethod} onClick={() => runMethod(() => setDefaultAffiliatePayoutMethodAction(m.id), 'Default updated')} className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold transition hover:bg-muted disabled:opacity-50">Make default</button>}
                    {editable && <button type="button" disabled={busyMethod} aria-label="Remove" onClick={() => runMethod(() => removeAffiliatePayoutMethodAction(m.id), 'Method removed')} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"><i className="ph-bold ph-trash" aria-hidden /></button>}
                  </span>
                </div>
              );
            })}
          </div>

          {editable && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button key={k.v} type="button" onClick={() => setAddKind(k.v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${addKind === k.v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                    <i className={`ph-bold ${k.icon}`} aria-hidden /> {k.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={addDetail} onChange={(e) => setAddDetail(e.target.value)} placeholder={addKind === 'paypal' || addKind === 'wise' ? 'email@example.com' : addKind === 'bank' ? 'IBAN / account number' : 'wallet address'} className={input} />
                <button type="button" disabled={!addDetail.trim() || busyMethod} onClick={addMethod}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
                  <i className={`ph-bold ${busyMethod ? 'ph-circle-notch animate-spin' : 'ph-plus'}`} aria-hidden /> Add
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
