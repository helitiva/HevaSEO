'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { CashflowChart } from '@/components/admin/finance/CashflowChart';
import {
  FINANCE, TRANSACTIONS, INVOICES, PAYOUTS, CASHFLOW, CUSTOMERS, ORDERS,
  TX_KIND, TX_METHOD, INVOICE_STATUS, PAYABLE_STATES, PAYOUT_RATE, TIER, money,
  type Transaction, type TxKind, type Invoice, type InvoiceStatus, type Payout,
  type AdminOrder, type AdminCustomer,
} from '@/data/adminMock';

type TabKey = 'overview' | 'transactions' | 'wallets' | 'payouts' | 'invoices';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ph-gauge' },
  { key: 'transactions', label: 'Transactions', icon: 'ph-arrows-left-right' },
  { key: 'wallets', label: 'Wallets', icon: 'ph-wallet' },
  { key: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' },
  { key: 'invoices', label: 'Invoices', icon: 'ph-file-text' },
];

// localStorage-backed state for the admin's in-session finance actions
// (mark-paid, payroll overrides, invoice actions, wallet top-ups). No backend
// yet — this keeps them across reloads. SSR-safe: starts from `initial` on the
// server + first client render (no hydration mismatch), then loads any stored
// value after mount. The `hydrated` guard stops the save effect from clobbering
// stored data with the default before the load runs.
const FINANCE_LS_PREFIX = 'heva.finance.';
function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FINANCE_LS_PREFIX + key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch { /* ignore corrupt/unavailable storage */ }
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(FINANCE_LS_PREFIX + key, JSON.stringify(state)); } catch { /* ignore quota/unavailable */ }
  }, [key, state, hydrated]);
  return [state, setState] as const;
}

export function FinanceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'overview';
  const setTab = (k: TabKey) => {
    const next = new URLSearchParams(params.toString());
    if (k === 'overview') next.delete('tab'); else next.set('tab', k);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const f = FINANCE;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="display text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-sm text-muted-foreground">Cashflow, wallets, payouts &amp; invoices — where the money sits and what&apos;s due.</p>
      </div>

      {/* KPI band */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-currency-dollar" label="Gross · MTD" value={money(f.grossMtd)} tone="good" hint="before refunds" />
        <Kpi icon="ph-chart-line-up" label="Net · MTD" value={money(f.netMtd)} tone="good" hint="after refunds" />
        <Kpi icon="ph-wallet" label="Wallet liability" value={money(f.walletLiability)} hint="prepaid customer credit" />
        <Kpi icon="ph-arrow-u-down-left" label="Refunds · MTD" value={money(f.refundsMtd)} hint="3% of gross" />
        <Kpi icon="ph-hand-coins" label="Payouts due" value={money(f.payoutsDue)} tone="warn" hint="salary + commission" />
        <Kpi icon="ph-receipt" label="Outstanding AR" value={money(f.outstandingAr)} tone="warn" hint="unpaid invoices" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition ${tab === t.key ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <i className={`ph-bold ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      <div className="page-anim">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'transactions' && <TransactionsTab />}
        {tab === 'wallets' && <WalletsTab />}
        {tab === 'payouts' && <PayoutsTab />}
        {tab === 'invoices' && <InvoicesTab />}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Overview */
function OverviewTab() {
  const recent = [...TRANSACTIONS].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const overdue = INVOICES.filter((i) => i.status === 'overdue');
  const pending = TRANSACTIONS.filter((t) => t.status === 'pending');
  const totalIn = CASHFLOW.reduce((s, d) => s + d.in, 0);
  const totalOut = CASHFLOW.reduce((s, d) => s + d.out, 0);
  const net = totalIn - totalOut;
  const flowMax = Math.max(totalIn, totalOut, 1);

  const alerts = [
    overdue.length ? { icon: 'ph-warning-circle', tone: 'bad' as const, text: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''} · ${money(overdue.reduce((a, i) => a + i.amount, 0))}`, href: '?tab=invoices' } : null,
    pending.length ? { icon: 'ph-hourglass-medium', tone: 'warn' as const, text: `${pending.length} pending payment${pending.length > 1 ? 's' : ''} · ${money(pending.reduce((a, t) => a + t.amount, 0))}`, href: '?tab=transactions' } : null,
    FINANCE.payoutsDue ? { icon: 'ph-hand-coins', tone: 'warn' as const, text: `${money(FINANCE.payoutsDue)} in staff payouts due`, href: '?tab=payouts' } : null,
  ].filter(Boolean) as { icon: string; tone: 'bad' | 'warn'; text: string; href: string }[];

  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} scroll={false}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:brightness-105 ${a.tone === 'bad' ? 'border-rose-500/40 bg-rose-500/5 text-rose-600' : 'border-amber-500/40 bg-amber-500/5 text-amber-700'}`}>
              <i className={`ph-bold ${a.icon}`} />{a.text}<i className="ph-bold ph-arrow-right opacity-60" />
            </Link>
          ))}
        </div>
      )}

      <CashflowChart data={CASHFLOW} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scales text-primary" /> Net flow · 30d</p>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Money in</span>
                <span className="font-semibold tabular-nums text-emerald-600">+{money(totalIn)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalIn / flowMax) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><span className="inline-block h-2 w-2 rounded-full bg-rose-500" />Money out</span>
                <span className="font-semibold tabular-nums text-rose-500">−{money(totalOut)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${(totalOut / flowMax) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Net</span>
            <span className={`font-bold tabular-nums ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{net >= 0 ? '+' : '−'}{money(Math.abs(net))}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock-counter-clockwise text-primary" /> Recent transactions</p>
            <Link href="?tab=transactions" scroll={false} className="text-xs font-semibold text-primary hover:underline">All →</Link>
          </div>
          <ul className="divide-y divide-border/60">
            {recent.map((t) => <RecentRow key={t.id} t={t} />)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RecentRow({ t }: { t: Transaction }) {
  const meta = TX_KIND[t.kind];
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon}`} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{t.party} <span className="text-muted-foreground">· {meta.label}</span></p>
        <p className="text-[11px] text-muted-foreground">{t.at}{t.orderCode ? ` · ${t.orderCode}` : ''}</p>
      </div>
      <Amount n={t.amount} status={t.status} />
    </li>
  );
}

/* ------------------------------------------------------------ Transactions */
const KIND_FILTERS: { key: TxKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'top_up', label: 'Top-ups' }, { key: 'charge', label: 'Payments' },
  { key: 'refund', label: 'Refunds' }, { key: 'payout', label: 'Payouts' }, { key: 'adjustment', label: 'Adjustments' },
];

const TX_DATES = TRANSACTIONS.map((t) => t.at.slice(0, 10)).sort();
const TX_MIN = TX_DATES[0];
const TX_MAX = TX_DATES[TX_DATES.length - 1];

function TransactionsTab() {
  const [kind, setKind] = useState<TxKind | 'all'>('all');
  const [party, setParty] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(TX_MIN);
  const [to, setTo] = useState(TX_MAX);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const parties = useMemo(() => [...new Set(TRANSACTIONS.map((t) => t.party))].sort(), []);
  const rows = useMemo(() => [...TRANSACTIONS]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((t) => {
      const day = t.at.slice(0, 10);
      return (kind === 'all' || t.kind === kind)
        && (!party || t.party === party)
        && day >= from && day <= to
        && (!search.trim() || `${t.party} ${t.note} ${t.orderCode ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    }),
    [kind, party, search, from, to]);
  // Keep cash and revenue separate — a wallet charge spends credit that was
  // already counted at top-up, so summing both would double-count the same money.
  const topUps = rows.filter((t) => t.kind === 'top_up' && t.status !== 'failed').reduce((a, t) => a + t.amount, 0);
  const revenue = rows.filter((t) => t.kind === 'charge').reduce((a, t) => a + t.amount, 0);
  const sumOut = rows.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);

  const exportCsv = () => {
    downloadCsv(
      `transactions_${from}_to_${to}.csv`,
      ['Date', 'Type', 'Party', 'Order', 'Method', 'Status', 'Amount', 'Note'],
      rows.map((t) => [t.at, TX_KIND[t.kind].label, t.party, t.orderCode ?? '', TX_METHOD[t.method].label, t.status, t.amount, t.note]),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-xs font-semibold">
          {KIND_FILTERS.map((k) => (
            <button key={k.key} onClick={() => setKind(k.key)}
              className={`rounded-md px-2.5 py-1 transition ${kind === k.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{k.label}</button>
          ))}
        </div>
        <select value={party} onChange={(e) => setParty(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">All parties</option>
          {parties.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1 text-xs">
          <input type="date" value={from} min={TX_MIN} max={to} onChange={(e) => setFrom(e.target.value)} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} min={from} max={TX_MAX} onChange={(e) => setTo(e.target.value)} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
        </div>
        <div className="relative ml-auto min-w-[12rem] flex-1 sm:flex-none">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party, note, order…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary" />
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          title="Download the filtered transactions as CSV"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">
          <i className="ph-bold ph-download-simple" />Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>{rows.length} transactions</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-circle-down text-emerald-600" />Top-ups <span className="font-semibold text-emerald-600">{money(topUps)}</span></span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-receipt text-emerald-600" />Revenue <span className="font-semibold text-emerald-600">{money(revenue)}</span></span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-circle-up text-rose-500" />Out <span className="font-semibold text-rose-500">{money(Math.abs(sumOut))}</span></span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Party</th>
              <th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const meta = TX_KIND[t.kind];
              return (
                <tr key={t.id} onClick={() => setSelected(t)}
                  role="button" tabIndex={0} aria-label={`${meta.label} · ${t.party} · ${money(Math.abs(t.amount))}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(t); } }}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{t.at}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-1.5 font-medium"><i className={`ph-bold ${meta.icon} ${meta.flow === 'in' ? 'text-emerald-600' : 'text-rose-500'}`} />{meta.label}</span></td>
                  <td className="p-3"><span className="font-medium">{t.party}</span>{t.orderCode && <span className="text-muted-foreground"> · {t.orderCode}</span>}</td>
                  <td className="p-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><i className={`ph-bold ${TX_METHOD[t.method].icon}`} />{TX_METHOD[t.method].label}</span></td>
                  <td className="p-3"><TxStatusPill status={t.status} /></td>
                  <td className="p-3 text-right"><Amount n={t.amount} status={t.status} /></td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" /></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No transactions match.</td></tr>}
          </tbody>
        </table>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected ? TX_KIND[selected.kind].label : ''}>
        {selected && <TxDetail t={selected} />}
      </SlideOver>
    </div>
  );
}

function TxDetail({ t }: { t: Transaction }) {
  const meta = TX_KIND[t.kind];
  const cust = t.partyId && t.partyId.startsWith('c') ? CUSTOMERS.find((c) => c.id === t.partyId) : null;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-12 w-12 place-items-center rounded-xl ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon} text-xl`} /></span>
        <div>
          <p className="display text-2xl font-bold leading-none"><Amount n={t.amount} status={t.status} /></p>
          <p className="mt-1 text-xs text-muted-foreground">{meta.label} · {t.at}</p>
        </div>
        <div className="ml-auto"><TxStatusPill status={t.status} /></div>
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <KV label="Party" value={t.party} />
        <KV label="Method" value={TX_METHOD[t.method].label} />
        <KV label="Reference" value={t.id.toUpperCase()} />
        <KV label="Linked order" value={t.orderCode ?? '—'} />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note</p>
        <p className="rounded-lg border border-border bg-background/40 p-3 text-sm">{t.note}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4 text-sm">
        {cust && (
          <>
            <Link href={`/admin/customers/${cust.id}`} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-user" />Customer profile</Link>
            <a href={`/admin/customers/${cust.id}`} target="_blank" rel="noopener noreferrer" title="Open profile in a new tab" aria-label="Open profile in a new tab" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary"><i className="ph-bold ph-arrow-square-out" /></a>
          </>
        )}
        {t.orderCode && <Link href="/admin/orders" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-semibold hover:bg-accent"><i className="ph-bold ph-package" />View order</Link>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Wallets */
// Admin-granted wallet credit (session-only — no backend yet).
type AdminTopup = { id: string; customerId: string; amount: number; at: string; note: string };
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function WalletsTab() {
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [topups, setTopups] = usePersistedState<AdminTopup[]>('walletTopups', []);
  const [topup, setTopup] = useState<{ open: boolean; presetId?: string }>({ open: false });

  const addedFor = (id: string) => topups.filter((t) => t.customerId === id).reduce((a, t) => a + t.amount, 0);
  const balanceOf = (c: AdminCustomer) => c.balance + addedFor(c.id);
  const sessionTxFor = (id: string): Transaction[] => topups
    .filter((t) => t.customerId === id)
    .map((t): Transaction => ({ id: t.id, at: t.at, kind: 'top_up', amount: t.amount, party: CUSTOMERS.find((c) => c.id === id)?.company ?? '', partyId: id, method: 'manual', status: 'settled', orderCode: null, note: t.note }))
    .sort((a, b) => b.at.localeCompare(a.at));

  const addCredit = (customerId: string, amount: number, note: string) => {
    setTopups((s) => [...s, { id: `atu-${Date.now()}`, customerId, amount, at: nowStamp(), note: note.trim() || 'Admin trial credit' }]);
    setTopup({ open: false });
    const c = CUSTOMERS.find((x) => x.id === customerId);
    if (c) setSelected(c);
  };

  const rows = [...CUSTOMERS].filter((c) => balanceOf(c) > 0).sort((a, b) => balanceOf(b) - balanceOf(a));
  const sessionAdded = topups.reduce((a, t) => a + t.amount, 0);
  const baseTopped = TRANSACTIONS.filter((t) => t.kind === 'top_up' && t.status === 'settled').reduce((a, t) => a + t.amount, 0);
  const liability = FINANCE.walletLiability + sessionAdded;
  const maxBal = Math.max(...rows.map((c) => balanceOf(c)), 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="px-1 text-xs text-muted-foreground">{rows.length} customers holding {money(liability)} in prepaid credit · {money(baseTopped + sessionAdded)} topped up to date. Click a row for the ledger.</p>
        <button onClick={() => setTopup({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
          <i className="ph-bold ph-plus-circle" />Top up a customer
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Customer</th><th className="p-3">Tier</th><th className="p-3">Lifetime spend</th>
              <th className="p-3">Wallet balance</th><th className="p-3">Last active</th><th className="p-3 text-right">Action</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const bal = balanceOf(c);
              const added = addedFor(c.id);
              return (
                <tr key={c.id} onClick={() => setSelected(c)}
                  role="button" tabIndex={0} aria-label={`View wallet ledger for ${c.company}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(c); } }}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                  <td className="p-3"><Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link><span className="text-muted-foreground"> · {c.company}</span></td>
                  <td className="p-3 capitalize text-muted-foreground">{c.tier}</td>
                  <td className="p-3">{money(c.spend)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{money(bal)}</span>
                      {added > 0 && <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] font-bold text-emerald-600">+{money(added)}</span>}
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(bal / maxBal) * 100}%` }} /></span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.lastActive}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setTopup({ open: true, presetId: c.id })}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent">Top up</button>
                  </td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" /></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No customers hold prepaid credit yet. Use “Top up a customer” to grant trial credit.</td></tr>}
          </tbody>
        </table>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.company} · Wallet ledger` : ''}>
        {selected && <WalletDetail c={selected} balance={balanceOf(selected)} extraTx={sessionTxFor(selected.id)} onTopup={() => setTopup({ open: true, presetId: selected.id })} />}
      </SlideOver>

      <SlideOver open={topup.open} onClose={() => setTopup({ open: false })} title="Top up wallet">
        {topup.open && <TopupForm presetId={topup.presetId} balanceOf={(id) => { const c = CUSTOMERS.find((x) => x.id === id); return c ? balanceOf(c) : 0; }} onSubmit={addCredit} onClose={() => setTopup({ open: false })} />}
      </SlideOver>
    </div>
  );
}

const TOPUP_PRESETS = [25, 50, 100, 250];

function TopupForm({ presetId, balanceOf, onSubmit, onClose }: {
  presetId?: string;
  balanceOf: (id: string) => number;
  onSubmit: (customerId: string, amount: number, note: string) => void;
  onClose: () => void;
}) {
  const customers = useMemo(() => [...CUSTOMERS].sort((a, b) => a.company.localeCompare(b.company)), []);
  const [cid, setCid] = useState(presetId ?? '');
  const [amount, setAmount] = useState<number>(50);
  const [note, setNote] = useState('Trial credit');
  const cust = customers.find((c) => c.id === cid);
  const valid = !!cid && amount > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><i className="ph-bold ph-plus-circle text-xl" /></span>
        <div>
          <p className="display text-lg font-bold leading-none">Add wallet credit</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Grant prepaid credit so a customer can try paid services.</p>
        </div>
      </div>

      {/* customer */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</label>
        <select value={cid} onChange={(e) => setCid(e.target.value)} disabled={!!presetId}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60">
          <option value="">Select a customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.company} · {c.name}</option>)}
        </select>
        {cust && <p className="mt-1 text-xs text-muted-foreground">Current balance <span className="font-semibold text-foreground tabular-nums">{money(balanceOf(cust.id))}</span> → after top-up <span className="font-semibold text-emerald-600 tabular-nums">{money(balanceOf(cust.id) + (amount > 0 ? amount : 0))}</span></p>}
      </div>

      {/* amount */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
          <span className="shrink-0 border-r border-border bg-muted px-3 py-2 text-sm text-muted-foreground">$</span>
          <input type="number" min={1} step={5} value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TOPUP_PRESETS.map((v) => (
            <button key={v} onClick={() => setAmount(v)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${amount === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>{money(v)}</button>
          ))}
        </div>
      </div>

      {/* note */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Trial credit, goodwill, refund top-up"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>

      {/* action */}
      <div className="flex gap-2 border-t border-border pt-4">
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">Cancel</button>
        <button onClick={() => valid && onSubmit(cid, amount, note)} disabled={!valid}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40">
          <i className="ph-bold ph-plus-circle" />Add {money(amount > 0 ? amount : 0)} credit
        </button>
      </div>
    </div>
  );
}

function WalletDetail({ c, balance, extraTx, onTopup }: { c: AdminCustomer; balance: number; extraTx: Transaction[]; onTopup: () => void }) {
  const ledger = [...extraTx, ...TRANSACTIONS.filter((t) => t.partyId === c.id)]
    .sort((a, b) => b.at.localeCompare(a.at));
  const toppedUp = ledger.filter((t) => t.kind === 'top_up' && t.status === 'settled').reduce((a, t) => a + t.amount, 0);
  const spent = ledger.filter((t) => t.kind === 'charge' && t.method === 'wallet' && t.status === 'settled').reduce((a, t) => a + t.amount, 0);
  const pending = ledger.filter((t) => t.status === 'pending').reduce((a, t) => a + t.amount, 0);
  const tier = TIER[c.tier];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><i className="ph-bold ph-wallet text-xl" /></span>
        <div className="min-w-0">
          <p className="display text-xl font-bold leading-none">{c.company}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.name} · <span style={{ color: tier.color }}>{tier.label}</span></p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className="display text-xl font-bold tabular-nums text-primary">{money(balance)}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {([
          { label: 'Topped up', val: money(toppedUp), tone: 'text-emerald-600' },
          { label: 'Spent (wallet)', val: money(spent), tone: 'text-rose-500' },
          { label: 'Pending', val: money(pending), tone: pending ? 'text-amber-600' : '' },
        ] as { label: string; val: string; tone: string }[]).map(({ label, val, tone }) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className={`display text-lg font-bold ${tone}`}>{val}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ledger */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transaction history</p>
        {ledger.length === 0 ? (
          <p className="rounded-xl border border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">No wallet activity recorded.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border">
            {ledger.map((t) => {
              const meta = TX_KIND[t.kind];
              const isAdmin = t.id.startsWith('atu-');
              return (
                <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon}`} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{isAdmin ? 'Admin top-up' : meta.label}{t.orderCode ? <span className="text-muted-foreground"> · {t.orderCode}</span> : ''}{isAdmin && <span className="ml-1.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] font-bold text-emerald-600">new</span>}</p>
                    <p className="text-[11px] text-muted-foreground">{t.at} · {TX_METHOD[t.method].label}{isAdmin && t.note ? ` · ${t.note}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <Amount n={t.amount} status={t.status} />
                    {t.status !== 'settled' && <p className="text-[10px] capitalize text-muted-foreground">{t.status}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <button onClick={onTopup} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-plus-circle" />Top up</button>
        <Link href={`/admin/customers/${c.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-semibold transition hover:bg-accent"><i className="ph-bold ph-user" />Profile</Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Payouts */
type PayoutOverride = { base: number; rate: number; bonus: number };

// Effective comp for a payout, applying any admin override.
function effComp(p: Payout, ov?: PayoutOverride) {
  const base = ov ? ov.base : p.base;
  const rate = ov ? ov.rate / 100 : p.rate;
  const bonus = ov ? ov.bonus : p.bonus;
  const commission = Math.round(p.basis * rate);
  return { base, rate, bonus, commission, total: base + commission + bonus };
}

// Prior payroll runs, derived from settled payout transactions grouped by
// settlement date — gives the period selector its read-only history.
const PAYOUT_HISTORY = (() => {
  const byDate = new Map<string, Transaction[]>();
  for (const t of TRANSACTIONS) {
    if (t.kind !== 'payout') continue;
    const d = t.at.slice(0, 10);
    byDate.set(d, [...(byDate.get(d) ?? []), t]);
  }
  return [...byDate.entries()]
    .map(([date, txs]) => ({ date, txs, total: txs.reduce((a, t) => a + Math.abs(t.amount), 0) }))
    .sort((a, b) => b.date.localeCompare(a.date));
})();

function PayoutsTab() {
  const [paid, setPaid] = usePersistedState<Record<string, boolean>>('payoutsPaid', {});
  const [selected, setSelected] = useState<Payout | null>(null);
  const [overrides, setOverrides] = usePersistedState<Record<string, PayoutOverride>>('payoutOverrides', {});
  const [period, setPeriod] = useState<string>('current');
  const rows = useMemo(() => [...PAYOUTS].sort((a, b) => b.due - a.due), []);

  const effDue = (p: Payout): number => effComp(p, overrides[p.staffId]).total;

  const remaining = rows.filter((p) => !paid[p.staffId]).reduce((a, p) => a + effDue(p), 0);
  const activeHistory = PAYOUT_HISTORY.find((h) => h.date === period) ?? null;

  const periodSelector = PAYOUT_HISTORY.length > 0 ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">Period</span>
      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-xs font-semibold">
        <button onClick={() => setPeriod('current')}
          className={`rounded-md px-2.5 py-1 transition ${period === 'current' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Current</button>
        {PAYOUT_HISTORY.map((h) => (
          <button key={h.date} onClick={() => setPeriod(h.date)}
            className={`rounded-md px-2.5 py-1 transition ${period === h.date ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Paid {h.date}</button>
        ))}
      </div>
    </div>
  ) : null;

  if (activeHistory) {
    return (
      <div className="space-y-3">
        {periodSelector}
        <PayoutHistoryView h={activeHistory} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {periodSelector}
      {/* commission rates legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px]">
        <i className="ph-bold ph-percent text-primary" />
        <span className="font-semibold text-foreground">Rates this period:</span>
        {Object.entries(PAYOUT_RATE).map(([role, rate]) => (
          <span key={role} className="rounded-md border border-border bg-background px-2 py-0.5 font-medium text-muted-foreground">
            {role} <span className="font-bold text-foreground">{Math.round(rate * 100)}%</span>
          </span>
        ))}
      </div>

      <p className="px-1 text-xs text-muted-foreground">Fixed salary + commission on billable (delivered+) work + bonus · <span className="font-semibold text-foreground">{money(remaining)}</span> still to pay. Click a row to edit salary, rate or bonus.</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Staff</th><th className="p-3">Fixed</th><th className="p-3">Commission</th>
              <th className="p-3">Bonus</th><th className="p-3">Total</th><th className="p-3 text-right">Action</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const isPaid = paid[p.staffId];
              const ov = overrides[p.staffId];
              const e = effComp(p, ov);
              const dispRate = Math.round(e.rate * 100);
              const baseChanged = !!ov && ov.base !== p.base;
              const rateChanged = !!ov && Math.round(ov.rate) !== Math.round(p.rate * 100);
              return (
                <tr key={p.staffId} onClick={() => setSelected(p)}
                  role="button" tabIndex={0} aria-label={`View payout breakdown for ${p.staff}`}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelected(p); } }}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                  <td className="p-3">
                    <Link href={`/admin/staff/${p.staffId}`} className="font-medium hover:underline" onClick={(ev) => ev.stopPropagation()}>{p.staff}</Link>
                    <span className="text-muted-foreground"> · {p.role}</span>
                    {!p.active && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">inactive</span>}
                  </td>
                  <td className="p-3 tabular-nums">
                    {money(e.base)}
                    {baseChanged && <i className="ph-bold ph-pencil-simple ml-1 text-[9px] text-amber-600" />}
                  </td>
                  <td className="p-3 tabular-nums">
                    {money(e.commission)}
                    <span className={`ml-1 text-[10px] font-semibold ${rateChanged ? 'text-amber-700' : 'text-muted-foreground'}`}>@ {dispRate}%</span>
                  </td>
                  <td className="p-3 tabular-nums">
                    {e.bonus ? <span className="font-semibold text-emerald-600">+{money(e.bonus)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 font-semibold tabular-nums">{money(e.total)}</td>
                  <td className="p-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                    {isPaid
                      ? <span className="pill pill-live">Paid</span>
                      : <button onClick={() => setPaid((s) => ({ ...s, [p.staffId]: true }))} disabled={e.total === 0}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">Mark paid</button>}
                  </td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
              <td className="p-3 text-muted-foreground">{rows.length} staff</td>
              <td className="p-3 tabular-nums">{money(rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).base, 0))}</td>
              <td className="p-3 tabular-nums">{money(rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).commission, 0))}</td>
              <td className="p-3 tabular-nums text-emerald-600">{money(rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).bonus, 0))}</td>
              <td className="p-3 tabular-nums">{money(rows.reduce((a, p) => a + effDue(p), 0))}</td>
              <td className="p-3" /><td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.staff} · Payout detail` : ''}>
        {selected && (
          <PayoutDetail
            key={selected.staffId}
            p={selected}
            paid={!!paid[selected.staffId]}
            override={overrides[selected.staffId]}
            onSaveOverride={(ov) => setOverrides((s) => ({ ...s, [selected!.staffId]: ov }))}
            onMarkPaid={() => setPaid((s) => ({ ...s, [selected!.staffId]: true }))}
          />
        )}
      </SlideOver>
    </div>
  );
}

function PayoutDetail({ p, paid, onMarkPaid, override, onSaveOverride }: {
  p: Payout; paid: boolean; onMarkPaid: () => void;
  override?: PayoutOverride; onSaveOverride: (ov: PayoutOverride) => void;
}) {
  const orders: AdminOrder[] = ORDERS.filter((o) => o.staff === p.staff && PAYABLE_STATES.includes(o.status));
  const roleRate = Math.round(p.rate * 100);
  const [editing, setEditing] = useState(false);
  const [draftBase, setDraftBase] = useState(override?.base ?? p.base);
  const [draftRate, setDraftRate] = useState(override?.rate ?? roleRate);
  const [draftBonus, setDraftBonus] = useState(override?.bonus ?? p.bonus);

  const e = effComp(p, override);
  const effRatePct = Math.round(e.rate * 100);
  const baseChanged = !!override && override.base !== p.base;
  const rateChanged = !!override && Math.round(override.rate) !== roleRate;
  const bonusSet = e.bonus !== 0;
  const previewCommission = Math.round(p.basis * (draftRate / 100));
  const previewTotal = draftBase + previewCommission + draftBonus;

  const startEditing = () => {
    setDraftBase(override?.base ?? p.base);
    setDraftRate(override?.rate ?? roleRate);
    setDraftBonus(override?.bonus ?? p.bonus);
    setEditing(true);
  };
  const saveEdit = () => { onSaveOverride({ base: draftBase, rate: draftRate, bonus: draftBonus }); setEditing(false); };

  return (
    <div className="space-y-5">
      {/* staff header */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <i className="ph-bold ph-user text-xl" />
        </span>
        <div className="min-w-0">
          <p className="display text-xl font-bold leading-none">{p.staff}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{p.role}{!p.active && ' · inactive'}</p>
        </div>
        <div className="ml-auto shrink-0">
          {paid ? <span className="pill pill-live">Paid</span> : <span className="pill pill-warn">Due</span>}
        </div>
      </div>

      {/* compensation summary / edit form */}
      {!editing ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compensation this period</p>
            {!paid && (
              <button onClick={startEditing} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
                <i className="ph-bold ph-pencil-simple text-[10px]" /> Edit
              </button>
            )}
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fixed salary{baseChanged && <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-bold text-amber-700">edited</span>}</dt>
              <dd className="font-semibold tabular-nums">{money(e.base)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Commission <span className="text-xs">({effRatePct}% × {money(p.basis)} billable){rateChanged && <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-bold text-amber-700">edited</span>}</span></dt>
              <dd className="font-semibold tabular-nums">{money(e.commission)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Bonus</dt>
              <dd className={`font-semibold tabular-nums ${bonusSet ? 'text-emerald-600' : 'text-muted-foreground'}`}>{bonusSet ? `+${money(e.bonus)}` : money(0)}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
              <dt className="font-semibold">Total due</dt>
              <dd className="display text-base font-bold tabular-nums text-primary">{money(e.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">Commission applies to delivered, in review, approved &amp; completed orders.</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Edit pay</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Fixed salary</label>
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <span className="shrink-0 border-r border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">$</span>
                <input type="number" min={0} step={50} value={draftBase}
                  onChange={(ev) => setDraftBase(Math.max(0, Number(ev.target.value)))}
                  className="w-full bg-transparent px-2 py-1.5 text-sm font-semibold tabular-nums outline-none" />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">role {money(p.base)}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Comm. rate</label>
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <input type="number" min={0} max={100} step={1} value={draftRate}
                  onChange={(ev) => setDraftRate(Math.max(0, Math.min(100, Number(ev.target.value))))}
                  className="w-full bg-transparent px-2 py-1.5 text-sm font-semibold tabular-nums outline-none" />
                <span className="shrink-0 border-l border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">%</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">role {roleRate}%</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Bonus</label>
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <span className="shrink-0 border-r border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">$</span>
                <input type="number" step={25} value={draftBonus}
                  onChange={(ev) => setDraftBonus(Number(ev.target.value))}
                  className="w-full bg-transparent px-2 py-1.5 text-sm font-semibold tabular-nums outline-none" />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">+ reward / − dock</p>
            </div>
          </div>
          <div className="space-y-0.5 rounded-lg bg-background px-3 py-2 text-xs">
            <div className="flex items-center justify-between font-mono text-muted-foreground"><span>Salary</span><span>{money(draftBase)}</span></div>
            <div className="flex items-center justify-between font-mono text-muted-foreground"><span>Commission ({draftRate}% × {money(p.basis)})</span><span>{money(previewCommission)}</span></div>
            <div className="flex items-center justify-between font-mono text-muted-foreground"><span>Bonus</span><span>{draftBonus >= 0 ? '+' : '−'}{money(Math.abs(draftBonus))}</span></div>
            <div className="flex items-center justify-between border-t border-border pt-1 font-semibold text-foreground"><span>Total</span><span>{money(previewTotal)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold transition hover:bg-accent">Cancel</button>
            <button onClick={saveEdit} className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110">Save</button>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {([
          { label: 'Fixed', val: money(e.base) },
          { label: 'Commission', val: money(e.commission) },
          { label: 'Bonus', val: bonusSet ? `+${money(e.bonus)}` : money(0), tone: bonusSet ? 'text-emerald-600' : '' },
          { label: 'Total', val: money(e.total), accent: !paid },
        ] as { label: string; val: string; accent?: boolean; tone?: string }[]).map(({ label, val, accent, tone }) => (
          <div key={label} className="rounded-xl border border-border p-2.5">
            <p className={`display text-base font-bold ${accent ? 'text-amber-600' : paid && label === 'Total' ? 'text-muted-foreground line-through' : tone ?? ''}`}>{val}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* orders breakdown (commission basis) */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commission basis · {p.completedOrders} qualifying order{p.completedOrders !== 1 ? 's' : ''}</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="p-2.5 text-left">Code</th><th className="p-2.5 text-left">Service</th>
                <th className="p-2.5 text-left">Customer</th><th className="p-2.5 text-right">Value</th>
                <th className="p-2.5 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2.5 font-semibold text-primary">{o.code}</td>
                  <td className="p-2.5 text-muted-foreground">{o.service}</td>
                  <td className="p-2.5 font-medium">{o.customer}</td>
                  <td className="p-2.5 text-right tabular-nums">{money(o.value)}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold text-amber-600">{money(Math.round(o.value * e.rate))}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No qualifying orders — salary{bonusSet ? ' + bonus' : ''} only.</td></tr>
              )}
            </tbody>
            {orders.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td colSpan={3} className="p-2.5 text-muted-foreground">Total @ {effRatePct}%</td>
                  <td className="p-2.5 text-right tabular-nums">{money(p.basis)}</td>
                  <td className="p-2.5 text-right tabular-nums text-amber-600">{money(e.commission)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* action */}
      {!paid ? (
        <div className="border-t border-border pt-4">
          <button onClick={onMarkPaid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110">
            <i className="ph-bold ph-check-circle" /> Mark {money(e.total)} as paid
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 py-3 text-sm font-semibold text-emerald-600">
          <i className="ph-bold ph-check-circle" /> Paid this session
        </div>
      )}
    </div>
  );
}

function PayoutHistoryView({ h }: { h: { date: string; txs: Transaction[]; total: number } }) {
  const note = h.txs[0]?.note ?? 'Commission payout';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-700"><i className="ph-bold ph-check-circle" />Settled {h.date} · {note}</span>
        <span className="font-semibold text-foreground">{h.txs.length} payout{h.txs.length !== 1 ? 's' : ''} · {money(h.total)}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Staff</th><th className="p-3">Method</th><th className="p-3">Note</th>
              <th className="p-3">Status</th><th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {h.txs.map((t) => (
              <tr key={t.id} className="border-b border-border/50">
                <td className="p-3">
                  {t.partyId
                    ? <Link href={`/admin/staff/${t.partyId}`} className="font-medium hover:underline">{t.party}</Link>
                    : <span className="font-medium">{t.party}</span>}
                </td>
                <td className="p-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><i className={`ph-bold ${TX_METHOD[t.method].icon}`} />{TX_METHOD[t.method].label}</span></td>
                <td className="p-3 text-muted-foreground">{t.note}</td>
                <td className="p-3"><TxStatusPill status={t.status} /></td>
                <td className="p-3 text-right font-semibold tabular-nums">{money(Math.abs(t.amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
              <td colSpan={4} className="p-3 text-muted-foreground">Total paid out</td>
              <td className="p-3 text-right tabular-nums">{money(h.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Invoices */
function InvoicesTab() {
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [paidIds, setPaidIds] = usePersistedState<Record<string, boolean>>('invoicePaid', {});
  const [remindedIds, setRemindedIds] = usePersistedState<Record<string, boolean>>('invoiceReminded', {});

  const effStatus = (i: Invoice): InvoiceStatus => (paidIds[i.id] ? 'paid' : i.status);

  const sorted = useMemo(() => [...INVOICES].sort((a, b) => b.issued.localeCompare(a.issued)), []);
  const rows = sorted.filter((i) => status === 'all' || effStatus(i) === status);
  const counts = {
    all: INVOICES.length,
    overdue: INVOICES.filter((i) => effStatus(i) === 'overdue').length,
    due: INVOICES.filter((i) => effStatus(i) === 'due').length,
    paid: INVOICES.filter((i) => effStatus(i) === 'paid').length,
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
        {(['all', 'overdue', 'due', 'paid'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-md px-2.5 py-1 capitalize transition ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{s} · {counts[s]}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3">Issued</th>
              <th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const st = effStatus(i);
              const justPaid = !!paidIds[i.id];
              const reminded = !!remindedIds[i.id];
              return (
                <tr key={i.id} className="border-b border-border/50 transition hover:bg-muted/40">
                  <td className="p-3"><span className="font-semibold">{i.code}</span><span className="block text-[11px] text-muted-foreground">{i.orderCodes.join(', ')}</span></td>
                  <td className="p-3"><Link href={`/admin/customers/${i.customerId}`} className="font-medium hover:underline">{i.customer}</Link></td>
                  <td className="p-3 text-muted-foreground">{i.issued}</td>
                  <td className="p-3 text-muted-foreground">{i.due}</td>
                  <td className="p-3">
                    <span className={`pill ${INVOICE_STATUS[st].pill}`}>{INVOICE_STATUS[st].label}</span>
                    {justPaid && <span className="ml-1 text-[10px] font-semibold text-emerald-600">✓ now</span>}
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{money(i.amount)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {st === 'paid' ? (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      ) : (
                        <>
                          {st === 'overdue' && (
                            reminded
                              ? <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] font-semibold text-emerald-600"><i className="ph-bold ph-check" />Reminded</span>
                              : <button onClick={() => setRemindedIds((s) => ({ ...s, [i.id]: true }))}
                                  title={`Send a payment reminder to ${i.customer}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold transition hover:bg-accent"><i className="ph-bold ph-bell" />Remind</button>
                          )}
                          <button onClick={() => setPaidIds((s) => ({ ...s, [i.id]: true }))}
                            title={`Mark ${i.code} as paid`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-check-circle" />Mark paid</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No invoices.</td></tr>}
          </tbody>
          {rows.length > 0 && (() => {
            const total = rows.reduce((s, i) => s + i.amount, 0);
            const outstanding = rows.filter((i) => effStatus(i) !== 'paid').reduce((s, i) => s + i.amount, 0);
            const paid = rows.filter((i) => effStatus(i) === 'paid').reduce((s, i) => s + i.amount, 0);
            return (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
                  <td className="p-3 text-muted-foreground">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</td>
                  <td colSpan={3} className="p-3">
                    <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                      {outstanding > 0 && <span className="text-amber-600">Outstanding {money(outstanding)}</span>}
                      {paid > 0 && <span className="text-emerald-600">Paid {money(paid)}</span>}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{money(total)}</td>
                  <td className="p-3" />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- shared */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Amount({ n, status }: { n: number; status?: Transaction['status'] }) {
  const failed = status === 'failed';
  const color = failed ? 'text-muted-foreground line-through' : n >= 0 ? 'text-emerald-600' : 'text-rose-500';
  return <span className={`font-semibold tabular-nums ${color}`}>{n >= 0 ? '+' : '−'}{money(Math.abs(n))}</span>;
}

function TxStatusPill({ status }: { status: Transaction['status'] }) {
  const map = {
    settled: { c: 'pill-live', t: 'Settled' },
    pending: { c: 'pill-warn', t: 'Pending' },
    failed: { c: 'pill-bad', t: 'Failed' },
  }[status];
  return <span className={`pill ${map.c}`}>{map.t}</span>;
}

function Kpi({ icon, label, value, hint, tone = 'primary' }: { icon: string; label: string; value: string; hint?: string; tone?: 'primary' | 'warn' | 'good' }) {
  const toneColor = tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${toneColor}`} />
      </div>
      <p className="display mt-auto text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-sm font-medium">{value}</span></div>;
}
