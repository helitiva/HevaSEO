'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { CashflowChart } from '@/components/admin/finance/CashflowChart';
import {
  FINANCE, TRANSACTIONS, INVOICES, PAYOUTS, MANAGER_PAYOUTS, STAFF_MANAGER, CASHFLOW, CUSTOMERS, ORDERS,
  TX_KIND, TX_METHOD, INVOICE_STATUS, PAYABLE_STATES, PAYOUT_RATE, GIG_RATE, TIER, money,
  type Transaction, type TxKind, type Invoice, type InvoiceStatus, type Payout, type ManagerPayout,
  type AdminOrder, type AdminCustomer,
} from '@/data/adminMock';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { gigPay } from '@/lib/payOverrides';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { buildPayrollPeriods, currentPenalties, type PayGran, type PayPeriod } from '@/data/adminPayroll';
import { myPenalties } from '@/data/staffMock';
import { PENALTY_TYPE_META, PENALTY_STATUS_META } from '@/lib/staffFinance';

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
        <Kpi icon="ph-hand-coins" label="Payouts due" value={money(f.payoutsDue)} tone="warn" hint="staff + managers" />
        <Kpi icon="ph-receipt" label="Outstanding AR" value={money(f.outstandingAr)} tone="warn" hint="unpaid invoices" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition ${tab === t.key ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <i className={`ph-bold ${t.icon}`} aria-hidden />{t.label}
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
              <i className={`ph-bold ${a.icon}`} aria-hidden />{a.text}<i className="ph-bold ph-arrow-right opacity-60" aria-hidden />
            </Link>
          ))}
        </div>
      )}

      <CashflowChart data={CASHFLOW} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scales text-primary" aria-hidden /> Net flow · 30d</p>
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
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock-counter-clockwise text-primary" aria-hidden /> Recent transactions</p>
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
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon}`} aria-hidden /></span>
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
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party, note, order…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary" />
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          title="Download the filtered transactions as CSV"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">
          <i className="ph-bold ph-download-simple" aria-hidden />Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>{rows.length} transactions</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-circle-down text-emerald-600" aria-hidden />Top-ups <span className="font-semibold text-emerald-600">{money(topUps)}</span></span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-receipt text-emerald-600" aria-hidden />Revenue <span className="font-semibold text-emerald-600">{money(revenue)}</span></span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-circle-up text-rose-500" aria-hidden />Out <span className="font-semibold text-rose-500">{money(Math.abs(sumOut))}</span></span>
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
                  <td className="p-3"><span className="inline-flex items-center gap-1.5 font-medium"><i className={`ph-bold ${meta.icon} ${meta.flow === 'in' ? 'text-emerald-600' : 'text-rose-500'}`} aria-hidden />{meta.label}</span></td>
                  <td className="p-3"><span className="font-medium">{t.party}</span>{t.orderCode && <span className="text-muted-foreground"> · {t.orderCode}</span>}</td>
                  <td className="p-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><i className={`ph-bold ${TX_METHOD[t.method].icon}`} aria-hidden />{TX_METHOD[t.method].label}</span></td>
                  <td className="p-3"><TxStatusPill status={t.status} /></td>
                  <td className="p-3 text-right"><Amount n={t.amount} status={t.status} /></td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" aria-hidden /></td>
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
        <span className={`grid h-12 w-12 place-items-center rounded-xl ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon} text-xl`} aria-hidden /></span>
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
            <Link href={`/admin/customers/${cust.id}`} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-user" aria-hidden />Customer profile</Link>
            <a href={`/admin/customers/${cust.id}`} target="_blank" rel="noopener noreferrer" title="Open profile in a new tab" aria-label="Open profile in a new tab" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary"><i className="ph-bold ph-arrow-square-out" aria-hidden /></a>
          </>
        )}
        {t.orderCode && <Link href="/admin/orders" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-semibold hover:bg-accent"><i className="ph-bold ph-package" aria-hidden />View order</Link>}
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
          <i className="ph-bold ph-plus-circle" aria-hidden />Top up a customer
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
                  <td className="p-3"><CustomerHoverCard customer={c.id}><Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link></CustomerHoverCard><span className="text-muted-foreground"> · {c.company}</span></td>
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
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" aria-hidden /></td>
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
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><i className="ph-bold ph-plus-circle text-xl" aria-hidden /></span>
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
          <i className="ph-bold ph-plus-circle" aria-hidden />Add {money(amount > 0 ? amount : 0)} credit
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
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><i className="ph-bold ph-wallet text-xl" aria-hidden /></span>
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
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon}`} aria-hidden /></span>
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
        <button onClick={onTopup} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-plus-circle" aria-hidden />Top up</button>
        <Link href={`/admin/customers/${c.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 font-semibold transition hover:bg-accent"><i className="ph-bold ph-user" aria-hidden />Profile</Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Payouts */
// Same shape (and localStorage key) the staff-profile pay editor writes — gigRates carries
// any per-service gig-rate overrides set there.
type PayoutOverride = { base: number; rate: number; bonus: number; gigRates?: Record<string, number>; gigPkgRates?: Record<string, number> };

// Effective comp for a payout, applying any admin override. Gig pay is recomputed from the
// staffer's per-service gig counts and any per-service rate override (shared with the profile).
function effComp(p: Payout, ov?: PayoutOverride) {
  const base = ov ? ov.base : p.base;
  const rate = ov ? ov.rate / 100 : p.rate;
  const bonus = ov ? ov.bonus : p.bonus;
  const commission = Math.round(p.basis * rate);
  const gig = gigPay(p.gigCounts, ov?.gigRates, ov?.gigPkgRates);
  return { base, rate, bonus, commission, gig, total: base + gig + commission + bonus };
}

// Manager comp: fixed salary + an OVERRIDE on what the pod's STAFF earn — gigPct% of the pod's gig
// pay plus commPct% of the pod's commission. Pod gig/commission are passed in live (they change as
// the admin edits the staff pay rows above). Managers have NO KPI bonus (that is a staff mechanism).
type MgrOverride = { base: number; gigPct: number; commPct: number };
function effMgrComp(m: ManagerPayout, ov: MgrOverride | undefined, podGig: number, podComm: number) {
  const base = ov ? ov.base : m.base;
  const gigPct = ov ? ov.gigPct : Math.round(m.gigPct * 100);
  const commPct = ov ? ov.commPct : Math.round(m.commPct * 100);
  const gigShare = Math.round((podGig * gigPct) / 100);
  const commShare = Math.round((podComm * commPct) / 100);
  const commission = gigShare + commShare;
  return { base, gigPct, commPct, gigShare, commShare, commission, total: base + commission };
}

// A compact inline number editor (prefix/suffix), used for the manager payroll fields.
function NumCell({ value, onChange, prefix, suffix, width = 'w-20' }: { value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; width?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-background px-1.5 py-1 text-xs ${width}`}>
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-transparent text-right tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  );
}

function PayoutsTab() {
  const [paid, setPaid] = usePersistedState<Record<string, boolean>>('payoutsPaid', {});
  const [selected, setSelected] = useState<Payout | null>(null);
  const [overrides, setOverrides] = usePersistedState<Record<string, PayoutOverride>>('payoutOverrides', {});
  const [mgrOv, setMgrOv] = usePersistedState<Record<string, MgrOverride>>('managerPayoutOverridesV2', {});
  const [mgrPaid, setMgrPaid] = usePersistedState<Record<string, boolean>>('managerPayoutsPaid', {});
  const [gran, setGran] = useState<'current' | PayGran>('current');
  const rows = useMemo(() => [...PAYOUTS].sort((a, b) => b.due - a.due), []);
  // A manager earns a % of their pod's gig pay + commission — read LIVE from the same `overrides`
  // state edited in the staff table above, so editing a staffer's pay updates their manager's comp.
  const podGigOf = (managerId: string) =>
    PAYOUTS.filter((p) => STAFF_MANAGER[p.staffId] === managerId)
      .reduce((a, p) => a + effComp(p, overrides[p.staffId]).gig, 0);
  const podCommOf = (managerId: string) =>
    PAYOUTS.filter((p) => STAFF_MANAGER[p.staffId] === managerId)
      .reduce((a, p) => a + effComp(p, overrides[p.staffId]).commission, 0);
  const setMgrField = (m: ManagerPayout, field: keyof MgrOverride, value: number) => setMgrOv((s) => {
    const cur = s[m.managerId] ?? { base: m.base, gigPct: Math.round(m.gigPct * 100), commPct: Math.round(m.commPct * 100) };
    return { ...s, [m.managerId]: { ...cur, [field]: Math.max(0, value) } };
  });

  const effDue = (p: Payout): number => effComp(p, overrides[p.staffId]).total;
  const netDue = (p: Payout): number => effDue(p) - currentPenalties(p.staffId).applied;
  const remaining = rows.filter((p) => !paid[p.staffId]).reduce((a, p) => a + netDue(p), 0);

  const granToggle = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">View</span>
      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-xs font-semibold">
        {([['current', 'Current run'], ['month', 'Monthly'], ['quarter', 'Quarterly']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setGran(k)}
            className={`rounded-md px-2.5 py-1 transition ${gran === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground">{gran === 'current' ? 'live cycle — editable' : 'historical — read-only'}</span>
    </div>
  );

  if (gran !== 'current') {
    return (
      <div className="space-y-3">
        {granToggle}
        <PayrollPeriodView gran={gran} />
      </div>
    );
  }

  const totBase = rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).base, 0);
  const totGig = rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).gig, 0);
  const totComm = rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).commission, 0);
  const totBonus = rows.reduce((a, p) => a + effComp(p, overrides[p.staffId]).bonus, 0);
  const totPen = rows.reduce((a, p) => a + currentPenalties(p.staffId).applied, 0);
  const totNet = rows.reduce((a, p) => a + netDue(p), 0);
  const pendingPenStaff = rows.filter((p) => currentPenalties(p.staffId).pendingCount > 0).length;

  return (
    <div className="space-y-3">
      {granToggle}
      {/* commission rates legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px]">
        <i className="ph-bold ph-percent text-primary" aria-hidden />
        <span className="font-semibold text-foreground">Commission rates:</span>
        {Object.entries(PAYOUT_RATE).map(([role, rate]) => (
          <span key={role} className="rounded-md border border-border bg-background px-2 py-0.5 font-medium text-muted-foreground">
            {role} <span className="font-bold text-foreground">{Math.round(rate * 100)}%</span>
          </span>
        ))}
      </div>
      {/* gig (piece-rate) legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px]">
        <i className="ph-bold ph-package text-primary" aria-hidden />
        <span className="font-semibold text-foreground">Gig pay per delivered gig:</span>
        {Object.entries(GIG_RATE).map(([service, rate]) => (
          <span key={service} className="rounded-md border border-border bg-background px-2 py-0.5 font-medium text-muted-foreground">
            {service} <span className="font-bold text-foreground">{money(rate)}</span>
          </span>
        ))}
      </div>

      <p className="px-1 text-xs text-muted-foreground">Fixed salary + gig pay (piece-rate per delivered gig) + commission on billable work + bonus, less penalties withheld this cycle · <span className="font-semibold text-foreground">{money(remaining)}</span> still to pay{pendingPenStaff > 0 && <> · <span className="font-semibold text-amber-600">{pendingPenStaff} with fines pending review</span></>}. Click a row to edit salary, rate or bonus.</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Staff</th><th className="p-3">Fixed</th><th className="p-3">Gig pay</th><th className="p-3">Commission</th>
              <th className="p-3">Bonus</th><th className="p-3">Penalty</th><th className="p-3">Net pay</th><th className="p-3 text-right">Action</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const isPaid = paid[p.staffId];
              const ov = overrides[p.staffId];
              const e = effComp(p, ov);
              const pen = currentPenalties(p.staffId);
              const net = e.total - pen.applied;
              const dispRate = Math.round(e.rate * 100);
              const baseChanged = !!ov && ov.base !== p.base;
              const rateChanged = !!ov && Math.round(ov.rate) !== Math.round(p.rate * 100);
              return (
                <tr key={p.staffId} onClick={() => setSelected(p)}
                  role="button" tabIndex={0} aria-label={`View payout breakdown for ${p.staff}`}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelected(p); } }}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                  <td className="p-3">
                    <StaffHoverCard staff={p.staffId}><Link href={`/admin/staff/${p.staffId}`} className="font-medium hover:underline" onClick={(ev) => ev.stopPropagation()}>{p.staff}</Link></StaffHoverCard>
                    <span className="text-muted-foreground"> · {p.role}</span>
                    {!p.active && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">inactive</span>}
                  </td>
                  <td className="p-3 tabular-nums">
                    {money(e.base)}
                    {baseChanged && <i className="ph-bold ph-pencil-simple ml-1 text-[9px] text-amber-600" aria-hidden />}
                  </td>
                  <td className="p-3 tabular-nums">
                    {e.gig ? money(e.gig) : <span className="text-muted-foreground">—</span>}
                    <span className="ml-1 text-[10px] text-muted-foreground" title="Delivered gigs this cycle">· {p.gigUnits} gig{p.gigUnits === 1 ? '' : 's'}</span>
                  </td>
                  <td className="p-3 tabular-nums">
                    {money(e.commission)}
                    <span className={`ml-1 text-[10px] font-semibold ${rateChanged ? 'text-amber-700' : 'text-muted-foreground'}`}>@ {dispRate}%</span>
                  </td>
                  <td className="p-3 tabular-nums">
                    {e.bonus ? <span className="font-semibold text-emerald-600">+{money(e.bonus)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 tabular-nums">
                    {pen.applied > 0 ? <span className="font-semibold text-rose-600">−{money(pen.applied)}</span> : <span className="text-muted-foreground">—</span>}
                    {pen.pendingCount > 0 && <span className="ml-1.5 pill pill-warn" title="Penalties pending review"><i className="ph-bold ph-gavel" aria-hidden />{pen.pendingCount}</span>}
                  </td>
                  <td className="p-3 font-semibold tabular-nums">{money(net)}</td>
                  <td className="p-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                    {isPaid
                      ? <span className="pill pill-live">Paid</span>
                      : <button onClick={() => setPaid((s) => ({ ...s, [p.staffId]: true }))} disabled={net <= 0}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">Mark paid</button>}
                  </td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" aria-hidden /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
              <td className="p-3 text-muted-foreground">{rows.length} staff</td>
              <td className="p-3 tabular-nums">{money(totBase)}</td>
              <td className="p-3 tabular-nums">{money(totGig)}</td>
              <td className="p-3 tabular-nums">{money(totComm)}</td>
              <td className="p-3 tabular-nums text-emerald-600">{money(totBonus)}</td>
              <td className="p-3 tabular-nums text-rose-600">{totPen > 0 ? `−${money(totPen)}` : money(0)}</td>
              <td className="p-3 tabular-nums">{money(totNet)}</td>
              <td className="p-3" /><td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ---- Manager payroll ---- */}
      <div className="space-y-2 pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><i className="ph-bold ph-user-circle-gear text-primary" aria-hidden />Manager payroll</h3>
          <span className="text-[11px] text-muted-foreground">Fixed salary + an override on what their pod's staff earn — a % of the pod's gig pay and a % of the pod's commission. Percentages are editable per manager. No KPI bonus.</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Manager</th><th className="p-3">Fixed salary</th><th className="p-3">Pod gig pay</th>
                <th className="p-3">Pod commission</th><th className="p-3">Override</th><th className="p-3">Manager comm</th>
                <th className="p-3">Net pay</th><th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {MANAGER_PAYOUTS.map((m) => {
                const ov = mgrOv[m.managerId];
                const podGig = podGigOf(m.managerId);
                const podComm = podCommOf(m.managerId);
                const e = effMgrComp(m, ov, podGig, podComm);
                const baseVal = ov ? ov.base : m.base;
                const gigPct = ov ? ov.gigPct : Math.round(m.gigPct * 100);
                const commPct = ov ? ov.commPct : Math.round(m.commPct * 100);
                const isPaid = mgrPaid[m.managerId];
                return (
                  <tr key={m.managerId} className="border-b border-border/50 transition hover:bg-muted/40">
                    <td className="p-3">
                      <Link href={`/admin/managers`} className="font-medium hover:underline">{m.manager}</Link>
                      <span className="text-muted-foreground"> · {m.title}</span>
                      <div className="text-[11px] text-muted-foreground">{m.podStaff} staff in pod</div>
                    </td>
                    <td className="p-3"><NumCell prefix="$" value={baseVal} onChange={(v) => setMgrField(m, 'base', v)} width="w-24" /></td>
                    <td className="p-3 tabular-nums text-muted-foreground">{money(podGig)}</td>
                    <td className="p-3 tabular-nums text-muted-foreground">{money(podComm)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="text-foreground">gig</span><NumCell suffix="%" value={gigPct} onChange={(v) => setMgrField(m, 'gigPct', v)} width="w-12" /></span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="text-foreground">comm</span><NumCell suffix="%" value={commPct} onChange={(v) => setMgrField(m, 'commPct', v)} width="w-12" /></span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold tabular-nums">{money(e.commission)}</span>
                      <div className="text-[10px] text-muted-foreground tabular-nums" title="gig share + commission share">{money(e.gigShare)} gig · {money(e.commShare)} comm</div>
                    </td>
                    <td className="p-3 font-semibold tabular-nums">{money(e.total)}</td>
                    <td className="p-3 text-right">
                      {isPaid
                        ? <span className="pill pill-live">Paid</span>
                        : <button onClick={() => setMgrPaid((s) => ({ ...s, [m.managerId]: true }))} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent">Mark paid</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const t = MANAGER_PAYOUTS.reduce((acc, m) => {
                  const e = effMgrComp(m, mgrOv[m.managerId], podGigOf(m.managerId), podCommOf(m.managerId));
                  return { base: acc.base + e.base, comm: acc.comm + e.commission, total: acc.total + e.total };
                }, { base: 0, comm: 0, total: 0 });
                return (
                  <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
                    <td className="p-3 text-muted-foreground">{MANAGER_PAYOUTS.length} managers</td>
                    <td className="p-3 tabular-nums">{money(t.base)}</td>
                    <td className="p-3" />
                    <td className="p-3" />
                    <td className="p-3" />
                    <td className="p-3 tabular-nums">{money(t.comm)}</td>
                    <td className="p-3 tabular-nums">{money(t.total)}</td>
                    <td className="p-3" />
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
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

// Read-only payroll by month / quarter — pick a period and see each staffer's base + commission +
// bonus, penalties withheld and net take-home, plus period totals.
function PayrollPeriodView({ gran }: { gran: PayGran }) {
  const periods = useMemo<PayPeriod[]>(() => buildPayrollPeriods(gran), [gran]);
  const [key, setKey] = useState(periods[0]?.key ?? '');
  const period = periods.find((p) => p.key === key) ?? periods[0];
  if (!period) return <p className="py-8 text-center text-sm text-muted-foreground">No payroll history.</p>;
  const t = period.totals;
  const lines = [...period.lines].sort((a, b) => b.net - a.net);
  const maxNet = Math.max(1, ...lines.map((l) => l.net));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{gran === 'month' ? 'Month' : 'Quarter'}
          <select value={period.key} onChange={(e) => setKey(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-primary">
            {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <span className="ml-auto text-[11px] text-muted-foreground">{period.lines.length} staff · {t.tasks} billable tasks</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-money" label="Base salary" value={money(t.base)} />
        <Kpi icon="ph-package" label="Gig pay" value={money(t.gig)} />
        <Kpi icon="ph-percent" label="Commission" value={money(t.commission)} />
        <Kpi icon="ph-gift" label="Bonus" value={money(t.bonus)} tone="good" />
        <Kpi icon="ph-gavel" label="Penalties" value={t.penalties > 0 ? `−${money(t.penalties)}` : money(0)} tone={t.penalties > 0 ? 'warn' : 'primary'} />
        <Kpi icon="ph-hand-coins" label="Net payroll" value={money(t.net)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Staff</th><th className="p-3 text-right">Tasks</th><th className="p-3 text-right">Fixed</th><th className="p-3 text-right">Gig</th><th className="p-3 text-right">Commission</th>
              <th className="p-3 text-right">Bonus</th><th className="p-3 text-right">Penalty</th><th className="p-3 text-right">Net</th><th className="p-3 w-28">Share</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.staffId} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                <td className="p-3"><StaffHoverCard staff={l.staffId}><Link href={`/admin/staff/${l.staffId}`} className="font-medium hover:underline">{l.staff}</Link></StaffHoverCard><span className="text-muted-foreground"> · {l.role}</span>{!l.active && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">inactive</span>}</td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">{l.tasks}</td>
                <td className="p-3 text-right tabular-nums">{money(l.base)}</td>
                <td className="p-3 text-right tabular-nums">{l.gig ? money(l.gig) : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 text-right tabular-nums">{money(l.commission)}</td>
                <td className="p-3 text-right tabular-nums">{l.bonus ? <span className="font-semibold text-emerald-600">+{money(l.bonus)}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 text-right tabular-nums">{l.penalties > 0 ? <span className="font-semibold text-rose-600">−{money(l.penalties)}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{money(l.net)}</td>
                <td className="p-3"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(l.net / maxNet) * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
              <td className="p-3 text-muted-foreground">{lines.length} staff</td>
              <td className="p-3 text-right tabular-nums">{t.tasks}</td>
              <td className="p-3 text-right tabular-nums">{money(t.base)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.gig)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.commission)}</td>
              <td className="p-3 text-right tabular-nums text-emerald-600">{money(t.bonus)}</td>
              <td className="p-3 text-right tabular-nums text-rose-600">{t.penalties > 0 ? `−${money(t.penalties)}` : money(0)}</td>
              <td className="p-3 text-right tabular-nums">{money(t.net)}</td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Net = base + gig + commission + bonus − penalties. Base is the fixed monthly salary ({gran === 'quarter' ? '×3 for the quarter' : 'one month'}); gig is piece-rate pay (current cycle only in this mock); commission &amp; bonus track that period&apos;s delivered work; penalties are fines applied in the period.</p>
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
  const previewTotal = draftBase + p.gig + previewCommission + draftBonus;
  // Penalties withheld this cycle + the staffer's recent fine history (for context).
  const penCycle = currentPenalties(p.staffId);
  const penHistory = myPenalties(p.staffId);
  const netPay = e.total - penCycle.applied;

  const startEditing = () => {
    setDraftBase(override?.base ?? p.base);
    setDraftRate(override?.rate ?? roleRate);
    setDraftBonus(override?.bonus ?? p.bonus);
    setEditing(true);
  };
  const saveEdit = () => { onSaveOverride({ ...override, base: draftBase, rate: draftRate, bonus: draftBonus }); setEditing(false); };

  return (
    <div className="space-y-5">
      {/* staff header */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <i className="ph-bold ph-user text-xl" aria-hidden />
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
                <i className="ph-bold ph-pencil-simple text-[10px]" aria-hidden /> Edit
              </button>
            )}
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fixed salary{baseChanged && <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-bold text-amber-700">edited</span>}</dt>
              <dd className="font-semibold tabular-nums">{money(e.base)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Gig pay <span className="text-xs">(piece-rate · {p.gigUnits} gig{p.gigUnits === 1 ? '' : 's'})</span></dt>
              <dd className={`font-semibold tabular-nums ${e.gig ? '' : 'text-muted-foreground'}`}>{e.gig ? money(e.gig) : money(0)}</dd>
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

      {/* penalties & net pay */}
      <div>
        <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Penalties &amp; net pay</span>
          <Link href={`/admin/staff/${p.staffId}?`} className="font-normal normal-case text-primary hover:underline">Conduct →</Link>
        </p>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <dl className="space-y-1 text-sm">
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Gross (salary + commission + bonus)</dt><dd className="font-semibold tabular-nums">{money(e.total)}</dd></div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Penalties withheld this cycle{penCycle.pendingCount > 0 && <span className="ml-1.5 pill pill-warn" title="awaiting review"><i className="ph-bold ph-gavel" aria-hidden />{penCycle.pendingCount} pending</span>}</dt>
              <dd className={`font-semibold tabular-nums ${penCycle.applied > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{penCycle.applied > 0 ? `−${money(penCycle.applied)}` : money(0)}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5"><dt className="font-semibold">Net pay</dt><dd className="display text-base font-bold tabular-nums text-primary">{money(netPay)}</dd></div>
          </dl>
          {penCycle.pending > 0 && <p className="mt-2 text-[11px] text-amber-600"><i className="ph-bold ph-warning-circle mr-1" aria-hidden />{money(penCycle.pending)} more in fines pending review — not yet withheld.</p>}
        </div>
        {penHistory.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {penHistory.slice(0, 5).map((pen) => { const meta = PENALTY_TYPE_META[pen.type]; const stm = PENALTY_STATUS_META[pen.status];
              return (
                <div key={pen.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                  <i className={`ph-bold ${meta.icon} text-muted-foreground`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{meta.label}{pen.taskCode && <span className="text-muted-foreground"> · {pen.taskCode}</span>}<span className="block truncate text-[10px] text-muted-foreground">{pen.createdAt} · {pen.reason}</span></span>
                  <span className="shrink-0 font-semibold">−{money(pen.amount)}</span>
                  <span className={`shrink-0 pill ${stm.pill}`}>{stm.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* action */}
      {!paid ? (
        <div className="border-t border-border pt-4">
          <button onClick={onMarkPaid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110">
            <i className="ph-bold ph-check-circle" aria-hidden /> Mark {money(netPay)} as paid
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 py-3 text-sm font-semibold text-emerald-600">
          <i className="ph-bold ph-check-circle" aria-hidden /> Paid this session
        </div>
      )}
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
                              ? <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[11px] font-semibold text-emerald-600"><i className="ph-bold ph-check" aria-hidden />Reminded</span>
                              : <button onClick={() => setRemindedIds((s) => ({ ...s, [i.id]: true }))}
                                  title={`Send a payment reminder to ${i.customer}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold transition hover:bg-accent"><i className="ph-bold ph-bell" aria-hidden />Remind</button>
                          )}
                          <button onClick={() => setPaidIds((s) => ({ ...s, [i.id]: true }))}
                            title={`Mark ${i.code} as paid`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-check-circle" aria-hidden />Mark paid</button>
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
        <i className={`ph-bold ${icon} ${toneColor}`} aria-hidden />
      </div>
      <p className="display mt-auto text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-sm font-medium">{value}</span></div>;
}
