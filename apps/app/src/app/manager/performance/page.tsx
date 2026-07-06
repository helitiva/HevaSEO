import { PageHeader } from '@/components/shared/PageHeader';
import { RingStat } from '@/components/admin/RingStat';
import { Sparkline } from '@/components/staff/Sparkline';
import {
  MgrScoreBar, MgrLeverRows, WeakestCallout,
} from '@/components/manager/ManagerScorecard';
import { buildManagerPerfReal, selfBenchmark } from '@/lib/managerPerf';
import { getPodOrders } from '@/data/orders.server';
import { getDeliverables } from '@/data/deliverables.server';
import { getStaff } from '@/data/staff.server';
import { getAgentTicketsAction } from '@/app/admin/tickets/actions';

export const metadata = { title: 'Performance' };

// Manager self-view — "how is my pod scoring, and what do I improve next?". Money-blind, computed over
// REAL ops data (orders_mgr, deliverables, tickets, staff). Delivery/quality/responsiveness/team-health
// are real; ratings/leave/assign-lag have no source yet (neutral); there's no score history so the trend
// is flat; and with one real pod the peer benchmark compares against self (neutral).
export default async function ManagerPerformancePage() {
  const [orders, deliverables, staff, tickets] = await Promise.all([
    getPodOrders(), getDeliverables(), getStaff(), getAgentTicketsAction(),
  ]);
  const perf = buildManagerPerfReal(orders, deliverables, tickets, staff);
  const bench = selfBenchmark(perf);
  const s = perf.stats;
  const last = perf.trend[perf.trend.length - 1];
  const prev = perf.trend[perf.trend.length - 2] ?? last;
  const delta = last - prev;
  const vsAvg = perf.composite - bench.avgComposite;

  const headline =
    perf.composite >= 88 ? 'Your pod is delivering at the top of the company — keep it steady.'
      : perf.composite >= 78 ? 'Solid, dependable pod. One lever below tightens the whole score.'
        : 'Momentum is building. Focus the team on your weakest lever this week.';

  // Team development: each pod member's trajectory (improving / slipping under your coaching).
  const team = [...staff].sort((a, b) => b.composite - a.composite);

  return (
    <section className="space-y-4">
      <PageHeader title="My performance" subtitle="How your pod is scoring, and the one lever worth moving next" />

      {/* Hero scorecard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-start gap-4">
            <RingStat pct={perf.composite} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="display text-xl font-bold">Manager score {perf.composite}</h2>
                <span className={`pill ${delta >= 0 ? 'pill-good' : 'pill-warn'}`}>
                  <i className={`ph-bold ${delta >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`} aria-hidden />{delta >= 0 ? `+${delta}` : delta} vs last
                </span>
                <span className={`pill ${vsAvg >= 0 ? 'pill-good' : 'pill-warn'}`} title="vs the anonymized average of other pods">
                  {vsAvg >= 0 ? '+' : ''}{vsAvg} vs peers
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
              <div className="mt-3">
                <MgrScoreBar levers={perf.levers} composite={perf.composite} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" aria-hidden />Score trend</p>
            <span className="text-xs text-muted-foreground">last {perf.trend.length} periods</span>
          </div>
          <Sparkline data={perf.trend} h={72} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Mini label="Now" value={String(last)} />
            <Mini label="Peers" value={String(bench.avgComposite)} />
            <Mini label="Peak" value={String(Math.max(...perf.trend))} />
          </div>
        </div>
      </div>

      {/* Coaching: the weakest lever + the full breakdown vs peer pods */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1"><WeakestCallout weakest={perf.weakest} /></div>
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-pie-slice text-primary" aria-hidden />How your score is built</p>
            <span className="text-[11px] text-muted-foreground">bar marks: <span className="font-semibold text-foreground">| goal</span> · <span className="font-semibold text-muted-foreground">| peer avg</span></span>
          </div>
          <MgrLeverRows levers={perf.levers} bench={bench.avgByLever} weakestKey={perf.weakest?.key ?? null} />
        </div>
      </div>

      {/* Operating discipline — the things that sit on YOU. The personal-hustle half. */}
      <div>
        <SectionLabel icon="ph-lightning" text="What's on you" hint="responsiveness — the queue you personally clear" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile icon="ph-seal-check" label="Review turnaround" value={`${s.reviewTurnaroundDays}d`} sub="submit → reviewed" tone={s.reviewTurnaroundDays <= 1 ? 'good' : 'warn'} />
          <StatTile icon="ph-tray" label="Awaiting review" value={String(s.awaitingReview)} sub={s.awaitingReview ? `oldest ${s.oldestReviewWaitDays}d` : 'queue clear'} tone={s.oldestReviewWaitDays > 1 ? 'warn' : 'good'} />
          <StatTile icon="ph-lifebuoy" label="Ticket SLA" value={s.breachedTickets ? `${s.breachedTickets} breach` : `${s.urgentTickets} urgent`} sub={`${s.openTickets} open`} tone={s.breachedTickets ? 'bad' : s.urgentTickets ? 'warn' : 'good'} />
          <StatTile icon="ph-airplane-takeoff" label="Leave decisions" value={s.pendingLeave ? `${s.pendingLeave} pending` : 'clear'} sub={`avg ${s.avgLeaveDecisionDays}d to decide`} tone={s.pendingLeave ? 'warn' : 'good'} />
          <StatTile icon="ph-flow-arrow" label="Assign lag" value={`${s.avgAssignLagDays}d`} sub="confirmed → routed" tone={s.avgAssignLagDays <= 1 ? 'good' : 'warn'} />
        </div>
      </div>

      {/* Pod outcomes — what the team produced (you're accountable, not the sole author). */}
      <div>
        <SectionLabel icon="ph-target" text="Pod outcomes" hint="the team's delivery & quality this cycle" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon="ph-clock" label="On-time" value={`${s.onTimeAvg}%`} sub="by deadline" tone={s.onTimeAvg >= 85 ? 'good' : 'warn'} />
          <StatTile icon="ph-seal-check" label="First-pass" value={`${s.firstPassRate}%`} sub="no rework" tone={s.firstPassRate >= 70 ? 'good' : 'warn'} />
          <StatTile icon="ph-arrows-counter-clockwise" label="Sent back" value={`${s.changesRate}%`} sub="rework rate" tone={s.changesRate <= 25 ? 'good' : 'warn'} />
          <StatTile icon="ph-warning-circle" label="Overdue" value={String(s.overdue)} sub="active orders" tone={s.overdue ? 'warn' : 'good'} />
          <StatTile icon="ph-gauge" label="Utilization" value={`${s.util}%`} sub={`${s.activeLoad} in flight`} tone={s.util >= 90 ? 'warn' : 'good'} />
          <StatTile icon="ph-scales" label="Load fairness" value={`${s.loadFairness}%`} sub="even spread" tone={s.loadFairness >= 70 ? 'good' : 'warn'} />
        </div>
      </div>

      {/* Team development — who's improving / slipping under your coaching */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-users-three text-primary" aria-hidden />Team development</p>
          <span className="text-xs text-muted-foreground">composite now · throughput trend per person</span>
          <span className="ml-auto flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">{s.improving} improving</span>
            {s.slipping > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">{s.slipping} slipping</span>}
          </span>
        </div>
        {s.skillGaps.length > 0 && (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            <i className="ph-bold ph-warning" aria-hidden />Skill gap: no active cover for <span className="font-semibold">{s.skillGaps.join(', ')}</span> — cross-train or flag to admin.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {team.map((m) => <MemberRow key={m.id} m={m} />)}
        </div>
      </div>
    </section>
  );
}

// ---- small presentational bits (match the manager-surface card style) ----

function SectionLabel({ icon, text, hint }: { icon: string; text: string; hint: string }) {
  return (
    <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <i className={`ph-bold ${icon} text-primary`} aria-hidden />{text}
      <span className="font-normal normal-case">· {hint}</span>
    </p>
  );
}

function StatTile({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const ring = tone === 'bad' ? 'text-red-500' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><i className={`ph-bold ${icon} ${ring}`} aria-hidden />{label}</p>
      <p className="display mt-0.5 text-lg font-bold">{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}

function MemberRow({ m }: { m: { id: string; name: string; role: string; composite: number; active: boolean; trend: number[] } }) {
  const last = m.trend[m.trend.length - 1] ?? m.composite;
  const first = m.trend[0] ?? last;
  const d = last - first;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
        {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">{m.name}{!m.active && <span className="pill pill-warn">paused</span>}</p>
        <p className="truncate text-[11px] text-muted-foreground">{m.role}</p>
      </div>
      <div className="w-16 shrink-0" title="Weekly throughput trend"><Sparkline data={m.trend.length >= 2 ? m.trend : [m.composite, m.composite]} h={26} /></div>
      <div className="shrink-0 text-right">
        <p className="display text-sm font-bold" title="Current composite">{m.composite}</p>
        <p className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold ${d >= 0 ? 'text-emerald-500' : 'text-amber-500'}`} title="Throughput change over the trend">
          <i className={`ph-bold ${d >= 0 ? 'ph-arrow-up' : 'ph-arrow-down'}`} aria-hidden />{d >= 0 ? '+' : ''}{d}
          <span className="font-normal text-muted-foreground">thpt</span>
        </p>
      </div>
    </div>
  );
}
