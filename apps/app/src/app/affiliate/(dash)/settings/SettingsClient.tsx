'use client';
import { useState } from 'react';
import { isCodeValid, buildAffiliateUrl } from '@/lib/affiliate';
import type { Affiliate } from '@/data/affiliateMock';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
    {children}
  </label>
);

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

export function SettingsClient({ me }: { me: Affiliate }) {
  const [code, setCode] = useState(me.code);
  const [saved, setSaved] = useState(false);
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = isCodeValid(normalized);
  const changed = normalized !== me.code;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Profile */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user text-primary" /> Profile</p>
        <div className="mt-4 space-y-3">
          <Field label="Display name"><input className={input} defaultValue={me.name} /></Field>
          <Field label="Email"><input className={input} defaultValue={me.email} type="email" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary platform"><input className={input} defaultValue={me.platform} /></Field>
            <Field label="Handle"><input className={input} defaultValue={me.handle} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience size"><input className={input} defaultValue={me.audience} /></Field>
            <Field label="Niche"><input className={input} defaultValue={me.niche} /></Field>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {/* Affiliate code */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-ticket text-primary" /> Affiliate code</p>
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
            <i className={`ph-bold ${saved ? 'ph-check' : 'ph-floppy-disk'}`} /> {saved ? 'Saved' : 'Save code'}
          </button>
        </section>

        {/* Payout method */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bank text-primary" /> Payout method</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2"><i className="ph-bold ph-paypal-logo text-[#003087]" /> {me.payoutLabel}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">default</span>
          </div>
          <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted">
            <i className="ph-bold ph-plus" /> Add payout method
          </button>
        </section>
      </div>
    </div>
  );
}
