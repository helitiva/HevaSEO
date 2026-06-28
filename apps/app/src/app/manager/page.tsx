import Link from 'next/link';
import { RingStat } from '@/components/admin/RingStat';
import { Donut } from '@/components/admin/Donut';
import { MiniBars } from '@/components/admin/MiniBars';
import { AUDIT_CATEGORY } from '@/data/adminMock';
import { managerScope, customersForPod, MANAGER_PERSONA } from '@/lib/managerScope';
import {
  triageForPod, weekDeadlines, qaHealth, slaHealth, serviceMix,
  rosterWithRebalance, recentActivity, overdueCount, POD_TODAY,
  type WeekDay, type RosterRow,
} from '@/lib/managerPulse';
import { TriageQueue } from '@/components/manager/TriageQueue';
import { buildManagerPerf } from '@/lib/managerPerf';
import { MgrLeverStrip } from '@/components/manager/ManagerScorecard';

// Manager Command Center — an action-first, money-blind snapshot of one pod.
// Top: a single triage queue ("what needs me now") + capacity & the week ahead.
// Middle: QA, SLA and workload-mix health. Bottom: the roster and what just happened.
export default function ManagerOverview() {
  const scope = managerScope(MANAGER_PERSONA);
  const customers = customersForPod(scope);
  const triage = triageForPod(scope);
  const week = weekDeadlines(scope);
  const qa = qaHealth(scope);
  const sla = slaHealth(scope);
  const mix = serviceMix(scope);
  const { roster, rebalance } = rosterWithRebalance(scope);
  const activity = recentActivity(scope);

  const active = roster.reduce((n, r) => n + r.load, 0);
  const totalCap = roster.reduce((n, r) => n + r.capacity, 0);
  const util = totalCap ? Math.round((active / totalCap) * 100) : 0;
  const overdue = overdueCount(scope);
  const perf = buildManagerPerf(MANAGER_PERSONA);
  const dateLabel = new Date(`${POD_TODAY}T09:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">{scope.manager?.name}’s pod</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel} · {roster.length} people · {customers.length} customers</p>
        </div>
        <span className="pill pill-live"><span /> Live</span>
      </header>

      {/* Quick KPI strip — compact nav, the triage queue below is the real work surface. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon="ph-stack" label="Active orders" value={active} href="/manager/orders" />
        <Kpi icon="ph-warning-circle" label="Overdue" value={overdue} tone={overdue ? 'bad' : 'good'} href="/manager/orders" />
        <Kpi icon="ph-seal-check" label="Awaiting review" value={qa.awaiting} tone={qa.awaiting ? 'warn' : 'good'} href="/manager/review" />
        <Kpi icon="ph-lifebuoy" label="Open tickets" value={sla.open} tone={sla.breached ? 'bad' : sla.open ? 'warn' : 'good'} href="/manager/tickets" />
      </div>

      {/* My performance — the manager's own scorecard, linking to the full self-view. */}
      {perf && (
        <Link href="/manager/performance" className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <RingStat pct={perf.composite} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">My manager score</p>
              {perf.weakest
                ? <span className="pill pill-warn"><i className={`ph-bold ${perf.weakest.icon}`} aria-hidden />Focus: {perf.weakest.label}</span>
                : <span className="pill pill-good"><i className="ph-bold ph-trophy" aria-hidden />All levers at goal</span>}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{perf.weakest ? perf.weakest.action : 'Hold the standard — consistency keeps the pod scoring high.'}</p>
            <div className="mt-2 max-w-md"><MgrLeverStrip levers={perf.levers} /></div>
          </div>
          <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary sm:flex">View performance <i className="ph-bold ph-arrow-right" aria-hidden /></span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* HERO — the prioritised action queue (client: filter chips + diversity cap). */}
        <TriageQueue items={triage} />

        {/* Capacity + the week ahead. */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Pod utilization</h2>
            <div className="flex items-center gap-4">
              <RingStat pct={util} />
              <p className="text-xs text-muted-foreground">{active} of {totalCap} slots in use across {roster.length} people</p>
            </div>
            <Link href="/manager/assignment" className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-flow-arrow" aria-hidden />Route work</Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">This week</h2>
              {week.overdue > 0 && <span className="pill pill-bad">{week.overdue} overdue</span>}
            </div>
            <WeekStrip days={week.days} />
          </div>
        </div>
      </div>

      {/* Health row: quality, SLA, workload mix. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><i className="ph-bold ph-shield-check text-primary" aria-hidden />QA health</h2>
          {qa.reviewed === 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <p className="display text-3xl font-bold text-muted-foreground">—</p>
                <span className="text-xs text-muted-foreground">no reviews yet</span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Sent back" value="—" />
                <Mini label="Turnaround" value="—" />
                <Mini label="In queue" value={String(qa.awaiting)} />
              </dl>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <p className="display text-3xl font-bold">{qa.firstPassRate}%</p>
                <span className="text-xs text-muted-foreground">first-pass approval · {qa.reviewed} reviewed</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${qa.firstPassRate}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Sent back" value={`${qa.changesRate}%`} tone={qa.changesRate > 40 ? 'warn' : undefined} />
                <Mini label="Turnaround" value={`${qa.avgTurnaroundDays}d`} />
                <Mini label="In queue" value={String(qa.awaiting)} />
              </dl>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><i className="ph-bold ph-lifebuoy text-primary" aria-hidden />Support SLA</h2>
          <div className="flex items-baseline gap-2">
            <p className={`display text-3xl font-bold ${sla.breached ? 'text-red-600' : ''}`}>{sla.open}</p>
            <span className="text-xs text-muted-foreground">open · {sla.urgent} urgent</span>
          </div>
          <div className="mt-4 space-y-2">
            <SlaBar label="Urgent" value={sla.urgent} total={Math.max(sla.open, 1)} color="#f59e0b" />
            <SlaBar label="Breached" value={sla.breached} total={Math.max(sla.open, 1)} color="#ef4444" />
          </div>
          <Link href="/manager/tickets" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open inbox <i className="ph-bold ph-arrow-right" aria-hidden /></Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><i className="ph-bold ph-chart-donut text-primary" aria-hidden />Workload mix</h2>
          {mix.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active work.</p>
          ) : (
            <div className="flex items-center gap-4">
              <Donut segs={mix} size={116} thickness={14} centerValue={String(active)} centerLabel="active" />
              <ul className="min-w-0 flex-1 space-y-1.5">
                {mix.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
                    <span className="font-semibold">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Team + activity. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Team workload</h2>
            <Link href="/manager/staff" className="text-xs font-semibold text-primary hover:underline">My staff →</Link>
          </div>
          {rebalance && (
            <Link href="/manager/assignment" className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 transition hover:border-amber-500/60 dark:text-amber-400">
              <i className="ph-bold ph-scales shrink-0" aria-hidden />
              <span><b>{rebalance.from.name}</b> is at {rebalance.from.util}% — move ~{rebalance.move} {rebalance.skill} task{rebalance.move > 1 ? 's' : ''} to <b>{rebalance.to.name}</b> ({rebalance.to.util}%).</span>
            </Link>
          )}
          <div className="space-y-2">
            {roster.map((s) => <RosterRowView key={s.id} row={s} />)}
            {roster.length === 0 && <p className="text-sm text-muted-foreground">No staff in this pod yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing recent.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((e) => {
                const cat = AUDIT_CATEGORY[e.category];
                return (
                  <li key={e.id} className="flex gap-2.5 text-xs">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: `${cat.color}1f`, color: cat.color }}><i className={`ph-bold ${cat.icon}`} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug text-foreground">{e.change}</span>
                      <span className="text-[11px] text-muted-foreground">{e.actor} · {shortTime(e.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- subcomponents

const TONE_TEXT = { bad: 'text-red-600', warn: 'text-amber-600', good: 'text-emerald-600', info: 'text-primary' } as const;

function Kpi({ icon, label, value, tone, href }: { icon: string; label: string; value: number; tone?: keyof typeof TONE_TEXT; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><i className={`ph-bold ${icon}`} aria-hidden />{label}</div>
      <p className={`mt-1.5 display text-3xl font-bold ${tone ? TONE_TEXT[tone] : 'text-foreground'}`}>{value}</p>
    </Link>
  );
}

function WeekStrip({ days }: { days: WeekDay[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="flex items-end justify-between gap-1.5" role="group" aria-label="Deadlines this week">
      {days.map((d) => {
        const when = d.isToday ? 'today' : d.isPast ? 'past' : 'upcoming';
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1"
            role="img" aria-label={`${d.label}: ${d.count} deadline${d.count === 1 ? '' : 's'}, ${when}`}>
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{d.count || ''}</span>
            <span className="flex h-16 w-full items-end overflow-hidden rounded-md bg-muted">
              <span className="block w-full rounded-md transition-all" style={{ height: `${d.count ? Math.max(14, (d.count / max) * 100) : 0}%`, background: d.isToday ? 'hsl(var(--primary))' : d.isPast ? '#f59e0b' : 'hsl(var(--primary)/.4)' }} aria-hidden />
            </span>
            <span className={`text-[10px] ${d.isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{d.label}</span>
            {/* Position-based marker so "today" reads without relying on colour alone. */}
            <span className={`h-0.5 w-4 rounded-full ${d.isToday ? 'bg-primary' : d.isPast ? 'bg-amber-500/60' : 'bg-transparent'}`} aria-hidden />
          </div>
        );
      })}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <dd className={`text-sm font-bold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</dd>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function SlaBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></span>
    </div>
  );
}

function RosterRowView({ row }: { row: RosterRow }) {
  const hot = row.util >= 90;
  return (
    <Link href={`/manager/staff/${row.id}`} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 transition hover:border-primary/50">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {row.name}
          {!row.active && <span className="pill pill-warn">paused</span>}
          {row.overdue > 0 && <span className="pill pill-bad"><i className="ph-bold ph-warning" aria-hidden />{row.overdue} overdue</span>}
        </span>
        <span className="text-[11px] text-muted-foreground">{row.role}</span>
      </span>
      {row.trend.length > 0 && <span className="hidden sm:block"><MiniBars data={row.trend} /></span>}
      <span className="w-28 shrink-0">
        <span className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{row.load}/{row.capacity}</span><span className={hot ? 'font-semibold text-amber-600' : ''}>{row.util}%</span></span>
        <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.min(row.util, 100)}%`, background: hot ? '#f59e0b' : 'hsl(var(--primary))' }} /></span>
      </span>
    </Link>
  );
}

/** "09:12" if today, else "Jun 23". Audit `at` is "YYYY-MM-DD HH:MM". */
function shortTime(at: string): string {
  const [date, time] = at.split(' ');
  if (date === POD_TODAY) return time ?? date;
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
