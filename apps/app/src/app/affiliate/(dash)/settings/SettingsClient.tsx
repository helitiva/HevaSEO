'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import type { Affiliate } from '@/data/affiliateMock';
import type { AffiliatePayoutMethod } from '@/data/affiliate.server';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import {
  updateAffiliateProfileAction, setAffiliateCodeAction,
  addAffiliatePayoutMethodAction, setDefaultAffiliatePayoutMethodAction, removeAffiliatePayoutMethodAction,
} from '@/app/affiliate/(dash)/payout.actions';
import { startAffiliateOnboardingAction, refreshAffiliateConnectStatusAction } from '@/app/affiliate/(dash)/connect.actions';

type ConnectStatus = { hasAccount: boolean; payoutsEnabled: boolean };

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
export function SettingsClient({ me, editable = false, methods = [], connect = { hasAccount: false, payoutsEnabled: false } }: { me: Affiliate; editable?: boolean; methods?: AffiliatePayoutMethod[]; connect?: ConnectStatus }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();

  // Stripe Connect (inc-E19). When we return from hosted onboarding (?stripe=return), refresh status.
  const [busyConnect, setBusyConnect] = useState(false);
  useEffect(() => {
    if (params.get('stripe') === 'return') {
      void refreshAffiliateConnectStatusAction().then((r) => {
        if (r.ok) toast(r.enabled ? 'Payouts enabled — you can receive transfers.' : 'Onboarding saved; finish any remaining steps to enable payouts.', r.enabled ? 'success' : 'info');
        router.replace('/affiliate/settings');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startConnect = async () => {
    if (busyConnect) return;
    setBusyConnect(true);
    const res = await startAffiliateOnboardingAction();
    if (!res.ok) { setBusyConnect(false); toast(res.error, 'error'); return; }
    window.location.href = res.url;
  };

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

  // Email (inc-E18) — sign-in identity; goes through GoTrue's verified email-change flow (confirmation
  // link), and a trigger syncs profiles.email once confirmed.
  const [email, setEmail] = useState(me.email);
  const [savingEmail, setSavingEmail] = useState(false);
  const emailChanged = email.trim() !== me.email && /.+@.+\..+/.test(email.trim());
  const updateEmail = async () => {
    if (!editable || !emailChanged || savingEmail) return;
    setSavingEmail(true);
    const { error } = await createClient().auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(`Confirmation link sent to ${email.trim()}`, 'success');
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
            <div className="flex gap-2">
              <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" disabled={!editable} />
              {editable && emailChanged && (
                <button type="button" disabled={savingEmail} onClick={updateEmail}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                  <i className={`ph-bold ${savingEmail ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'}`} aria-hidden /> Update
                </button>
              )}
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">Changing your email sends a confirmation link to the new address; it takes effect once you confirm.</span>
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

        {/* Stripe Connect payout account (inc-E19) */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-lightning text-primary" aria-hidden /> Payout account (Stripe)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Connect Stripe so approved payouts land in your account automatically.</p>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2">
              <i className={`ph-bold ${connect.payoutsEnabled ? 'ph-check-circle text-emerald-500' : connect.hasAccount ? 'ph-clock text-amber-500' : 'ph-plug text-muted-foreground'}`} aria-hidden />
              {connect.payoutsEnabled ? 'Connected — payouts enabled' : connect.hasAccount ? 'Onboarding incomplete' : 'Not connected'}
            </span>
            {connect.payoutsEnabled && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">ready</span>}
          </div>
          {editable && (
            <button type="button" disabled={busyConnect} onClick={startConnect}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              <i className={`ph-bold ${busyConnect ? 'ph-circle-notch animate-spin' : 'ph-arrow-square-out'}`} aria-hidden />
              {connect.payoutsEnabled ? 'Manage account' : connect.hasAccount ? 'Finish onboarding' : 'Connect Stripe'}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
