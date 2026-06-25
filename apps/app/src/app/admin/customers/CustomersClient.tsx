'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { SlideOver } from '@/components/admin/SlideOver';
import { StatusBadge } from '@/components/admin/StatBadge';
import { money, TIER, type OrderStatus, type Tier } from '@/data/adminMock';

export type Health = 'good' | 'ok' | 'risk';

export interface PanelOrder { id: string; code: string; service: string; pkg: string; status: OrderStatus; value: number; created: string }
export interface MixRow { service: string; count: number; value: number }
export interface PanelTicket { id: string; subject: string; status: string; priority: string; age: string }

export interface CustomerRow {
  id: string; name: string; company: string; email: string;
  status: 'shadow' | 'claimed'; tier: Tier;
  spend: number; orders: number; balance: number; lastActive: string;
  phone: string; timezone: string; memberSince: string; tags: string[];
  aov: number; activeOrders: number; openTickets: number;
  source: 'quick' | 'dashboard'; churnDays: number; atRisk: boolean; health: Health;
  recentOrders: PanelOrder[]; mix: MixRow[]; tickets: PanelTicket[];
}

const TIER_RANK: Record<Tier, number> = { vip: 4, gold: 3, silver: 2, new: 1 };
const HEALTH: Record<Health, { label: string; dot: string; text: string }> = {
  good: { label: 'Healthy', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  ok: { label: 'Steady', dot: 'bg-sky-500', text: 'text-sky-500' },
  risk: { label: 'At risk', dot: 'bg-red-500', text: 'text-red-500' },
};

type SortKey = 'ltv' | 'orders' | 'recent' | 'credit' | 'name' | 'tier';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'ltv', label: 'Lifetime value' },
  { key: 'orders', label: 'Orders' },
  { key: 'recent', label: 'Last active' },
  { key: 'credit', label: 'Credit balance' },
  { key: 'tier', label: 'Tier' },
  { key: 'name', label: 'Name A–Z' },
];

interface Segment { key: string; label: string; test: (c: CustomerRow) => boolean }
const SEGMENTS: Segment[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'vip', label: 'VIP', test: (c) => c.tier === 'vip' },
  { key: 'gold', label: 'Gold', test: (c) => c.tier === 'gold' },
  { key: 'silver', label: 'Silver', test: (c) => c.tier === 'silver' },
  { key: 'new', label: 'New', test: (c) => c.tier === 'new' },
  { key: 'claimed', label: 'Claimed', test: (c) => c.status === 'claimed' },
  { key: 'shadow', label: 'Shadow', test: (c) => c.status === 'shadow' },
  { key: 'atrisk', label: 'At-risk', test: (c) => c.atRisk },
  { key: 'credit', label: 'Has credit', test: (c) => c.balance > 0 },
  { key: 'active', label: 'Active 7d', test: (c) => c.churnDays <= 7 },
];

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
const joined = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const ago = (d: number) => (d <= 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`);

export function CustomersClient({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState('');
  const [seg, setSeg] = useState('all');
  const [sort, setSort] = useState<SortKey>('ltv');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bentoOpen, setBentoOpen] = useState(true);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const panelCust = useMemo(() => rows.find((c) => c.id === panelId) ?? null, [rows, panelId]);

  const kpis = useMemo(() => {
    const totalLtv = rows.reduce((s, c) => s + c.spend, 0);
    const credit = rows.reduce((s, c) => s + c.balance, 0);
    const claimed = rows.filter((c) => c.status === 'claimed').length;
    const newThisMonth = rows.filter((c) => c.memberSince.startsWith('2026-06')).length;
    const atRisk = rows.filter((c) => c.atRisk).length;
    return {
      total: rows.length, claimed, shadow: rows.length - claimed, newThisMonth,
      totalLtv, avgLtv: Math.round(totalLtv / (rows.length || 1)), credit, atRisk,
    };
  }, [rows]);

  const tierMix = useMemo(() => (['vip', 'gold', 'silver', 'new'] as Tier[]).map((t) => ({
    tier: t, count: rows.filter((c) => c.tier === t).length,
  })), [rows]);
  const topLtv = useMemo(() => [...rows].sort((a, b) => b.spend - a.spend).slice(0, 5), [rows]);
  const churn = useMemo(() => rows.filter((c) => c.atRisk).sort((a, b) => b.spend - a.spend), [rows]);
  const maxSpend = useMemo(() => Math.max(...rows.map((c) => c.spend), 1), [rows]);
  const segCount = (s: Segment) => rows.filter(s.test).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = SEGMENTS.find((s) => s.key === seg)?.test ?? (() => true);
    const list = rows.filter((c) => test(c) && (!q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)));
    const cmp: Record<SortKey, (a: CustomerRow, b: CustomerRow) => number> = {
      ltv: (a, b) => b.spend - a.spend,
      orders: (a, b) => b.orders - a.orders,
      recent: (a, b) => a.churnDays - b.churnDays,
      credit: (a, b) => b.balance - a.balance,
      tier: (a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.spend - a.spend,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(cmp[sort]);
  }, [rows, query, seg, sort]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  const clearSel = () => setSelected(new Set());
  const bulk = (m: string) => { notify(`${m} · ${selected.size} customer${selected.size > 1 ? 's' : ''}`); clearSel(); };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Customers"
        subtitle={`${kpis.total} accounts · ${kpis.claimed} claimed · ${kpis.shadow} shadow`}
        actions={
          <>
            <button onClick={() => notify(`Exported ${filtered.length} customers · CSV`)} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple mr-1" />Export</button>
            <button onClick={() => notify('New customer — form coming soon')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-plus mr-1" />Add customer</button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi icon="ph-users-three" label="Total customers" value={String(kpis.total)} />
        <Kpi icon="ph-user-check" label="Claimed / shadow" value={`${kpis.claimed} / ${kpis.shadow}`} />
        <Kpi icon="ph-user-plus" label="New this month" value={String(kpis.newThisMonth)} tone="good" />
        <Kpi icon="ph-coins" label="Total LTV" value={money(kpis.totalLtv)} tone="good" />
        <Kpi icon="ph-wallet" label="Credit outstanding" value={money(kpis.credit)} tone="warn" />
        <Kpi icon="ph-warning-circle" label="At-risk" value={String(kpis.atRisk)} tone={kpis.atRisk ? 'warn' : undefined} />
      </div>

      {/* Insight bento */}
      <div className="rounded-2xl border border-border bg-card">
        <button onClick={() => setBentoOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold">
          <span className="flex items-center gap-2"><i className="ph-bold ph-chart-pie-slice text-primary" /> Insights</span>
          <i className={`ph-bold ph-caret-down transition ${bentoOpen ? 'rotate-180' : ''}`} />
        </button>
        {bentoOpen && (
          <div className="grid gap-4 border-t border-border p-5 lg:grid-cols-3">
            {/* Tier mix */}
            <Panel icon="ph-medal" title="Tier distribution">
              <div className="space-y-2.5">
                {tierMix.map(({ tier, count }) => {
                  const t = TIER[tier]; const pct = Math.round((count / (kpis.total || 1)) * 100);
                  return (
                    <button key={tier} onClick={() => setSeg(tier)} className="block w-full text-left">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium"><i className={`ph-fill ${t.icon}`} style={{ color: t.color }} />{t.label}</span>
                        <span className="text-muted-foreground">{count} · <b className="text-foreground">{pct}%</b></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.color }} /></div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            {/* Top by LTV */}
            <Panel icon="ph-trophy" title="Top by lifetime value">
              <ol className="space-y-2">
                {topLtv.map((c, i) => {
                  const t = TIER[c.tier];
                  return (
                    <li key={c.id}>
                      <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-muted/50">
                        <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{initials(c.name)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name} <span className="font-normal text-muted-foreground">· {c.company}</span></span>
                        <i className={`ph-fill ${t.icon} shrink-0`} style={{ color: t.color }} title={t.label} />
                        <span className="shrink-0 text-sm font-semibold">{money(c.spend)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Panel>

            {/* Churn watch */}
            <Panel icon="ph-pulse" title="Churn watch" right={churn.length ? <span className="pill pill-warn">{churn.length}</span> : undefined}>
              {churn.length ? (
                <ul className="space-y-2">
                  {churn.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-red-500/10 text-[11px] font-bold text-red-500">{initials(c.name)}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/customers/${c.id}`} className="block truncate text-sm font-medium hover:underline">{c.name}</Link>
                        <p className="text-[11px] text-muted-foreground">{ago(c.churnDays)} · {money(c.spend)} LTV</p>
                      </div>
                      <a href={`mailto:${c.email}`} className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple" /></a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid place-items-center py-6 text-center"><i className="ph-bold ph-confetti mb-1 text-xl text-emerald-500" /><p className="text-sm text-muted-foreground">No one at risk right now.</p></div>
              )}
            </Panel>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company or email…" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary">
            {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(['table', 'cards'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`grid h-8 w-8 place-items-center rounded-md transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} title={v} aria-label={v}><i className={`ph-bold ${v === 'table' ? 'ph-rows' : 'ph-squares-four'}`} /></button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => {
            const n = segCount(s); const on = seg === s.key;
            return (
              <button key={s.key} onClick={() => setSeg(s.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                {s.label}<span className={`rounded-full px-1 text-[10px] ${on ? 'bg-primary-foreground/20' : 'bg-muted text-foreground'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <span className="flex-1" />
          <button onClick={() => bulk('Email sent')} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple mr-1" />Email</button>
          <button onClick={() => bulk('Tag added')} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-tag mr-1" />Add tag</button>
          <button onClick={() => bulk('Exported')} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple mr-1" />Export</button>
          <button onClick={clearSel} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card py-16 text-center">
          <i className="ph-bold ph-users mb-2 text-2xl text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No customers match your filters.</p>
          <button onClick={() => { setQuery(''); setSeg('all'); }} className="mt-2 text-xs font-semibold text-primary hover:underline">Clear filters</button>
        </div>
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="w-9 p-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" aria-label="Select all" /></th>
                <th className="p-3">Customer</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Lifetime value</th>
                <th className="p-3 text-right">AOV</th>
                <th className="p-3 text-right">Credit</th>
                <th className="p-3 text-center">Tickets</th>
                <th className="p-3">Health</th>
                <th className="p-3">Last active</th>
                <th className="p-3">Joined</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const t = TIER[c.tier]; const h = HEALTH[c.health]; const sel = selected.has(c.id);
                return (
                  <tr key={c.id} onClick={() => setPanelId(c.id)} className={`group cursor-pointer border-b border-border/50 transition hover:bg-muted/40 ${sel ? 'bg-primary/5' : ''}`}>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="accent-primary" aria-label={`Select ${c.name}`} /></td>
                    <td className="p-3">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{initials(c.name)}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium group-hover:underline">{c.name}</span>
                            <i className={`ph-fill ${t.icon} shrink-0 text-xs`} style={{ color: t.color }} title={`${t.label} tier`} />
                            <span className={`pill shrink-0 ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{c.company} · {c.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.orders}{c.activeOrders > 0 && <span className="block text-[10px] font-medium text-primary">{c.activeOrders} active</span>}</td>
                    <td className="p-3 text-right">
                      <span className="font-semibold tabular-nums">{money(c.spend)}</span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/60" style={{ width: `${Math.round((c.spend / maxSpend) * 100)}%` }} /></span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">{money(c.aov)}</td>
                    <td className="p-3 text-right tabular-nums">{c.balance > 0 ? <span className="font-semibold text-emerald-500">{money(c.balance)}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3 text-center">{c.openTickets > 0 ? <span className="pill pill-warn">{c.openTickets}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${h.dot}`} /><span className={`text-xs font-medium ${h.text}`}>{h.label}</span></span></td>
                    <td className="p-3"><span className="text-muted-foreground">{ago(c.churnDays)}</span>{c.atRisk && <span className="ml-1 pill pill-warn">churn</span>}</td>
                    <td className="p-3 text-muted-foreground">{joined(c.memberSince)}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><RowMenu c={c} notify={notify} onView={() => setPanelId(c.id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const t = TIER[c.tier]; const h = HEALTH[c.health];
            return (
              <div key={c.id} onClick={() => setPanelId(c.id)} className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{initials(c.name)}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5"><span className="truncate font-semibold">{c.name}</span><i className={`ph-fill ${t.icon} text-xs`} style={{ color: t.color }} title={t.label} /></span>
                      <span className="block truncate text-xs text-muted-foreground">{c.company}</span>
                    </span>
                  </span>
                  <span className={`pill shrink-0 ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="LTV" value={money(c.spend)} />
                  <Mini label="Orders" value={String(c.orders)} />
                  <Mini label="Credit" value={c.balance > 0 ? money(c.balance) : '—'} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${h.dot}`} /><span className={`font-medium ${h.text}`}>{h.label}</span></span>
                  <span className="text-muted-foreground">{ago(c.churnDays)}{c.openTickets > 0 && <> · <i className="ph-bold ph-lifebuoy" /> {c.openTickets}</>}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SlideOver open={!!panelCust} onClose={() => setPanelId(null)} title="Customer">
        {panelCust && <CustomerPanel c={panelCust} notify={notify} />}
      </SlideOver>

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl"><i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" />{toast}</div>}
    </section>
  );
}

const MIX_COLOR = ['#2563eb', '#10b981', '#38bdf8', '#a78bfa', '#f59e0b', '#fb923c', '#34d399'];

function CustomerPanel({ c, notify }: { c: CustomerRow; notify: (m: string) => void }) {
  const t = TIER[c.tier]; const h = HEALTH[c.health];
  const mixSum = c.mix.reduce((s, m) => s + m.value, 0) || 1;
  return (
    <div className="space-y-4">
      {/* identity */}
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-base font-bold text-primary">{initials(c.name)}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="display text-lg font-bold tracking-tight">{c.name}</span>
            <i className={`ph-fill ${t.icon}`} style={{ color: t.color }} title={`${t.label} tier`} />
            <span className={`pill ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span>
            {c.atRisk && <span className="pill pill-warn">churn risk</span>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.company} · member since {joined(c.memberSince)}</p>
          {c.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{c.tags.map((tag) => <span key={tag} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tag}</span>)}</div>}
        </div>
      </div>

      {/* actions */}
      <div className="grid grid-cols-2 gap-2">
        <a href={`mailto:${c.email}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple" />Email</a>
        <button onClick={() => notify(`Magic link sent · ${c.name}`)} className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-user-switch" />Impersonate</button>
      </div>
      <Link href={`/admin/customers/${c.id}`} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-arrow-square-out" />Open full profile</Link>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        <PMini label="Lifetime" value={money(c.spend)} />
        <PMini label="Credit" value={money(c.balance)} />
        <PMini label="Orders" value={String(c.orders)} />
        <PMini label="Avg order" value={money(c.aov)} />
        <PMini label="Active" value={String(c.activeOrders)} />
        <PMini label="Last seen" value={ago(c.churnDays)} />
      </div>

      {/* contact + health */}
      <PCard icon="ph-address-book" title="Contact">
        <div className="space-y-1.5 text-sm">
          <PRow label="Email" value={<a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>} />
          <PRow label="Phone" value={c.phone} />
          <PRow label="Timezone" value={c.timezone} />
          <PRow label="Source" value={<span className="capitalize">{c.source}</span>} />
          <PRow label="Health" value={<span className={`inline-flex items-center gap-1.5 ${h.text}`}><span className={`h-2 w-2 rounded-full ${h.dot}`} />{h.label}</span>} />
        </div>
      </PCard>

      {/* service mix */}
      {c.mix.length > 0 && (
        <PCard icon="ph-chart-donut" title="Service mix">
          <div className="space-y-2">
            {c.mix.map((m, i) => { const pct = Math.round((m.value / mixSum) * 100); return (
              <div key={m.service}>
                <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-full" style={{ background: MIX_COLOR[i % MIX_COLOR.length] }} />{m.service}</span><span className="text-muted-foreground">{m.count} · {money(m.value)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: MIX_COLOR[i % MIX_COLOR.length] }} /></div>
              </div>
            ); })}
          </div>
        </PCard>
      )}

      {/* recent orders */}
      <PCard icon="ph-package" title="Recent orders" right={<span className="text-xs text-muted-foreground">{c.orders} total</span>}>
        {c.recentOrders.length ? (
          <div className="space-y-1.5">
            {c.recentOrders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted/50">
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{o.code}</span> <span className="text-muted-foreground">· {o.service}</span></span>
                <StatusBadge status={o.status} />
                <span className="shrink-0 font-semibold tabular-nums">{money(o.value)}</span>
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No orders yet.</p>}
      </PCard>

      {/* tickets */}
      {c.tickets.length > 0 && (
        <PCard icon="ph-lifebuoy" title="Tickets" right={<Link href="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">Inbox</Link>}>
          <ul className="space-y-2">
            {c.tickets.map((tk) => <li key={tk.id} className="text-sm"><p className="font-medium">{tk.subject}</p><p className="text-[11px] text-muted-foreground capitalize">{tk.status} · {tk.priority} · {tk.age}</p></li>)}
          </ul>
        </PCard>
      )}
    </div>
  );
}
function PMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-background/40 p-2 text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="display text-sm font-bold tabular-nums">{value}</p></div>;
}
function PCard({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-xl border border-border bg-background/40 p-3"><div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function PRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right font-medium">{value}</span></div>;
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${col}`} />
      </div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
function Panel({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>
      {children}
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-sm font-bold tabular-nums">{value}</p></div>;
}
function RowMenu({ c, notify, onView }: { c: CustomerRow; notify: (m: string) => void; onView: () => void }) {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: 'ph-sidebar', label: 'Quick view', fn: onView },
    { icon: 'ph-arrow-square-out', label: 'Full profile', href: `/admin/customers/${c.id}` },
    { icon: 'ph-envelope-simple', label: 'Email', fn: () => notify(`Email · ${c.name}`) },
    { icon: 'ph-user-switch', label: 'Impersonate', fn: () => notify(`Magic link sent · ${c.name}`) },
    { icon: 'ph-wallet', label: 'Adjust credit', fn: () => notify(`Adjust credit · ${c.name}`) },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Actions"><i className="ph-bold ph-dots-three-outline" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1.5 shadow-xl">
            {items.map((i) => i.href ? (
              <Link key={i.label} href={i.href} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted"><i className={`ph-bold ${i.icon} text-muted-foreground`} /> {i.label}</Link>
            ) : (
              <button key={i.label} onClick={() => { i.fn?.(); setOpen(false); }} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted"><i className={`ph-bold ${i.icon} text-muted-foreground`} /> {i.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
