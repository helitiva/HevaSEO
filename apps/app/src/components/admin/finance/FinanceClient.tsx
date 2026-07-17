'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { WithdrawalRequests } from '@/components/admin/finance/WithdrawalRequests';
import { AdminPenalties } from '@/components/admin/finance/AdminPenalties';
import { AdminPayroll } from '@/components/admin/finance/AdminPayroll';
import type { AdminPayoutRequest } from '@/data/adminPayouts.server';
import type { AdminPenalty, WalletStaff } from '@/data/adminPenalties.server';
import type { PayrollRun } from '@/data/adminPayroll.server';
import {
  FINANCE, TRANSACTIONS, PAYOUTS, MANAGER_PAYOUTS, STAFF_MANAGER, CUSTOMERS, ORDERS,
  TX_KIND, TX_METHOD, PAYABLE_STATES, PAYOUT_RATE, GIG_RATE, TIER, money,
  type Transaction, type Payout, type ManagerPayout, type AdminOrder, type AdminCustomer,
} from '@/data/adminMock';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { gigPay } from '@/lib/payOverrides';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { CompPayroll } from '@/components/admin/finance/CompPayroll';
import type { PayrollPreview } from '@/data/adminComp.server';
import type { FinanceKpis, RevenueBook, RevenueDay } from '@/data/adminRevenue';
import type { CustomerWallet, LedgerEntry, LedgerKind, PaymentReceipt } from '@/data/adminLedger.server';
import { RevenueSplitChart } from '@/components/admin/finance/RevenueSplitChart';
import { buildPayrollPeriods, currentPenalties, type PayGran, type PayPeriod } from '@/data/adminPayroll';
import { myPenalties } from '@/data/staffMock';
import { PENALTY_TYPE_META, PENALTY_STATUS_META } from '@/lib/staffFinance';

type TabKey = 'overview' | 'transactions' | 'wallets' | 'payouts' | 'invoices';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ph-gauge' },
  { key: 'transactions', label: 'Transactions', icon: 'ph-arrows-left-right' },
  { key: 'wallets', label: 'Wallets', icon: 'ph-wallet' },
  { key: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' },
  // 'invoices' is the URL key (kept — it's linkable), but these rows are RECEIPTS for money already
  // taken, not bills we're chasing. Prepaid business: nobody can owe us.
  { key: 'invoices', label: 'Payments', icon: 'ph-receipt' },
];

/** Name a movement by what it IS: a debit with no order is an adjustment, not an order. */
function movementLabel(e: { kind: LedgerKind; orderCode: string | null }): string {
  return e.kind === 'debit' && !e.orderCode ? 'Credit adjustment' : LEDGER_KIND[e.kind].label;
}

/** How each real ledger movement reads to a finance admin. `flow` is in/out of the customer WALLET. */
const LEDGER_KIND: Record<LedgerKind, { label: string; icon: string; flow: 'in' | 'out'; hint: string }> = {
  topup:      { label: 'Top-up',       icon: 'ph-arrow-circle-down',  flow: 'in',  hint: 'Cash in — becomes credit we owe as work' },
  debit:      { label: 'Order placed',  icon: 'ph-receipt',            flow: 'out', hint: 'Credit spent on an order — not new cash, not yet revenue' },
  refund:     { label: 'Refund',        icon: 'ph-arrow-u-down-left',  flow: 'in',  hint: 'Credit returned to the wallet' },
  cancel_fee: { label: 'Cancellation fee', icon: 'ph-prohibit',        flow: 'out', hint: 'Fee charged against credit on cancellation' },
};

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

export function FinanceClient({ payoutRequests = [], penalties = [], walletStaff = [], payrollRuns = [], compPreview, kpis, days = [], reconcile, ledger = [], payments = [], wallets = [] }: { payoutRequests?: AdminPayoutRequest[]; penalties?: AdminPenalty[]; walletStaff?: WalletStaff[]; payrollRuns?: PayrollRun[]; compPreview?: PayrollPreview; kpis?: FinanceKpis; days?: RevenueDay[]; reconcile?: RevenueBook['reconcile']; ledger?: LedgerEntry[]; payments?: PaymentReceipt[]; wallets?: CustomerWallet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'overview';
  // the KPI band is server-computed from the real book; zeros (not mock figures) if it's ever absent
  const k: FinanceKpis = kpis ?? { grossMtd: 0, refundsMtd: 0, netMtd: 0, walletLiability: 0, payoutsDue: 0, depositsMtd: 0, paymentsInFlight: 0 };
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
        {/* Real, from the ASC 606 book. "Gross" is RECOGNIZED revenue (work delivered this month) — not cash
            in and not orders placed; "Wallet liability" is prepaid credit we still owe as work. */}
        <Kpi icon="ph-currency-dollar" label="Gross · MTD" value={money(k.grossMtd)} tone="good" hint="revenue recognized on delivery" />
        <Kpi icon="ph-chart-line-up" label="Net · MTD" value={money(k.netMtd)} tone="good" hint="after refunds" />
        <Kpi icon="ph-wallet" label="Wallet liability" value={money(k.walletLiability)} hint="prepaid customer credit" />
        <Kpi icon="ph-arrow-u-down-left" label="Refunds · MTD" value={money(k.refundsMtd)} hint="credit refunded" />
        <Kpi icon="ph-hand-coins" label="Payouts due" value={money(k.payoutsDue)} tone="warn" hint="staff + managers" />
        {/* Was "Outstanding AR", which counted every top-up receipt as a customer debt — in a prepaid
            business AR is structurally $0. Cash collected is the number that actually belongs next to
            gross: the same money, before we've earned it. */}
        <Kpi icon="ph-arrow-circle-down" label="Deposits · MTD" value={money(k.depositsMtd)} hint="cash collected — not revenue" />
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
        {tab === 'overview' && <OverviewTab k={k} days={days} ledger={ledger} reconcile={reconcile} />}
        {tab === 'transactions' && <TransactionsTab ledger={ledger} />}
        {tab === 'wallets' && <WalletsTab wallets={wallets} ledger={ledger} />}
        {tab === 'payouts' && <div className="space-y-4">{compPreview && <CompPayroll preview={compPreview} />}<WithdrawalRequests requests={payoutRequests} /><AdminPenalties penalties={penalties} staff={walletStaff} /><AdminPayroll runs={payrollRuns} staff={walletStaff} /><PayoutsTab /></div>}
        {tab === 'invoices' && <PaymentsTab payments={payments} />}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Overview */
/**
 * The books, proving themselves. getRevenueBook() has always computed this identity and nothing ever
 * rendered it — an accounting check that runs and is thrown away protects no one.
 *
 * It is also the tripwire for the failure mode this data layer is most exposed to: every finance query
 * is an unbounded select against PostgREST's max_rows=1000, which TRUNCATES silently rather than
 * erroring. If the ledger ever outgrows that, the totals go quietly wrong — and this line is what turns
 * "quietly" into a red banner.
 */
function ReconcileStrip({ r }: { r: RevenueBook['reconcile'] }) {
  const gap = round2(r.expected - r.deferred);
  const Term = ({ label, value, sign }: { label: string; value: number; sign?: string }) => (
    <span className="flex items-baseline gap-1">
      {sign && <span className="text-muted-foreground/60">{sign}</span>}
      <span className="tabular-nums font-semibold text-foreground">{money(value)}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[11px] ${r.ok ? 'border-border bg-card' : 'border-rose-500/50 bg-rose-500/5'}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${r.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          <i className={`ph-bold ${r.ok ? 'ph-check-circle' : 'ph-warning-octagon'}`} aria-hidden />
          {r.ok ? 'Books tie out' : 'Books do NOT tie out'}
        </span>
        <span className="text-muted-foreground/50">·</span>
        <Term label="deposited" value={r.deposits} />
        <Term label="recognized" value={r.recognized} sign="−" />
        {r.nonOrderSpend > 0 && <Term label="non-order spend" value={r.nonOrderSpend} sign="−" />}
        {r.cancelFees > 0 && <Term label="cancellation fees" value={r.cancelFees} sign="−" />}
        <span className="text-muted-foreground/60">=</span>
        <Term label="deferred (owed as work)" value={r.deferred} />
        {!r.ok && <span className="font-semibold text-rose-600">· off by {money(Math.abs(gap))}</span>}
      </div>
      {!r.ok && (
        <p className="mt-1.5 text-rose-700">
          Cash in doesn&apos;t reconcile to what we owe. Every figure on this page is suspect until this clears —
          suspect truncated reads (PostgREST caps at 1,000 rows), or a ledger movement the book doesn&apos;t model yet.
        </p>
      )}
    </div>
  );
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function OverviewTab({ k, days, ledger, reconcile }: { k: FinanceKpis; days: RevenueDay[]; ledger: LedgerEntry[]; reconcile?: RevenueBook['reconcile'] }) {
  const recent = ledger.slice(0, 6); // already newest-first from the server
  const winDeposits = days.reduce((s, d) => s + d.deposits, 0);
  const winRecognized = days.reduce((s, d) => s + d.recognized, 0);
  const winMax = Math.max(winDeposits, winRecognized, 1);

  // Every alert must be a real thing an admin can act on. Two used to be theatre: "$20,080 in unsettled
  // invoices" (every settled top-up receipt miscounted as a debt) and "1 pending payment · $200" (an
  // adminMock row). Both are gone. An empty alert row now genuinely means nothing needs attention.
  const alerts = [
    k.paymentsInFlight ? { icon: 'ph-hourglass-medium', tone: 'warn' as const, text: `${money(k.paymentsInFlight)} in payments awaiting confirmation`, href: '?tab=invoices' } : null,
    k.payoutsDue ? { icon: 'ph-hand-coins', tone: 'warn' as const, text: `${money(k.payoutsDue)} in staff payouts due`, href: '?tab=payouts' } : null,
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

      {reconcile && <ReconcileStrip r={reconcile} />}

      {/* real: deposits (cash in, a liability) vs revenue recognized on delivery — replaces a generated
          "cashflow in vs out" that was pure adminMock */}
      <RevenueSplitChart days={days} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          {/* Was "Net flow · 30d" off a generated CASHFLOW mock. There is no real cash-OUT ledger to draw
              from, so this shows the split that IS real and matters: cash taken in vs revenue actually earned. */}
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scales text-primary" aria-hidden /> Cash vs earned · {days.length}d</p>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />Deposits in</span>
                <span className="font-semibold tabular-nums text-sky-600">+{money(winDeposits)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${(winDeposits / winMax) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Revenue earned</span>
                <span className="font-semibold tabular-nums text-emerald-600">{money(winRecognized)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(winRecognized / winMax) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Held against work owed</span>
            <span className="font-bold tabular-nums text-foreground">{money(winDeposits - winRecognized)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock-counter-clockwise text-primary" aria-hidden /> Recent transactions</p>
            <Link href="?tab=transactions" scroll={false} className="text-xs font-semibold text-primary hover:underline">All →</Link>
          </div>
          <ul className="divide-y divide-border/60">
            {recent.map((e) => <RecentRow key={e.id} e={e} />)}
            {recent.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No money has moved yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RecentRow({ e }: { e: LedgerEntry }) {
  const meta = LEDGER_KIND[e.kind];
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon}`} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{e.customer} <span className="text-muted-foreground">· {movementLabel(e)}</span></p>
        <p className="text-[11px] text-muted-foreground">{stamp(e.at)}{e.orderCode ? ` · ${e.orderCode}` : ''}</p>
      </div>
      <LedgerAmount n={e.amount} />
    </li>
  );
}

/* ------------------------------------------------------------ Transactions */
// The real credit ledger. Note what ISN'T here versus the mock it replaces: no Method and no Status
// column. credit_ledger records movements that have already happened, so "pending"/"failed" rows
// cannot exist — a ledger row IS settled. Payment method lives on the receipt (Payments tab), not
// on the movement.
const KIND_FILTERS: { key: LedgerKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'topup', label: 'Top-ups' }, { key: 'debit', label: 'Orders' },
  { key: 'refund', label: 'Refunds' }, { key: 'cancel_fee', label: 'Fees' },
];

function TransactionsTab({ ledger }: { ledger: LedgerEntry[] }) {
  const [kind, setKind] = useState<LedgerKind | 'all'>('all');
  const [party, setParty] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LedgerEntry | null>(null);

  // the pickable range is whatever the ledger actually spans — an empty ledger must not produce
  // `undefined` bounds, which would silently filter every row out
  const [min, max] = useMemo(() => {
    const days = ledger.map((e) => e.at.slice(0, 10)).sort();
    const today = new Date().toISOString().slice(0, 10);
    return [days[0] ?? today, days[days.length - 1] ?? today];
  }, [ledger]);
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(max);

  const parties = useMemo(() => [...new Set(ledger.map((e) => e.customer))].sort(), [ledger]);
  const rows = useMemo(() => ledger.filter((e) => {
    const day = e.at.slice(0, 10);
    return (kind === 'all' || e.kind === kind)
      && (!party || e.customer === party)
      && day >= from && day <= to
      && (!search.trim() || `${e.customer} ${e.orderCode ?? ''} ${e.reference ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  }), [ledger, kind, party, search, from, to]);

  // Three separate numbers, never added together. Cash in is real money arriving. Credit spent is the
  // SAME money being committed to an order — counting it as income again would double-count it, and it
  // isn't revenue either way (that's earned on delivery — see the Overview chart).
  const cashIn = rows.filter((e) => e.kind === 'topup').reduce((a, e) => a + e.amount, 0);
  const creditSpent = rows.filter((e) => e.kind === 'debit').reduce((a, e) => a + Math.abs(e.amount), 0);
  const returned = rows.filter((e) => e.kind === 'refund').reduce((a, e) => a + e.amount, 0);

  const exportCsv = () => {
    downloadCsv(
      `transactions_${from}_to_${to}.csv`,
      ['Date', 'Type', 'Customer', 'Order', 'Amount', 'Reference'],
      rows.map((e) => [stamp(e.at), movementLabel(e), e.customer, e.orderCode ?? '', e.amount, e.reference ?? '']),
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
          <option value="">All customers</option>
          {parties.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1 text-xs">
          <input type="date" value={from} min={min} max={to} onChange={(e) => setFrom(e.target.value)} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} min={from} max={max} onChange={(e) => setTo(e.target.value)} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
        </div>
        <div className="relative ml-auto min-w-[12rem] flex-1 sm:flex-none">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, order, ref…" className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary" />
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          title="Download the filtered transactions as CSV"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">
          <i className="ph-bold ph-download-simple" aria-hidden />Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>{rows.length} movement{rows.length !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-circle-down text-sky-600" aria-hidden />Cash in <span className="font-semibold text-sky-600">{money(cashIn)}</span></span>
        <span className="flex items-center gap-1" title="Credit committed to orders — the same money as the top-up, not new income">
          <i className="ph-bold ph-receipt text-muted-foreground" aria-hidden />Credit spent <span className="font-semibold text-foreground">{money(creditSpent)}</span></span>
        {returned > 0 && <span className="flex items-center gap-1"><i className="ph-bold ph-arrow-u-down-left text-amber-600" aria-hidden />Refunded <span className="font-semibold text-amber-600">{money(returned)}</span></span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Date <span className="font-normal normal-case opacity-60" title="The ledger is kept and filtered in UTC">(UTC)</span></th>
              <th className="p-3">Type</th><th className="p-3">Customer</th>
              <th className="p-3">Order</th><th className="p-3 text-right">Amount</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const meta = LEDGER_KIND[e.kind];
              return (
                <tr key={e.id} onClick={() => setSelected(e)}
                  role="button" tabIndex={0} aria-label={`${meta.label} · ${e.customer} · ${money(Math.abs(e.amount))}`}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelected(e); } }}
                  className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{stamp(e.at)}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-1.5 font-medium"><i className={`ph-bold ${meta.icon} ${meta.flow === 'in' ? 'text-emerald-600' : 'text-rose-500'}`} aria-hidden />{movementLabel(e)}</span></td>
                  <td className="p-3 font-medium">{e.customer}</td>
                  <td className="p-3 text-muted-foreground">{e.orderCode ?? '—'}</td>
                  <td className="p-3 text-right"><LedgerAmount n={e.amount} /></td>
                  <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" aria-hidden /></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions match.</td></tr>}
          </tbody>
        </table>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected ? LEDGER_KIND[selected.kind].label : ''}>
        {selected && <TxDetail e={selected} />}
      </SlideOver>
    </div>
  );
}

function TxDetail({ e }: { e: LedgerEntry }) {
  const meta = LEDGER_KIND[e.kind];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-12 w-12 place-items-center rounded-xl ${meta.flow === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}><i className={`ph-bold ${meta.icon} text-xl`} aria-hidden /></span>
        <div>
          <p className="display text-2xl font-bold leading-none"><LedgerAmount n={e.amount} /></p>
          <p className="mt-1 text-xs text-muted-foreground">{meta.label} · {stamp(e.at)}</p>
        </div>
      </div>

      <p className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">{meta.hint}</p>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <KV label="Customer" value={e.customer} />
        <KV label="Linked order" value={e.orderCode ?? '—'} />
        <KV label="Ledger entry" value={e.id.slice(0, 8)} />
        <KV label="Provider ref" value={e.reference ?? '—'} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4 text-sm">
        {e.customerId && (
          <>
            <Link href={`/admin/customers/${e.customerId}`} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-user" aria-hidden />Customer profile</Link>
            <a href={`/admin/customers/${e.customerId}`} target="_blank" rel="noopener noreferrer" title="Open profile in a new tab" aria-label="Open profile in a new tab" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary"><i className="ph-bold ph-arrow-square-out" aria-hidden /></a>
          </>
        )}
        {e.orderCode && <Link href={`/admin/orders?q=${encodeURIComponent(e.orderCode)}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-semibold hover:bg-accent"><i className="ph-bold ph-package" aria-hidden />View order</Link>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Wallets */
/**
 * Real prepaid wallets, from customer_balances — the same rows getRevenueBook sums for the
 * "Wallet liability" KPI, so the two can no longer disagree.
 *
 * They did disagree, loudly: this tab used to render adminMock CUSTOMERS and announce "7 customers
 * holding $2,460 in prepaid credit" directly beneath a KPI band that correctly said $19,728.98. It
 * listed people who don't exist ("Jane Doe · Acme Co · $320") while the real Jane Doe's wallet held
 * $19,728.98 under a different company.
 *
 * The "Top up a customer" button is gone rather than rewired. It appended to localStorage: it looked
 * like granting credit, showed a green "+$50" chip, and never touched a wallet — an admin could believe
 * they'd funded an account that had no money in it. Granting credit for real needs a service-role
 * action (the existing topup() fn is the customer's own provider-backed path); that's a feature to
 * build deliberately, not a button to leave lying.
 */
function WalletsTab({ wallets, ledger }: { wallets: CustomerWallet[]; ledger: LedgerEntry[] }) {
  const [selected, setSelected] = useState<CustomerWallet | null>(null);
  const holders = wallets.filter((w) => w.balance !== 0);
  const liability = holders.reduce((s, w) => s + w.balance, 0);
  const toppedUp = ledger.filter((e) => e.kind === 'topup').reduce((s, e) => s + e.amount, 0);
  const maxBal = Math.max(...holders.map((w) => Math.abs(w.balance)), 1);

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">
        {holders.length} customer{holders.length !== 1 ? 's' : ''} holding <b className="text-foreground">{money(liability)}</b> in prepaid
        credit · {money(toppedUp)} topped up to date. Click a row for the ledger.
        {wallets.length > holders.length && <span className="opacity-70"> · {wallets.length - holders.length} with an empty wallet hidden.</span>}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Customer</th><th className="p-3">Tier</th><th className="p-3">Lifetime spend</th>
              <th className="p-3">Wallet balance</th><th className="p-3">Last active</th><th className="p-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {holders.map((w) => (
              <tr key={w.id} onClick={() => setSelected(w)}
                role="button" tabIndex={0} aria-label={`View wallet ledger for ${w.company || w.name}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(w); } }}
                className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary">
                <td className="p-3">
                  <CustomerHoverCard customer={w.id}><Link href={`/admin/customers/${w.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{w.name}</Link></CustomerHoverCard>
                  {w.company && <span className="text-muted-foreground"> · {w.company}</span>}
                </td>
                <td className="p-3 capitalize text-muted-foreground">{w.tier}</td>
                <td className="p-3 tabular-nums">{money(w.spend)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {/* customer_balances has no >= 0 check constraint, so a negative wallet is representable.
                        It would mean we let work out the door unpaid — say so loudly rather than draw a bar. */}
                    <span className={`font-semibold tabular-nums ${w.balance < 0 ? 'text-rose-600' : ''}`}>{money(w.balance)}</span>
                    {w.balance < 0
                      ? <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600" title="This wallet is overdrawn — work was taken without credit to cover it">OVERDRAWN</span>
                      : <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(w.balance / maxBal) * 100}%` }} /></span>}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{w.lastActive ? w.lastActive.slice(0, 10) : '—'}</td>
                <td className="p-3 text-right text-muted-foreground"><i className="ph-bold ph-caret-right opacity-40" aria-hidden /></td>
              </tr>
            ))}
            {holders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No customer holds prepaid credit yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.company || selected.name} · Wallet ledger` : ''}>
        {selected && <WalletDetail w={selected} entries={ledger.filter((e) => e.customerId === selected.id)} />}
      </SlideOver>
    </div>
  );
}

/** One customer's wallet: the balance, and every movement that produced it — from the same real ledger. */
function WalletDetail({ w, entries }: { w: CustomerWallet; entries: LedgerEntry[] }) {
  const toppedUp = entries.filter((e) => e.kind === 'topup').reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <p className="text-xs text-muted-foreground">Wallet balance</p>
        <p className={`display text-3xl font-bold leading-tight ${w.balance < 0 ? 'text-rose-600' : ''}`}>{money(w.balance)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Credit we hold — owed back to {w.company || w.name} as work, not revenue.</p>
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <KV label="Tier" value={w.tier} />
        <KV label="Last active" value={w.lastActive ? w.lastActive.slice(0, 10) : '—'} />
        <KV label="Topped up" value={money(toppedUp)} />
        <KV label="Spent on orders" value={money(w.spend)} />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ledger · {entries.length} movement{entries.length !== 1 ? 's' : ''}</p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border">
          {entries.map((e) => {
            const meta = LEDGER_KIND[e.kind];
            return (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <i className={`ph-bold ${meta.icon} ${meta.flow === 'in' ? 'text-emerald-600' : 'text-rose-500'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  {/* a debit with no order is the "non-order spend" term in the reconcile identity — a
                      manual/legacy adjustment. Calling it "Order placed" would name it after an order
                      that doesn't exist. */}
                  <span className="font-medium">{movementLabel(e)}</span>
                  {e.orderCode && <span className="text-muted-foreground"> · {e.orderCode}</span>}
                  <span className="block text-[11px] text-muted-foreground">{stamp(e.at)} UTC</span>
                </span>
                <LedgerAmount n={e.amount} />
              </li>
            );
          })}
          {entries.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No movements.</li>}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4 text-sm">
        <Link href={`/admin/customers/${w.id}`} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition hover:brightness-110"><i className="ph-bold ph-user" aria-hidden />Customer profile</Link>
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

/* --------------------------------------------------------------- Payments */
// Receipts for money already taken. This replaces an "Invoices" table that modelled a post-paid
// business we don't run: it had Due dates, an Overdue state, "Remind" and "Mark paid" buttons — and
// its own $20,080 "Outstanding" total. All fiction. We are prepaid: the receipt is written *after*
// the provider confirms the charge, so there is nothing to chase, nothing to mark, and no due date.
// The only real status distinction is whether the provider has confirmed it yet.
const RECEIPT_STATUS: Record<PaymentReceipt['status'], { label: string; pill: string; hint: string }> = {
  issued:     { label: 'Settled',    pill: 'pill-live', hint: 'Provider confirmed the charge — cash is in' },
  processing: { label: 'In flight',  pill: 'pill-warn', hint: 'Charge taken, awaiting provider confirmation' },
  void:       { label: 'Void',       pill: 'pill-bad',  hint: 'Cancelled — never collected' },
};

function PaymentsTab({ payments }: { payments: PaymentReceipt[] }) {
  const [status, setStatus] = useState<PaymentReceipt['status'] | 'all'>('all');
  const rows = payments.filter((p) => status === 'all' || p.status === status);
  const collected = rows.filter((p) => p.status === 'issued').reduce((s, p) => s + p.amount, 0);
  const inFlight = rows.filter((p) => p.status === 'processing').reduce((s, p) => s + p.amount, 0);
  const counts = {
    all: payments.length,
    issued: payments.filter((p) => p.status === 'issued').length,
    processing: payments.filter((p) => p.status === 'processing').length,
    void: payments.filter((p) => p.status === 'void').length,
  };
  const exportCsv = () => {
    downloadCsv('payments.csv', ['Receipt', 'Customer', 'Date', 'Provider', 'Reference', 'Status', 'Amount'],
      rows.map((p) => [p.number, p.customer, stamp(p.at), p.provider, p.providerRef ?? '', RECEIPT_STATUS[p.status].label, p.amount]));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['all', 'issued', 'processing', 'void'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1 transition ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {s === 'all' ? 'All' : RECEIPT_STATUS[s].label} · {counts[s]}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-40">
          <i className="ph-bold ph-download-simple" aria-hidden />Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Receipt</th><th className="p-3">Customer</th>
              <th className="p-3">Paid <span className="font-normal normal-case opacity-60" title="Kept in UTC">(UTC)</span></th>
              <th className="p-3">Provider</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/50 transition hover:bg-muted/40">
                <td className="p-3 font-semibold">{p.number}</td>
                <td className="p-3"><Link href={`/admin/customers/${p.customerId}`} className="font-medium hover:underline">{p.customer}</Link></td>
                <td className="whitespace-nowrap p-3 text-muted-foreground">{stamp(p.at)}</td>
                <td className="p-3 text-muted-foreground">
                  <span className="capitalize">{p.provider}</span>
                  {p.providerRef && <span className="block text-[11px] opacity-70">{p.providerRef}</span>}
                </td>
                <td className="p-3"><span className={`pill ${RECEIPT_STATUS[p.status].pill}`} title={RECEIPT_STATUS[p.status].hint}>{RECEIPT_STATUS[p.status].label}</span></td>
                <td className="p-3 text-right font-semibold tabular-nums">{money(p.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No payments.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 text-xs font-semibold">
                <td className="p-3 text-muted-foreground">{rows.length} receipt{rows.length !== 1 ? 's' : ''}</td>
                {/* 'Collected' means COLLECTED: only 'issued' is confirmed cash. An earlier cut summed
                    status !== 'void', which quietly counted in-flight charges as money we hold — the same
                    filter-doesn't-match-the-label bug as the "Outstanding AR" this page just lost. It
                    read correctly only because no row is 'processing' today. */}
                <td colSpan={4} className="p-3 text-muted-foreground">
                  Collected
                  {inFlight > 0 && <span className="ml-2 font-normal text-amber-600">· {money(inFlight)} in flight, not yet confirmed</span>}
                </td>
                <td className="p-3 text-right tabular-nums">{money(collected)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="px-1 text-[11px] text-muted-foreground">
        These are <b className="text-foreground">receipts for money already collected</b>, one per wallet top-up — not bills.
        Customers pay before we work, so nothing here can be overdue. What we owe <i>them</i> is the{' '}
        <b className="text-foreground">wallet liability</b> above; what they&apos;ve spent is in Transactions.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- shared */
/**
 * ISO timestamp → 'YYYY-MM-DD HH:mm', in UTC, read straight off the string.
 *
 * It must NOT use Date's local getters, for two reasons:
 *
 *  1. HYDRATION. This is a 'use client' component, but Next still server-renders it. A deployed Node
 *     container runs UTC while the admin's browser doesn't, so getHours() would emit different HTML on
 *     each side and React would blow up on hydrate. It never shows in dev because the dev server and
 *     the browser share a timezone — this bug is invisible locally by construction.
 *  2. CONSISTENCY. Every date in this money code is UTC-keyed: the range filter compares
 *     at.slice(0,10), the book's MTD window uses toISOString().slice(0,10), the charts bucket by UTC
 *     day. Rendering local time would make a row *display* 2026-07-18 while every total and filter
 *     counts it as 2026-07-17 — the ledger would disagree with itself.
 *
 * So: the ledger is kept in UTC and shown in UTC. The column header says so.
 */
function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** A signed ledger amount. Green = credit into the wallet, red = out of it. */
function LedgerAmount({ n }: { n: number }) {
  return (
    <span className={`font-semibold tabular-nums ${n >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
      {n >= 0 ? '+' : '−'}{money(Math.abs(n))}
    </span>
  );
}

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
