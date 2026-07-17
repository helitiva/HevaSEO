import Link from 'next/link';
import { RingStat } from '@/components/admin/RingStat';
import { MiniBars } from '@/components/admin/MiniBars';
import { NeedsAttention } from './NeedsAttention';
import { PIPELINE_COLOR, money, type OpsKpi } from '@/data/adminMock';
import { getOrders } from '@/data/orders.server';
import { getOpsSnapshot } from '@/data/adminOps.server';
import { getRevenueBook } from '@/data/adminRevenue.server';
import { getAuditFeed } from '@/data/adminAudit.server';

export const metadata = { title: 'Command center' };

export default async function CommandCenter() {
  // Everything here is REAL + RLS-scoped (admin → whole tenant): orders, the ops KPIs/pipeline, the
  // money book, and the activity feed. It used to render adminMock constants, so the dashboard reported
  // a fixed $18,650 MTD and 6 new orders regardless of the business — and an activity list frozen on
  // 2026-06-24 that never moved no matter what anyone did. The clock is the real one too (the Phase-0
  // MOCK_TODAY anchor put "today" in June while live orders are dated now, which broke every
  // overdue/today figure).
  const [orders, ops, rev, audit] = await Promise.all([getOrders(), getOpsSnapshot(), getRevenueBook(), getAuditFeed(8)]);
  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  // Only work still IN FLIGHT can be overdue or unassigned — once it's delivered/approved/completed the
  // deadline is moot. (This list used to count every non-completed order, so delivered work kept showing up
  // as overdue and disagreed with the KPI tile above it.)
  const inFlight = (s: string) => !['delivered', 'approved', 'completed', 'canceled'].includes(s);
  const overdue = orders.filter((o) => o.deadline && o.deadline < today && inFlight(o.status));
  const awaiting = orders.filter((o) => o.status === 'delivered');
  const unassigned = orders.filter((o) => !o.staff && inFlight(o.status));
  const dateLabel = todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const pipeTotal = ops.pipeline.reduce((s, p) => s + p.count, 0) || 1;
  const activeTotal = ops.pipeline.filter((p) => p.status !== 'completed').reduce((s, p) => s + p.count, 0);

  return (
    <section className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel} · live operational snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/analytics" className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:border-primary/50"><i className="ph-bold ph-chart-line-up mr-1 text-primary" aria-hidden />Full analytics</Link>
          <span className="pill pill-live"><span /> Live</span>
        </div>
      </div>

      {/* ops KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ops.kpis.map((k) => <OpsTile key={k.key} kpi={k} />)}
      </div>

      {/* glance snapshot — each links to its detail surface. Revenue and cash are deliberately SEPARATE
          cards: a top-up is cash we owe back as work (a liability), not revenue. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotCard icon="ph-currency-dollar" title="Revenue · recognized" href="/admin/analytics" cta="Analytics"
          rows={[['Today', money(rev.today.recognized)], ['Month to date', money(rev.mtd.recognized)]]} />
        <SnapshotCard icon="ph-vault" title="Cash & deferred" href="/admin/finance" cta="Finance"
          rows={[['Deposits MTD', money(rev.mtd.deposits)], ['Deferred (owed)', money(rev.deferred.total)]]} />
        <SnapshotCard icon="ph-lifebuoy" title="Support" href="/admin/tickets" cta="Inbox"
          rows={[['Open', String(ops.openTickets)], ['Pending', String(ops.pendingTickets)]]} />

        <div className="kpi">
          <span className="kpi-glow" />
          <p className="text-xs font-semibold text-muted-foreground">Operational health</p>
          <div className="mt-2 flex items-center gap-3">
            <RingStat pct={ops.onTimePct ?? 0} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">
                {ops.onTimePct === null ? 'On-time — no delivered work yet' : 'On-time'}
                {ops.capacityPct !== null && ` · capacity ${ops.capacityPct}%`}
              </p>
              <div className="bar mt-1"><i style={{ width: `${ops.capacityPct ?? 0}%` }} /></div>
            </div>
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Booked MTD</span><span className="font-semibold">{money(rev.mtd.bookings)}</span></div>
            <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Unearned (in flight)</span><span className="font-semibold">{money(rev.deferred.unearnedOrders)}</span></div>
          </div>
        </div>
      </div>

      {/* order pipeline */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-flow-arrow text-primary" aria-hidden /> Order pipeline</p>
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{activeTotal}</span> active · {pipeTotal} total</p>
        </div>
        <div className="seg" style={{ height: '0.75rem' }}>
          {ops.pipeline.map((p) => (
            <i key={p.status} style={{ width: `${(p.count / pipeTotal) * 100}%`, background: PIPELINE_COLOR[p.status] }} title={`${p.label}: ${p.count}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {ops.pipeline.map((p) => (
            <span key={p.status} className="flex items-center gap-1.5 text-xs">
              <span className="legend-dot" style={{ background: PIPELINE_COLOR[p.status] }} />
              <span className="text-muted-foreground">{p.label}</span><span className="font-semibold">{p.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* needs attention — the action core */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-bell-ringing text-primary" aria-hidden /> Needs attention</p>
        <NeedsAttention overdue={overdue} awaiting={awaiting} unassigned={unassigned} today={today} />
      </div>

      {/* recent activity */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scroll text-primary" aria-hidden /> Recent activity</p>
        <ul className="space-y-2.5">
          {audit.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className={`ph-bold ${a.icon}`} aria-hidden /></span>
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{a.change}</span> <span className="text-muted-foreground">· {a.actor}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground" title={a.at.slice(0, 10)}>{relTime(a.at)}</span>
            </li>
          ))}
          {audit.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Nothing has happened yet.</li>}
        </ul>
      </div>
    </section>
  );
}

/**
 * "3h ago" / "5d ago". The mock printed a bare time-of-day (a.at.slice(11)) because every mock event
 * was dated the mock today. Real events span days, so a naked "09:12" would read as this morning.
 */
function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toISOString().slice(0, 10);
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
        {/* only shown when there's a real period-over-period baseline — never a fabricated 0% */}
        {kpi.delta !== 0 && (
          <span className={`pill ${kpi.deltaGood ? 'pill-live' : 'pill-warn'}`}>{kpi.delta > 0 ? '+' : ''}{kpi.delta}%</span>
        )}
      </div>
    </div>
  );
}

