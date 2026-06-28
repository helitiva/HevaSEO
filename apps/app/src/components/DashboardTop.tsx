'use client';

import { useMemo, useState } from 'react';
import { ORDERS, PROJECTS, SERVICES, type Order, type OrderStatus, type ServiceKey } from '@/data/mock';
import { useOrdersStore } from './OrdersStore';
import { CountUp } from './CountUp';
import { QuickOrderButton } from './QuickOrderButton';
import { mockTodayDate } from '@/lib/today';

// TODAY is intentionally derived at call time (inside the component via useMemo) to avoid
// a module-scope frozen date. This const is kept only for the range filter memo dep.
// Do NOT use a module-scope `const TODAY = ...` here; it would freeze at server start.
const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 0, label: 'All time' },
];
const SVC_COLOR: Record<ServiceKey, string> = {
  backlink: '#3b82f6', content: '#10b981', indexer: '#f59e0b', keyword: '#a78bfa', audit: '#ec4899', optimize: '#06b6d4', design: '#f43f5e',
};

const parseUS = (d: string): Date | null => {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
};

export function DashboardTop() {
  const { addedOrders, statusOverrides } = useOrdersStore();
  const [range, setRange] = useState(90);
  const [open, setOpen] = useState(false);
  const statusOf = (o: Order): OrderStatus => statusOverrides[o.id] ?? o.status;

  // Compute the current date inside the render cycle so the filter window advances correctly.
  const today = useMemo(() => mockTodayDate(), []);

  const orders = useMemo(() => {
    const all = [...addedOrders, ...ORDERS];
    if (!range) return all;
    return all.filter((o) => { const d = parseUS(o.date); return d ? (today.getTime() - d.getTime()) / 86400000 <= range : true; });
  }, [addedOrders, range, today]);

  const total = orders.length;
  const completed = orders.filter((o) => statusOf(o) === 'completed').length;
  const inProgress = orders.filter((o) => statusOf(o) === 'progress' || statusOf(o) === 'review').length;
  const activeProjects = PROJECTS.filter((p) => p.status === 'progress').length;

  // Service mix (top services + Other) for the legend + segmented bar.
  const mix = useMemo(() => {
    const counts = new Map<ServiceKey, number>();
    for (const o of orders) counts.set(o.service, (counts.get(o.service) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4).map(([k, n]) => ({ label: SERVICES[k].label, count: n, color: SVC_COLOR[k] }));
    const restCount = sorted.slice(4).reduce((s, [, n]) => s + n, 0);
    if (restCount) top.push({ label: 'Other', count: restCount, color: '#94a3b8' });
    return top;
  }, [orders]);

  const rangeLabel = RANGES.find((r) => r.days === range)?.label ?? 'Last 90 days';

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Overview</h1>
            <span className="pill pill-live"><span /> Live</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Hi Huy 👋 · {activeProjects} active project{activeProjects === 1 ? '' : 's'} · updated 2 minutes ago</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent">
              <i className="ph-bold ph-calendar-blank" /> {rangeLabel} <i className="ph-bold ph-caret-down text-muted-foreground" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 z-50 mt-1.5 w-44 rounded-xl border border-border bg-card p-1 shadow-xl">
                  {RANGES.map((r) => (
                    <button key={r.days} onClick={() => { setRange(r.days); setOpen(false); }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-muted ${range === r.days ? 'font-semibold text-primary' : ''}`}>
                      {r.label}{range === r.days && <i className="ph-bold ph-check" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <QuickOrderButton className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98]" />
        </div>
      </div>

      {/* KPI ROW */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi kpi-glass">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400/30 text-amber-600"><i className="ph-fill ph-crown" /></span>
            <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>VIP</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Membership tier</p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div>
              <p className="display text-2xl font-semibold leading-none tracking-tight">VIP</p>
              <p className="mt-1 text-[11px] text-muted-foreground">15%* off every order</p>
            </div>
            <div className="tier" title="Tier progress">
              <i className="on" style={{ height: '40%' }} /><i className="on" style={{ height: '58%' }} /><i className="on" style={{ height: '76%' }} /><i className="on" style={{ height: '90%' }} /><i style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><i className="ph-bold ph-package" /></span>
            <span className="pill pill-good">{range ? rangeLabel.replace('Last ', '') : 'All'}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Services ordered</p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <p className="display text-2xl font-semibold leading-none tracking-tight"><CountUp value={total} /> <span className="text-sm text-muted-foreground">order{total === 1 ? '' : 's'}</span></p>
            <div className="seg w-16 shrink-0 sm:w-28">
              {mix.map((m) => <i key={m.label} style={{ width: `${Math.round((m.count / Math.max(total, 1)) * 100)}%`, background: m.color }} />)}
            </div>
          </div>
          <div className="mt-2 overflow-hidden">
            <div className="legend-marquee flex w-max">
              {[0, 1].map((k) => (
                <div key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-x-2.5 pr-2.5 text-[10px] text-muted-foreground">
                  {mix.length
                    ? mix.map((m) => <span key={m.label} className="inline-flex items-center gap-1"><span className="legend-dot" style={{ background: m.color }} />{m.label} {m.count}</span>)
                    : <span className="text-muted-foreground/60">No orders in this range</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600"><i className="ph-bold ph-check-circle" /></span>
            <span className="pill pill-good">{completed} done</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Order progress</p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="flex items-end gap-4">
              <div><p className="display text-2xl font-semibold leading-none tracking-tight"><CountUp value={completed} /></p><p className="mt-1 text-[11px] text-muted-foreground">Completed</p></div>
              <div><p className="display text-2xl font-semibold leading-none tracking-tight"><CountUp value={inProgress} /></p><p className="mt-1 text-[11px] text-muted-foreground">In progress</p></div>
            </div>
            <div className="mini-bars" title="Last 7 days">
              <i style={{ height: '45%' }} /><i style={{ height: '60%' }} /><i style={{ height: '40%' }} /><i style={{ height: '80%' }} /><i style={{ height: '55%' }} /><i style={{ height: '70%' }} /><i className="on" style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><i className="ph-bold ph-timer" /></span>
            <span className="pill pill-good">On time</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">On-time completion rate</p>
          {/* TODO(backend): derive from real completion data — order records don't carry an onTime flag yet */}
          <div className="mt-auto flex flex-col justify-end gap-1.5 pt-2">
            <p className="display text-2xl font-semibold leading-none tracking-tight">—</p>
            <p className="text-[11px] text-muted-foreground">Available once order delivery data is connected</p>
          </div>
        </div>
      </section>
    </>
  );
}
