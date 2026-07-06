'use client';

import { useState } from 'react';
import { useToast } from '../Toast';
import { useCredit } from '../CreditStore';
import { Modal } from '../Modal';
import { updateBillingAction } from '@/app/(portal)/profile.actions';
import { billingComplete, type BillingForm } from '@/lib/billing';
import {
  setAutoTopupAction, requestPlanChangeAction, addPaymentMethodAction, removePaymentMethodAction,
  setDefaultPaymentMethodAction, type AutoTopup, type PaymentMethod,
} from '@/app/(portal)/settings.actions';

const TIERS: { key: string; label: string; desc: string }[] = [
  { key: 'new', label: 'Starter', desc: 'Pay as you go · standard support' },
  { key: 'silver', label: 'Silver', desc: '5% off every order · faster support' },
  { key: 'gold', label: 'Gold', desc: '10% off every order · priority support' },
  { key: 'vip', label: 'VIP', desc: '15% off every order · priority support' },
];
const tierLabel = (k: string) => TIERS.find((t) => t.key === k)?.label ?? 'Starter';

export function BillingPanel({ plan, initialAutoTopup, initialPaymentMethods, initialBilling }: {
  plan: string; initialAutoTopup: AutoTopup; initialPaymentMethods: PaymentMethod[]; initialBilling: BillingForm;
}) {
  const toast = useToast();
  const { balance } = useCredit();
  const [planOpen, setPlanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [topup, setTopup] = useState<AutoTopup>(initialAutoTopup);
  const [pms, setPms] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [billing, setBilling] = useState<BillingForm>(initialBilling);
  const billingReady = billingComplete(billing);
  const planDesc = TIERS.find((t) => t.key === plan)?.desc ?? '';

  const saveTopup = async (next: AutoTopup) => {
    setTopup(next);
    const r = await setAutoTopupAction(next);
    if (!r.ok) toast(r.error ?? 'Save failed', 'error');
  };
  const saveBilling = async () => {
    const r = await updateBillingAction(billing);
    toast(r.ok ? 'Billing details saved' : r.error ?? 'Save failed', r.ok ? 'success' : 'error');
  };
  const addCard = async (brand: string, last4: string, expMonth: number | null, expYear: number | null, close: () => void) => {
    if (!/^\d{4}$/.test(last4)) { toast('Enter the last 4 digits', 'error'); return; }
    const r = await addPaymentMethodAction({ brand, last4, expMonth, expYear });
    if (!r.ok) { toast(r.error ?? 'Add failed', 'error'); return; }
    const first = pms.length === 0;
    setPms((p) => [{ id: `tmp-${last4}-${expMonth}`, brand, last4, expMonth, expYear, isDefault: first }, ...p]);
    toast('Payment method added'); close();
  };
  const removeCard = async (id: string) => {
    const r = await removePaymentMethodAction(id);
    if (!r.ok) { toast(r.error ?? 'Remove failed', 'error'); return; }
    setPms((p) => p.filter((m) => m.id !== id));
    toast('Payment method removed');
  };
  const makeDefault = async (id: string) => {
    const r = await setDefaultPaymentMethodAction(id);
    if (!r.ok) { toast(r.error ?? 'Update failed', 'error'); return; }
    setPms((p) => p.map((m) => ({ ...m, isDefault: m.id === id })));
    toast('Default payment method updated');
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/20 text-amber-500"><i className="ph-fill ph-crown text-xl" aria-hidden /></span>
            <div><p className="display text-lg font-semibold">{tierLabel(plan)} plan</p><p className="text-xs text-muted-foreground">{planDesc}</p></div>
          </div>
          <button onClick={() => setPlanOpen(true)} className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Manage plan</button>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-primary/20 pt-4">
          <div><p className="text-xs text-muted-foreground">Credit balance</p><p className="display text-2xl font-semibold tracking-tight">${balance.toLocaleString('en-US')}</p></div>
          <a href="/credit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]"><i className="ph-bold ph-plus" aria-hidden /> Top up credits</a>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="display text-base font-semibold tracking-tight">Auto top-up</h2><p className="text-xs text-muted-foreground">Automatically top up when your balance runs low so orders aren&apos;t interrupted.</p></div>
          <div className={`switch${topup.enabled ? ' on' : ''}`} role="switch" aria-checked={topup.enabled} tabIndex={0}
            onClick={() => saveTopup({ ...topup, enabled: !topup.enabled })}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); saveTopup({ ...topup, enabled: !topup.enabled }); } }} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:max-w-lg sm:items-end">
          <div><label className="lbl">When balance falls below</label><input className="field" type="number" min={0} value={topup.threshold} onChange={(e) => setTopup((t) => ({ ...t, threshold: Number(e.target.value) }))} /></div>
          <div><label className="lbl">Top up</label><input className="field" type="number" min={0} value={topup.amount} onChange={(e) => setTopup((t) => ({ ...t, amount: Number(e.target.value) }))} /></div>
          <button onClick={() => saveTopup(topup)} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Save</button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between"><h2 className="display text-base font-semibold tracking-tight">Payment methods</h2><button onClick={() => setAddOpen(true)} className="text-xs font-semibold text-primary hover:underline">+ Add</button></div>
        <div className="mt-3 space-y-2">
          {pms.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">No payment methods yet.</p>}
          {pms.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <i className="ph-bold ph-credit-card text-xl text-primary" aria-hidden />
              <div className="flex-1 text-sm"><p className="font-medium">{m.brand} •••• {m.last4}</p>{m.expMonth && m.expYear ? <p className="text-[11px] text-muted-foreground">Expires {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}</p> : null}</div>
              {m.isDefault ? <span className="pill pill-good">Default</span> : <button onClick={() => makeDefault(m.id)} className="text-[11px] font-semibold text-primary hover:underline">Make default</button>}
              <button onClick={() => removeCard(m.id)} aria-label="Remove" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><i className="ph-bold ph-trash" aria-hidden /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-base font-semibold tracking-tight">Billing information</h2>
          {billingReady
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600"><i className="ph-bold ph-check-circle" aria-hidden />Complete</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600"><i className="ph-bold ph-warning-circle" aria-hidden />Incomplete</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Used on your invoices and to charge credit top-ups. Name, address, city and country are required.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="lbl">Billing name<span className="text-primary"> *</span></label><input className="field" value={billing.name} onChange={(e) => setBilling((b) => ({ ...b, name: e.target.value }))} placeholder="Full name or contact" /></div>
          <div><label className="lbl">Company name</label><input className="field" value={billing.company} onChange={(e) => setBilling((b) => ({ ...b, company: e.target.value }))} /></div>
          <div><label className="lbl">Billing email</label><input className="field" type="email" value={billing.email} onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))} placeholder="invoices@company.com" /></div>
          <div><label className="lbl">Tax ID / VAT</label><input className="field" value={billing.taxId} onChange={(e) => setBilling((b) => ({ ...b, taxId: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="lbl">Address line 1<span className="text-primary"> *</span></label><input className="field" value={billing.line1} onChange={(e) => setBilling((b) => ({ ...b, line1: e.target.value }))} placeholder="Street address" /></div>
          <div className="sm:col-span-2"><label className="lbl">Address line 2</label><input className="field" value={billing.line2} onChange={(e) => setBilling((b) => ({ ...b, line2: e.target.value }))} placeholder="Apartment, suite, etc. (optional)" /></div>
          <div><label className="lbl">City<span className="text-primary"> *</span></label><input className="field" value={billing.city} onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))} /></div>
          <div><label className="lbl">State / Province</label><input className="field" value={billing.state} onChange={(e) => setBilling((b) => ({ ...b, state: e.target.value }))} /></div>
          <div><label className="lbl">Postal code</label><input className="field" value={billing.postalCode} onChange={(e) => setBilling((b) => ({ ...b, postalCode: e.target.value }))} /></div>
          <div><label className="lbl">Country<span className="text-primary"> *</span></label><input className="field" value={billing.country} onChange={(e) => setBilling((b) => ({ ...b, country: e.target.value }))} placeholder="Vietnam" /></div>
        </div>
        <div className="mt-4 flex justify-end"><button onClick={saveBilling} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Save details</button></div>
      </div>

      {planOpen && (
        <Modal onClose={() => setPlanOpen(false)} title="Manage plan" subtitle="Request a subscription tier change" icon="ph-crown">
          {({ close }) => (
            <div className="space-y-2">
              {TIERS.map((p) => {
                const active = p.key === plan;
                return (
                  <button key={p.key} type="button" disabled={active}
                    onClick={async () => { const r = await requestPlanChangeAction(p.label); toast(r.ok ? `Requested the ${p.label} plan — our team will follow up` : r.error ?? 'Request failed', r.ok ? 'success' : 'error'); close(); }}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}><i className="ph-bold ph-crown" aria-hidden /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.label}</span><span className="block text-[11px] text-muted-foreground">{p.desc}</span></span>
                    {active && <span className="pill pill-good shrink-0">Current</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} title="Add payment method" subtitle="Card details for billing (we store only the brand & last 4)" icon="ph-credit-card">
          {({ close }) => <AddCardForm onAdd={(b, l, m, y) => addCard(b, l, m, y, close)} />}
        </Modal>
      )}
    </section>
  );
}

function AddCardForm({ onAdd }: { onAdd: (brand: string, last4: string, expMonth: number | null, expYear: number | null) => void }) {
  const [brand, setBrand] = useState('Visa');
  const [last4, setLast4] = useState('');
  const [exp, setExp] = useState('');
  const submit = () => {
    const m = exp.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
    const expMonth = m ? Number(m[1]) : null;
    const expYear = m ? Number(m[2].length === 2 ? `20${m[2]}` : m[2]) : null;
    onAdd(brand, last4.trim(), expMonth, expYear);
  };
  return (
    <div className="space-y-3">
      <div><label className="lbl">Brand</label><select className="field" value={brand} onChange={(e) => setBrand(e.target.value)}><option>Visa</option><option>Mastercard</option><option>Amex</option><option>Other</option></select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="lbl">Last 4 digits</label><input className="field" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} placeholder="4242" /></div>
        <div><label className="lbl">Expiry (MM/YY)</label><input className="field" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="08/27" /></div>
      </div>
      <div className="flex justify-end"><button onClick={submit} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">Add card</button></div>
    </div>
  );
}
