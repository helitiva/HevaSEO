'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import { topUpAction } from '@/app/(portal)/credit.actions';
import { getMyBillingAction, updateBillingAction } from '@/app/(portal)/profile.actions';
import { billingComplete, type BillingForm } from '@/lib/billing';
import { StripeTopUp, stripeConfigured } from './StripeTopUp';

const PRESETS = [20, 80, 200, 400, 800];
type Method = 'card' | 'paypal';

function detectBrand(num: string): 'visa' | 'mastercard' | 'amex' | null {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return null;
}

function BrandMark({ brand }: { brand: string }) {
  const base = 'inline-flex h-5 items-center rounded px-1.5 text-[9px] font-bold tracking-wide';
  if (brand === 'visa') return <span className={`${base} bg-[#1434cb] text-white`}>VISA</span>;
  if (brand === 'mastercard') return <span className={`${base} bg-[#eb001b] text-white`}>MC</span>;
  if (brand === 'amex') return <span className={`${base} bg-[#1f72cd] text-white`}>AMEX</span>;
  return null;
}

/**
 * Top-up form with amount + payment method (card / PayPal / express wallets).
 * `embedded` drops the outer card + heading so it can live inside a modal;
 * `onDone` fires after a successful (mock) payment.
 */
export function TopUp({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void } = {}) {
  const [amount, setAmount] = useState(80);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<Method>('card');
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const toast = useToast();
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  // Billing gate: a top-up needs complete billing (invoice + charge details). Load the saved billing; if
  // it's incomplete the user fills it here first, otherwise we prefill the card widget from it.
  const [billing, setBilling] = useState<BillingForm | null>(null);
  useEffect(() => { getMyBillingAction().then((r) => setBilling(r.billing)); }, []);
  const billingReady = billing ? billingComplete(billing) : false;

  const pick = (n: number) => { setAmount(n); setCustom(''); };
  const onCustom = (v: string) => {
    setCustom(v);
    const n = Number(v);
    if (n >= 5) setAmount(n);
  };
  const tooLow = custom !== '' && Number(custom) < 5;
  const brand = detectBrand(card);

  const fmtCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  // Real top-up: the server charges via the payment provider (mock/Stripe) then credits via the
  // topup fn + writes an invoice. The balance/history refresh from the real read on router.refresh().
  const pay = async (label: string) => {
    if (tooLow || !(amount > 0) || paying) return;
    setPaying(true);
    const res = await topUpAction(amount, label);
    setPaying(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast(`Topped up $${res.amount} — added to your balance`, 'success');
    onDone?.();
    router.refresh();
  };
  const cardLabel = () => {
    const last4 = card.replace(/\D/g, '').slice(-4);
    return last4 ? `${brand ? brand[0].toUpperCase() + brand.slice(1) : 'Card'} •••• ${last4}` : 'Card payment';
  };

  const body = (
    <>
      {/* amount */}
      <p className={`${embedded ? '' : 'mt-5'} mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground`}>Choose an amount</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {PRESETS.map((n) => (
          <button key={n} type="button" onClick={() => pick(n)} className={`amt${amount === n && custom === '' ? ' active' : ''}`}>${n}</button>
        ))}
      </div>
      <div className="mt-3">
        <label className="text-[11px] font-medium text-muted-foreground">Or enter another amount ($)</label>
        <input value={custom} onChange={(e) => onCustom(e.target.value)} type="number" min={5} step={5} className="field mt-1" placeholder="e.g. 150" />
        {tooLow && <p className="mt-1 text-[11px] font-medium text-destructive">Minimum top-up is $5.</p>}
      </div>

      {billing === null ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><i className="ph-bold ph-circle-notch animate-spin" aria-hidden /> Loading billing…</p>
      ) : !billingReady ? (
        <BillingGate initial={billing} onSaved={setBilling} />
      ) : (<>
      {/* method switch */}
      <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Payment method</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod('card')}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition ${method === 'card' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}
        >
          <i className="ph-bold ph-credit-card text-base" aria-hidden /> Card
        </button>
        <button
          type="button"
          onClick={() => setMethod('paypal')}
          className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition ${method === 'paypal' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'}`}
        >
          <span className="text-[#003087]">Pay</span><span className="text-[#0070e0]">Pal</span>
        </button>
      </div>

      {method === 'card' ? (
        stripeConfigured() ? (
          // Stripe Payment Element — Link + card + Apple/Google Pay in one embedded widget
          <StripeTopUp amount={amount} onDone={onDone} billing={billing} />
        ) : (
        <>
          {/* express wallets */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pay('Apple Pay')} className="flex items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              <i className="ph-fill ph-apple-logo text-base" aria-hidden /> Pay
            </button>
            <button type="button" onClick={() => pay('Google Pay')} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold transition hover:bg-accent">
              <span className="font-bold"><span className="text-[#4285f4]">G</span> Pay</span>
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or pay with card <span className="h-px flex-1 bg-border" />
          </div>

          {/* card form */}
          <div className="space-y-3">
            <div>
              <label className="lbl">Card number</label>
              <div className="relative">
                <input value={card} onChange={(e) => setCard(fmtCard(e.target.value))} inputMode="numeric" className="field pr-14 font-mono" placeholder="1234 5678 9012 3456" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">{brand ? <BrandMark brand={brand} /> : <i className="ph-bold ph-credit-card text-muted-foreground" aria-hidden />}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="lbl">Expiry</label><input value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} inputMode="numeric" className="field font-mono" placeholder="MM/YY" /></div>
              <div><label className="lbl">CVC</label><input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className="field font-mono" placeholder="123" /></div>
            </div>
            <div><label className="lbl">Name on card</label><input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Full name" /></div>
          </div>

          <button type="button" disabled={paying} onClick={() => pay(cardLabel())} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60">
            <i className={`ph-bold ${paying ? 'ph-circle-notch animate-spin' : 'ph-lock-simple'}`} aria-hidden /> {paying ? 'Processing…' : `Pay $${amount}`}
          </button>
        </>
        )
      ) : (
        <div className="mt-4">
          <div className="rounded-xl border border-border bg-background p-5 text-center">
            <p className="text-3xl font-bold"><span className="text-[#003087]">Pay</span><span className="text-[#0070e0]">Pal</span></p>
            <p className="mt-2 text-sm text-muted-foreground">You&apos;ll be redirected to PayPal to complete your <b className="text-foreground">${amount}</b> payment, then sent right back here.</p>
          </div>
          <button type="button" onClick={() => pay('PayPal')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffc439] px-5 py-3 text-sm font-bold text-[#003087] shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 active:scale-[.98]">
            Continue with <span><span className="text-[#003087]">Pay</span><span className="text-[#0070e0]">Pal</span></span>
          </button>
        </div>
      )}
      </>)}

      {/* trust footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <i className="ph-bold ph-lock-simple text-emerald-500" aria-hidden /> Payments secured by <b className="text-foreground">Stripe</b> · we never store your card details
        </p>
        <div className="flex items-center gap-1.5">
          <BrandMark brand="visa" /><BrandMark brand="mastercard" /><BrandMark brand="amex" />
        </div>
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
      <h2 className="display text-lg font-semibold tracking-tight">Top up credits</h2>
      <p className="text-xs text-muted-foreground">Pay securely by card or PayPal. Credits are added to your balance instantly.</p>
      {body}
    </div>
  );
}

// Shown at top-up when the saved billing is incomplete: the user fills the required detail here (also
// persisted to Settings), which unlocks the payment methods once saved.
function BillingGate({ initial, onSaved }: { initial: BillingForm; onSaved: (b: BillingForm) => void }) {
  const toast = useToast();
  const [b, setB] = useState<BillingForm>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BillingForm, v: string) => setB((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!billingComplete(b)) { toast('Fill in name, address, city and country.', 'error'); return; }
    setSaving(true);
    const r = await updateBillingAction(b);
    setSaving(false);
    if (!r.ok) { toast(r.error ?? 'Save failed', 'error'); return; }
    toast('Billing details saved', 'success');
    onSaved(b);
  };
  return (
    <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400"><i className="ph-bold ph-warning-circle" aria-hidden /> Complete your billing details to continue</p>
      <p className="mt-1 text-xs text-muted-foreground">Required for your invoice before we charge. Saved to your <a href="/settings" className="text-primary hover:underline">Settings</a> too, so you only do this once.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><label className="lbl">Billing name<span className="text-primary"> *</span></label><input className="field" value={b.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name or contact" /></div>
        <div><label className="lbl">Company</label><input className="field" value={b.company} onChange={(e) => set('company', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="lbl">Address line 1<span className="text-primary"> *</span></label><input className="field" value={b.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street address" /></div>
        <div><label className="lbl">City<span className="text-primary"> *</span></label><input className="field" value={b.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div><label className="lbl">Country<span className="text-primary"> *</span></label><input className="field" value={b.country} onChange={(e) => set('country', e.target.value)} placeholder="Vietnam" /></div>
        <div><label className="lbl">Postal code</label><input className="field" value={b.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></div>
        <div><label className="lbl">Tax ID / VAT</label><input className="field" value={b.taxId} onChange={(e) => set('taxId', e.target.value)} /></div>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={save} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">{saving ? 'Saving…' : 'Save & continue'}</button></div>
    </div>
  );
}
