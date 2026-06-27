import Link from 'next/link';
import { RingStat } from '@/components/admin/RingStat';
import { MiniBars } from '@/components/admin/MiniBars';
import { NeedsAttention } from './NeedsAttention';
import {
  KPIS, ORDERS, AUDIT, PIPELINE, PIPELINE_COLOR, OPS_KPIS,
  USER_STATS, TICKET_STATS, SLA_ON_TIME, CAPACITY_USED, REVENUE_GOAL, money,
  type OpsKpi,
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
  const goalPct = Math.min(100, Math.round((REVENUE_GOAL.mtd / REVENUE_GOAL.target) * 100));

  return (
    <section className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel} · live operational snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/analytics" className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:border-primary/50"><i className="ph-bold ph-chart-line-up mr-1 text-primary" />Full analytics</Link>
          <span className="pill pill-live"><span /> Live</span>
        </div>
      </div>

      {/* ops KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPS_KPIS.map((k) => <OpsTile key={k.key} kpi={k} />)}
      </div>

      {/* glance snapshot — each links to its detail surface */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotCard icon="ph-currency-dollar" title="Revenue" href="/admin/analytics" cta="Analytics"
          rows={[['Today', money(KPIS.revenueToday)], ['Month to date', money(KPIS.revenueMtd)]]} />
        <SnapshotCard icon="ph-users" title="Audience" href="/admin/analytics" cta="Analytics"
          rows={[['New today', String(USER_STATS.newToday)], ['Active (DAU)', USER_STATS.dau.toLocaleString('en-US')]]} />
        <SnapshotCard icon="ph-lifebuoy" title="Support" href="/admin/tickets" cta="Inbox"
          rows={[['Open', String(TICKET_STATS.open)], ['Pending', String(TICKET_STATS.pending)]]} />

        <div className="kpi">
          <span className="kpi-glow" />
          <p className="text-xs font-semibold text-muted-foreground">Operational health</p>
          <div className="mt-2 flex items-center gap-3">
            <RingStat pct={SLA_ON_TIME} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">On-time · capacity {CAPACITY_USED}%</p>
              <div className="bar mt-1"><i style={{ width: `${CAPACITY_USED}%` }} /></div>
            </div>
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Revenue goal</span><span className="font-semibold">{goalPct}%</span></div>
            <div className="bar mt-1"><i style={{ width: `${goalPct}%` }} /></div>
          </div>
        </div>
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

      {/* needs attention — the action core */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bell-ringing text-primary" /> Needs attention</p>
        <NeedsAttention overdue={overdue} awaiting={awaiting} unassigned={unassigned} />
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

function SnapshotCard({ icon, title, rows, href, cta }: { icon: string; title: string; rows: [string, string][]; href: string; cta: string }) {
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="display font-bold tracking-tight">{value}</span>
          </div>
        ))}
      </div>
      <Link href={href} className="mt-auto pt-3 text-xs font-semibold text-primary hover:underline">{cta} →</Link>
    </div>
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

