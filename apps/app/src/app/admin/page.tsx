import Link from 'next/link';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { ServiceMix } from '@/components/admin/ServiceMix';
import { RingStat } from '@/components/admin/RingStat';
import { MiniBars } from '@/components/admin/MiniBars';
import { PriorityBadge } from '@/components/admin/StatBadge';
import {
  KPIS, ORDERS, STAFF, AUDIT, PIPELINE, PIPELINE_COLOR, OPS_KPIS,
  REVENUE_30, SERVICE_MIX, SLA_ON_TIME, CAPACITY_USED, money,
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

      {/* ops KPI strip — number + trend + delta */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPS_KPIS.map((k) => <OpsTile key={k.key} kpi={k} />)}
      </div>

      {/* revenue & volume — bars + line + time axis + period toggle */}
      <RevenueChart data={REVENUE_30} />

      {/* service mix + on-time/capacity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ServiceMix data={SERVICE_MIX} /></div>
        <div className="kpi">
          <span className="kpi-glow" />
          <p className="text-xs font-semibold text-muted-foreground">On-time delivery</p>
          <div className="mt-2 flex items-center gap-4">
            <RingStat pct={SLA_ON_TIME} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Capacity in use</p>
              <div className="bar mt-1"><i style={{ width: `${CAPACITY_USED}%` }} /></div>
              <p className="mt-1 text-sm font-semibold">{CAPACITY_USED}%</p>
              <p className="mt-3 text-xs text-muted-foreground">Revenue today</p>
              <p className="display text-xl font-bold tracking-tight">{money(KPIS.revenueToday)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* order pipeline — segmented bar */}
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

      {/* workload + needs attention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-users-three text-primary" /> Staff workload</p>
          <div className="space-y-3">
            {STAFF.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.openLoad}/{s.capacity} · <span className="font-semibold text-foreground">{s.composite}</span></span>
                </div>
                <div className="bar mt-1"><i style={{ width: `${(s.openLoad / s.capacity) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <Link href="/admin/staff" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">View staff →</Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bell-ringing text-primary" /> Needs attention</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <AttentionList title="Overdue" href="/admin/orders" rows={overdue} tone="warn" />
            <AttentionList title="Awaiting approval" href="/admin/review" rows={awaiting} tone="primary" />
            <AttentionList title="Unassigned" href="/admin/assignment" rows={unassigned} tone="warn" />
          </div>
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
