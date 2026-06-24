import Link from 'next/link';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { ServiceMix } from '@/components/admin/ServiceMix';
import { GeoPanel } from '@/components/admin/GeoPanel';
import { SupportStats } from '@/components/admin/SupportStats';
import { TeamPerformance } from '@/components/admin/TeamPerformance';
import { Donut } from '@/components/admin/Donut';
import { RingStat } from '@/components/admin/RingStat';
import { MiniBars } from '@/components/admin/MiniBars';
import { PriorityBadge } from '@/components/admin/StatBadge';
import {
  ORDERS, CUSTOMERS, AUDIT, PIPELINE, PIPELINE_COLOR, OPS_KPIS,
  REVENUE_90, SERVICE_MIX, SLA_ON_TIME, CAPACITY_USED, SOURCE_SPLIT, REVENUE_GOAL, money,
  type AdminOrder, type OpsKpi,
} from '@/data/adminMock';

const ACTION_ICON: Record<string, string> = {
  transition: 'ph-arrows-left-right', assign: 'ph-user-plus', cancel: 'ph-x-circle', edit: 'ph-pencil-simple',
};

export default function CommandCenter() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = ORDERS.filter((o) => o.deadline && o.deadline < today && o.status !== 'completed');
  const awaiting = ORDERS.filter((o) => o.status === 'delivered');
  const unassigned = ORDERS.filter((o) => !o.staff && o.status !== 'completed' && o.status !== 'canceled');
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const pipeTotal = PIPELINE.reduce((s, p) => s + p.count, 0);
  const activeTotal = PIPELINE.filter((p) => p.status !== 'completed').reduce((s, p) => s + p.count, 0);
  const topCustomers = [...CUSTOMERS].sort((a, b) => b.spend - a.spend).slice(0, 4);
  const maxSpend = Math.max(...topCustomers.map((c) => c.spend), 1);
  const convSegs = [
    { label: 'Quick checkout', value: SOURCE_SPLIT.quick, color: '#2563eb' },
    { label: 'Dashboard', value: SOURCE_SPLIT.dashboard, color: '#10b981' },
  ];
  const convTotal = SOURCE_SPLIT.quick + SOURCE_SPLIT.dashboard;
  const goalPct = Math.min(100, Math.round((REVENUE_GOAL.mtd / REVENUE_GOAL.target) * 100));

  return (
    <section className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel} · live operational snapshot</p>
        </div>
        <span className="pill pill-live"><span /> Live</span>
      </div>

      {/* ops KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPS_KPIS.map((k) => <OpsTile key={k.key} kpi={k} />)}
      </div>

      {/* revenue — stacked bars by service + line + date range */}
      <RevenueChart data={REVENUE_90} services={SERVICE_MIX} />

      {/* service mix + geo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ServiceMix data={SERVICE_MIX} />
        <div className="lg:col-span-2"><GeoPanel /></div>
      </div>

      {/* support + team performance */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SupportStats />
        <div className="lg:col-span-2"><TeamPerformance /></div>
      </div>

      {/* order pipeline */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-flow-arrow text-primary" /> Order pipeline</p>
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{activeTotal}</span> active · {pipeTotal} total</p>
        </div>
        <div className="seg" style={{ height: '0.75rem' }}>
          {PIPELINE.map((p) => (
            <i key={p.status} style={{ width: `${(p.count / pipeTotal) * 100}%`, background: PIPELINE_COLOR[p.status] }} title={`${p.label}: ${p.count}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {PIPELINE.map((p) => (
            <span key={p.status} className="flex items-center gap-1.5 text-xs">
              <span className="legend-dot" style={{ background: PIPELINE_COLOR[p.status] }} />
              <span className="text-muted-foreground">{p.label}</span><span className="font-semibold">{p.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* conversion + top customers + health */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-shopping-cart-simple text-primary" /> Acquisition</p>
          <div className="flex items-center gap-5">
            <Donut segs={convSegs} centerValue={String(convTotal)} centerLabel="orders" size={120} />
            <div className="space-y-2">
              {convSegs.map((s) => (
                <div key={s.label} className="text-xs">
                  <p className="flex items-center gap-1.5 font-medium"><span className="legend-dot" style={{ background: s.color }} />{s.label}</p>
                  <p className="text-muted-foreground">{s.value} · {Math.round((s.value / convTotal) * 100)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-crown-simple text-primary" /> Top customers</p>
            <Link href="/admin/customers" className="text-xs font-semibold text-primary hover:underline">All →</Link>
          </div>
          <div className="space-y-2.5">
            {topCustomers.map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name} <span className="text-muted-foreground">· {c.company}</span></span>
                  <span className="font-semibold">{money(c.spend)}</span>
                </div>
                <div className="bar mt-1"><i style={{ width: `${(c.spend / maxSpend) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="kpi">
          <span className="kpi-glow" />
          <p className="text-xs font-semibold text-muted-foreground">Operational health</p>
          <div className="mt-2 flex items-center gap-4">
            <RingStat pct={SLA_ON_TIME} />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground">On-time delivery</p>
                <p className="text-sm font-semibold">{SLA_ON_TIME}%</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Capacity in use</p>
                <div className="bar mt-1"><i style={{ width: `${CAPACITY_USED}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Revenue goal</span>
              <span className="font-semibold">{money(REVENUE_GOAL.mtd)} / {money(REVENUE_GOAL.target)}</span>
            </div>
            <div className="bar mt-1"><i style={{ width: `${goalPct}%` }} /></div>
          </div>
        </div>
      </div>

      {/* needs attention */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bell-ringing text-primary" /> Needs attention</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <AttentionList title="Overdue" href="/admin/orders" rows={overdue} tone="warn" />
          <AttentionList title="Awaiting approval" href="/admin/review" rows={awaiting} tone="primary" />
          <AttentionList title="Unassigned" href="/admin/assignment" rows={unassigned} tone="warn" />
        </div>
      </div>

      {/* recent activity */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scroll text-primary" /> Recent activity</p>
        <ul className="space-y-2.5">
          {AUDIT.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${ACTION_ICON[a.action] ?? 'ph-dot'}`} /></span>
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{a.change}</span> <span className="text-muted-foreground">· {a.actor}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.at.slice(11)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OpsTile({ kpi }: { kpi: OpsKpi }) {
  const toneColor = kpi.tone === 'warn' ? 'text-amber-500' : kpi.tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{kpi.label}</p>
          <p className="display mt-1 text-3xl font-bold tracking-tight">{kpi.value}</p>
        </div>
        <i className={`ph-bold ${kpi.icon} text-lg ${toneColor}`} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <MiniBars data={kpi.trend} />
        <span className={`pill ${kpi.deltaGood ? 'pill-live' : 'pill-warn'}`}>{kpi.delta > 0 ? '+' : ''}{kpi.delta}%</span>
      </div>
    </div>
  );
}

function AttentionList({ title, href, rows, tone }: { title: string; href: string; rows: AdminOrder[]; tone: 'warn' | 'primary' }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {title} <span className={tone === 'warn' ? 'text-amber-500' : 'text-primary'}>{rows.length}</span>
        </p>
        <Link href={href} className="text-[11px] font-semibold text-primary hover:underline">All</Link>
      </div>
      <ul className="space-y-1.5">
        {rows.map((o) => (
          <li key={o.id} className="rounded-lg border border-border/70 bg-background/40 px-2.5 py-1.5 transition hover:border-primary/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{o.code}</span>
              <PriorityBadge priority={o.priority} />
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{o.customer} · {money(o.value)}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-muted-foreground">All clear</li>}
      </ul>
    </div>
  );
}
