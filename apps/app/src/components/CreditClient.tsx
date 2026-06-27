'use client';

import { useState } from 'react';
import type { CreditTx, Invoice } from '@/data/mock';
import { useCredit } from './CreditStore';
import { TopUp } from './TopUp';
import { Modal } from './Modal';
import { ExportTransactionsButton, InvoicePdfButton } from './CreditExports';

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US')}`;

const parseUS = (d: string): Date | null => {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
};
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export function CreditClient() {
  const { balance, transactions, invoices } = useCredit();
  const [activeTx, setActiveTx] = useState<CreditTx | null>(null);
  const [activeInv, setActiveInv] = useState<Invoice | null>(null);

  // "This month" = the calendar month of the most recent transaction.
  const months = transactions.map((t) => parseUS(t.date)).filter((d): d is Date => !!d).map(monthKey);
  const curMonth = months.length ? Math.max(...months) : monthKey(new Date());
  const inMonth = (t: CreditTx) => { const d = parseUS(t.date); return d ? monthKey(d) === curMonth : false; };

  const toppedUp = transactions.filter((t) => t.type === 'topup' && inMonth(t)).reduce((s, t) => s + t.amount, 0);
  const used = transactions.filter((t) => t.type === 'order' && inMonth(t)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const topupCount = transactions.filter((t) => t.type === 'topup' && inMonth(t)).length;
  const orderCount = transactions.filter((t) => t.type === 'order' && inMonth(t)).length;

  // Runway: balance ÷ average daily burn (this month's spend, else all-time spend over 30d).
  const usedAll = transactions.filter((t) => t.type === 'order').reduce((s, t) => s + Math.abs(t.amount), 0);
  const burn = (used || usedAll) / 30;
  const runwayDays = burn > 0 ? Math.round(balance / burn) : null;

  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Credit &amp; Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Top up credits with card or PayPal, and view your transaction history and invoices.</p>
      </div>

      {/* balance */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 sm:col-span-1">
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">Credit balance</p><span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>VIP</span></div>
          <p className="display mt-1 text-3xl font-semibold tracking-tight">${balance.toLocaleString('en-US')}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{runwayDays != null ? `≈ ${runwayDays} days of work at your current pace` : 'No spend yet'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Topped up this month</p>
          <p className="display mt-1 text-2xl font-semibold tracking-tight">${toppedUp.toLocaleString('en-US')}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{topupCount} top-up{topupCount === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Used this month</p>
          <p className="display mt-1 text-2xl font-semibold tracking-tight">${used.toLocaleString('en-US')}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{orderCount} service order{orderCount === 1 ? '' : 's'}</p>
        </div>
      </section>

      {/* top-up */}
      <section id="topup" className="mt-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <TopUp />
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">How top-ups work</h3>
            <ol className="mt-3 space-y-3 text-sm">
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span><span className="text-muted-foreground">Choose the amount to top up.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span><span className="text-muted-foreground">Pay by card, Apple&nbsp;Pay, Google&nbsp;Pay, or PayPal.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span><span className="text-muted-foreground">Payment is processed securely by Stripe.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600">✓</span><span className="text-muted-foreground">Credits land in your balance instantly — no waiting.</span></li>
            </ol>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Billing information</h3>
            <p className="mt-2 text-sm text-muted-foreground">HevaSEO Inc. · Tax ID 0312345678</p>
            <a href="/settings" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Update VAT details <i className="ph-bold ph-arrow-up-right" /></a>
          </div>
        </div>
      </section>

      {/* transactions */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="display text-lg font-semibold tracking-tight">Credit transaction history</h2><ExportTransactionsButton rows={transactions} /></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pr-3">Date</th><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5 text-right">Amount</th><th className="py-2.5 pl-3 text-right">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {transactions.map((t, i) => (
                <tr key={i} onClick={() => setActiveTx(t)} className="cursor-pointer transition hover:bg-accent/40">
                  <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{t.date}</td>
                  <td className="px-3 py-3">{t.description}</td>
                  <td className="px-3 py-3">{t.type === 'topup'
                    ? <span className="pill pill-ok">Top up</span>
                    : <span className="pill" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>Deduct</span>}</td>
                  <td className={`px-3 py-3 text-right font-semibold${t.amount >= 0 ? ' text-emerald-600' : ''}`}>{t.amount >= 0 ? '+' : ''}{money(t.amount)}</td>
                  <td className="py-3 pl-3 text-right">{t.status === 'success'
                    ? <span className="pill pill-ok">Success</span>
                    : <span className="pill pill-good">Processing</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* invoices */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="display text-lg font-semibold tracking-tight">Invoices</h2><span className="text-xs text-muted-foreground">VAT issued per your company details</span></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pr-3">Invoice no.</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Status</th><th className="py-2.5 pl-3 text-right">Download</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.no} onClick={() => setActiveInv(inv)} className="cursor-pointer transition hover:bg-accent/40">
                  <td className="py-3 pr-3 font-mono font-semibold text-primary">{inv.no}</td>
                  <td className="px-3 py-3 text-muted-foreground">{inv.date}</td>
                  <td className="px-3 py-3 text-right font-semibold">${inv.amount}</td>
                  <td className="px-3 py-3">{inv.status === 'issued'
                    ? <span className="pill pill-ok">Issued</span>
                    : <span className="pill pill-good">Processing</span>}</td>
                  <td className="py-3 pl-3 text-right" onClick={(e) => e.stopPropagation()}>{inv.status === 'issued'
                    ? <InvoicePdfButton invoice={inv} />
                    : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">HevaSEO Workspace · Credit &amp; Invoices · sample data</p>

      {/* transaction detail */}
      {activeTx && (
        <Modal onClose={() => setActiveTx(null)} title={activeTx.type === 'topup' ? 'Top-up receipt' : 'Charge detail'} subtitle={activeTx.date} icon={activeTx.type === 'topup' ? 'ph-arrow-circle-down' : 'ph-arrow-circle-up'}>
          {() => (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Description</dt><dd className="text-right font-medium">{activeTx.description}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{activeTx.type === 'topup' ? 'Top up' : 'Order deduction'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amount</dt><dd className={`font-semibold ${activeTx.amount >= 0 ? 'text-emerald-600' : ''}`}>{activeTx.amount >= 0 ? '+' : ''}{money(activeTx.amount)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd>{activeTx.status === 'success' ? <span className="pill pill-ok">Success</span> : <span className="pill pill-good">Processing</span>}</dd></div>
              <div className="flex justify-between gap-3 border-t border-border pt-2.5"><dt className="text-muted-foreground">Balance after</dt><dd className="font-semibold">${balance.toLocaleString('en-US')}</dd></div>
            </dl>
          )}
        </Modal>
      )}

      {/* invoice detail */}
      {activeInv && (
        <Modal onClose={() => setActiveInv(null)} title={`Invoice ${activeInv.no}`} subtitle={activeInv.date} icon="ph-receipt">
          {() => (
            <div className="space-y-4">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Billed to</dt><dd className="text-right font-medium">HevaShop Store</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">${activeInv.amount.toLocaleString('en-US')}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd>{activeInv.status === 'issued' ? <span className="pill pill-ok">Issued</span> : <span className="pill pill-good">Processing</span>}</dd></div>
              </dl>
              {activeInv.status === 'issued'
                ? <div className="flex justify-end"><InvoicePdfButton invoice={activeInv} /></div>
                : <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground">This invoice is still processing — the PDF will be available once issued.</p>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
