'use client';

// Admin staff profile — the manager's-eye view of one person. Brings the staffer's own
// /staff/performance and /staff/finance surfaces into admin (admin sees money), organised into
// tabs: Overview · Performance · Pay & wallet · Conduct · History. Read-driven from the shared
// StaffInsight bundle; a few edit controls (pause / capacity / skills) keep it actionable.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { WorkActivityChart } from '@/components/staff/WorkActivityChart';
import { DeadlineCalendar, type CalTask } from '@/components/staff/DeadlineCalendar';
import { monthOf } from '@/lib/calendar';
import { statusLabel, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';
import { useMoney, useShowMoney, useImpersonatePolicy, useAreaBase } from '@/lib/viewer';
import { usePayOverride, effectivePay } from '@/lib/payOverrides';
import { ACTIVITY_TYPE_META, PENALTY_RULES } from '@/data/staffMock';
import type { StaffInsight } from '@/data/adminStaffInsight';
import { PENALTY_TYPE_META, PENALTY_STATUS_META, PAYOUT_METHOD_META, PAYOUT_STATUS_META, WALLET_KIND_META } from '@/lib/staffFinance';
import { COMMISSION_TIERS } from '@/lib/staff';
import { REWARD_KIND_META } from '@/lib/staffRewards';
import { impersonate } from '@/lib/impersonation';

export interface ProfileOrder {
  id: string; code: string; service: string; pkg: string; status: OrderStatus;
  priority: Priority; value: number; customer: string; tier: Tier; daysToDue: number;
  deadline: string | null;
}
export interface Workload {
  capacity: number; load: number; valueInFlight: number; valueDelivered: number;
  overdue: number; dueSoon: number; active: ProfileOrder[]; shipped: ProfileOrder[];
}
export interface TeamAvg { composite: number; quality: number; onTime: number; throughput: number }
type SkillMeta = Record<string, { label: string; icon: string; color: string }>;
type TierMeta = Record<string, { label: string; icon: string; color: string }>;

interface Props {
  insight: StaffInsight;
  workload: Workload;
  teamAvg: TeamAvg;
  skillMeta: SkillMeta;
  tierMeta: TierMeta;
  serviceSkill: Record<string, string>;
}

type Tab = 'overview' | 'performance' | 'pay' | 'conduct' | 'history';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ph-squares-four' },
  { key: 'performance', label: 'Performance', icon: 'ph-chart-bar' },
  { key: 'pay', label: 'Pay & wallet', icon: 'ph-wallet' },
  { key: 'conduct', label: 'Conduct', icon: 'ph-gavel' },
  { key: 'history', label: 'History', icon: 'ph-clock-counter-clockwise' },
];

export function StaffProfileClient({ insight, workload, teamAvg, skillMeta, tierMeta, serviceSkill }: Props) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const imp = useImpersonatePolicy();
  const areaBase = useAreaBase();
  // Money-blind viewers (managers) never see a staffer's pay/wallet — drop the
  // whole finance tab, not just the figures.
  const tabs = showMoney ? TABS : TABS.filter((t) => t.key !== 'pay');
  const [tab, setTab] = useState<Tab>('overview');
  const [active, setActive] = useState(insight.active);
  const [capacity, setCapacity] = useState(workload.capacity);
  const [skills, setSkills] = useState<string[]>(insight.skills);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const s = insight;
  const util = Math.round((workload.load / capacity) * 100);
  const over = workload.load > capacity;
  const tenure = tenureFrom(s.since);
  const allSkills = Object.keys(skillMeta);

  const setCap = (n: number) => { const c = Math.max(1, Math.min(20, n)); if (c === capacity) return; setCapacity(c); notify(`Capacity → ${c} slots`); };
  const toggleSkill = (k: string) => { const has = skills.includes(k); setSkills((x) => (has ? x.filter((y) => y !== k) : [...x, k])); notify(`${has ? 'Removed' : 'Added'} ${skillMeta[k].label} skill`); };
  const toggleActive = () => { setActive((a) => !a); notify(active ? 'Paused — excluded from auto-routing' : 'Reactivated'); };
  const eligible = useMemo(() => Object.entries(serviceSkill).filter(([, sk]) => skills.includes(sk)).map(([svc]) => svc), [skills, serviceSkill]);
  // Effective monthly pay, with any admin pay-override applied (shared with Finance › Payouts),
  // so the header KPI and Overview match the editable Compensation card on the Pay tab.
  const { override: payOverride } = usePayOverride(insight.id);
  const payDue = effectivePay({ base: s.payroll.base, rate: s.payroll.rate, basis: s.payroll.basis, gig: s.payroll.gig, bonus: s.payroll.bonus }, payOverride).total;

  return (
    <section className="space-y-4">
      {/* header */}
      <div className="rounded-2xl border border-border bg-card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`${areaBase}/staff`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent" title="Back to staff"><i className="ph-bold ph-arrow-left" aria-hidden /></Link>
            <Avatar name={s.name} size={52} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold tracking-tight">{s.name}</span>
                {active ? <span className="pill pill-live"><span />active</span> : <span className="pill pill-warn"><i className="ph-bold ph-pause" aria-hidden />paused</span>}
                {s.rank && s.rank.rank <= 3 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: ['#f59e0b', '#94a3b8', '#b45309'][s.rank.rank - 1] }}><i className="ph-fill ph-medal" aria-hidden />#{s.rank.rank} in team</span>}
                <span className="pill" style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}><i className="ph-bold ph-seal-check" aria-hidden />{s.tier.current.level} tier</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.role} · {s.email} · {tenure} tenure · {s.tz}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                {s.managerName && <span className="inline-flex items-center gap-1"><i className="ph-bold ph-user-circle-gear" aria-hidden />Reports to {s.managerName}</span>}
                <span className="inline-flex items-center gap-1"><i className="ph-bold ph-coins" aria-hidden />{s.tier.current.mult}× commission band</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">{skills.map((k) => skillMeta[k] && <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium"><i className={`ph-fill ${skillMeta[k].icon}`} style={{ color: skillMeta[k].color }} aria-hidden />{skillMeta[k].label}</span>)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`mailto:${s.email}`} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple mr-1" aria-hidden />Email</a>
            <button onClick={toggleActive} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className={`ph-bold ${active ? 'ph-pause' : 'ph-play'} mr-1`} aria-hidden />{active ? 'Pause' : 'Activate'}</button>
            {imp.canStaff && <button onClick={() => impersonate(s.id, imp.viewOnly ? 'view' : 'act')} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold transition hover:border-primary/50 hover:text-primary" title={imp.viewOnly ? `View ${s.name}’s portal (read-only)` : `Open the staff portal as ${s.name}`}><i className="ph-bold ph-user-switch mr-1" aria-hidden />{imp.viewOnly ? 'View as' : 'Impersonate'}</button>}
            <Link href={`${areaBase}/assignment`} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-arrows-left-right mr-1" aria-hidden />Reassign work</Link>
          </div>
        </div>
      </div>

      {/* KPI strip — performance + pay at a glance */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-medal" label="Composite" value={String(s.composite)} sub={s.rank ? `#${s.rank.rank} of ${s.rank.total} · top ${s.rank.topPercent}%` : `avg ${teamAvg.composite}`} tone="good" />
        <Kpi icon="ph-seal-check" label="Quality" value={`${s.quality}%`} sub={`avg ${teamAvg.quality}%`} tone={s.quality >= teamAvg.quality ? 'good' : undefined} />
        <Kpi icon="ph-clock" label="On-time" value={`${s.onTime}%`} tone={s.onTime < 85 ? 'warn' : undefined} sub={`avg ${teamAvg.onTime}%`} />
        <Kpi icon="ph-gauge" label="Utilization" value={`${util}%`} tone={over ? 'warn' : util < 50 ? undefined : 'good'} sub={`${workload.load}/${capacity} slots`} />
        {showMoney && <Kpi icon="ph-wallet" label="Pay / month" value={money(payDue)} sub={payOverride ? 'custom · salary+gig+comm' : 'salary + gig + comm'} />}
        {showMoney && <Kpi icon="ph-hand-coins" label="Wallet" value={money(s.wallet.balance)} sub={`${money(s.wallet.available)} withdrawable`} tone={s.penalties.pendingCount > 0 ? 'warn' : undefined} />}
      </div>

      {/* tab nav */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            <i className={`ph-bold ${t.icon}`} aria-hidden />{t.label}
            {t.key === 'conduct' && s.penalties.pendingCount > 0 && <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{s.penalties.pendingCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab s={s} payDue={payDue} workload={workload} capacity={capacity} util={util} over={over} teamAvg={teamAvg} tierMeta={tierMeta} setCap={setCap} skills={skills} skillMeta={skillMeta} allSkills={allSkills} toggleSkill={toggleSkill} eligible={eligible} />}
      {tab === 'performance' && <PerformanceTab s={s} teamAvg={teamAvg} />}
      {tab === 'pay' && showMoney && <PayTab s={s} />}
      {tab === 'conduct' && <ConductTab s={s} />}
      {tab === 'history' && <HistoryTab s={s} />}

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

/* ───────────────────────── Overview ───────────────────────── */
function OverviewTab({ s, payDue, workload, capacity, util, over, teamAvg, tierMeta, setCap, skills, skillMeta, allSkills, toggleSkill, eligible }: {
  s: StaffInsight; payDue: number; workload: Workload; capacity: number; util: number; over: boolean; teamAvg: TeamAvg;
  tierMeta: TierMeta; setCap: (n: number) => void; skills: string[]; skillMeta: SkillMeta; allSkills: string[]; toggleSkill: (k: string) => void; eligible: string[];
}) {
  const money = useMoney();
  const showMoney = useShowMoney();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <ScoreCard s={s} teamAvg={teamAvg} />

        <WorkloadCard workload={workload} capacity={capacity} util={util} over={over} setCap={setCap} tierMeta={tierMeta} />
      </div>

      <div className="space-y-4">
        <Card icon="ph-identification-card" title="About">
          <Row label="Email" value={<a href={`mailto:${s.email}`} className="hover:text-primary hover:underline">{s.email}</a>} />
          <Row label="Local time" value={<span className="inline-flex items-center gap-1"><LocalClock tz={s.tz} /><span className="text-muted-foreground">· {s.tz}</span></span>} />
          <Row label="Joined" value={`${s.since} · ${tenureFrom(s.since)}`} />
          <Row label="Reports to" value={s.managerName ?? <span className="text-muted-foreground">—</span>} />
          <Row label="Commission band" value={`${s.tier.current.level} · ${s.tier.current.mult}×`} />
          <Row label="Team rank" value={s.rank ? `#${s.rank.rank} of ${s.rank.total} · top ${s.rank.topPercent}%` : '—'} />
          <Row label="Employee ID" value={<span className="font-mono">{s.id}</span>} />
        </Card>

        {showMoney ? (
        <Card icon="ph-wallet" title="Money snapshot">
          <Row label="Pay this cycle" value={<b>{money(payDue)}</b>} />
          <Row label="Commission wallet" value={money(s.wallet.balance)} />
          <Row label="Withdrawable now" value={money(s.wallet.available)} />
          {s.wallet.clearing > 0 && <Row label="Still clearing" value={<span className="text-amber-600">{money(s.wallet.clearing)}</span>} />}
          <Row label="Pending fines" value={s.penalties.pendingCount > 0 ? <span className="font-semibold text-amber-600">{s.penalties.pendingCount}</span> : <span className="text-emerald-600">none</span>} />
          <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Full breakdown in the Pay &amp; wallet tab.</p>
        </Card>
        ) : (
        <Card icon="ph-gavel" title="Conduct snapshot">
          <Row label="Pending fines" value={s.penalties.pendingCount > 0 ? <span className="font-semibold text-amber-600">{s.penalties.pendingCount}</span> : <span className="text-emerald-600">none</span>} />
          <Row label="Team rank" value={s.rank ? `#${s.rank.rank} of ${s.rank.total}` : '—'} />
          <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Pay &amp; wallet are not visible to managers.</p>
        </Card>
        )}

        <Card icon="ph-trophy" title="Rewards" right={<span className="text-xs text-muted-foreground">{s.rewards.unlocked}/{s.rewards.total}</span>}>
          <div className="mb-2 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><i className="ph-fill ph-medal" aria-hidden />{money(s.rewards.earned)} earned</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{money(s.rewards.onOffer)} on offer</span>
          </div>
          <div className="space-y-1.5">{s.rewards.list.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-xs">
              <i className={`ph-fill ${r.icon} ${r.unlocked ? 'text-amber-500' : 'text-muted-foreground'}`} aria-hidden />
              <span className="flex-1 truncate">{r.title}</span>
              {r.unlocked ? <span className="pill pill-good">earned</span> : <span className="text-[10px] text-muted-foreground">{r.hint}</span>}
            </div>
          ))}</div>
        </Card>

        <Card icon="ph-puzzle-piece" title="Skills & routing">
          <div className="flex flex-wrap gap-1.5">
            {allSkills.map((k) => { const on = skills.includes(k); const m = skillMeta[k];
              return <button key={k} onClick={() => toggleSkill(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} aria-hidden />{m.label}</button>;
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Auto-routing can send: {eligible.length ? eligible.join(', ') : 'nothing yet — assign a skill'}.</p>
        </Card>
      </div>
    </div>
  );
}

const PROFILE_TODAY = '2026-06-24';

// Active workload — list (with deadline-window detail) or a month calendar of the staffer's
// deadlines. The calendar reuses the same DeadlineCalendar the staff portal uses.
function WorkloadCard({ workload, capacity, util, over, setCap, tierMeta }: {
  workload: Workload; capacity: number; util: number; over: boolean; setCap: (n: number) => void; tierMeta: TierMeta;
}) {
  const money = useMoney();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const active = workload.active;
  const win = {
    overdue: active.filter((o) => o.daysToDue < 0).length,
    today: active.filter((o) => o.daysToDue === 0).length,
    d3: active.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 3).length,
    d7: active.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 7).length,
  };
  const calTasks: CalTask[] = [...active, ...workload.shipped]
    .filter((o): o is ProfileOrder & { deadline: string } => !!o.deadline)
    .map((o) => ({ id: o.id, code: o.code, service: o.service, deadline: o.deadline, status: o.status, priority: o.priority, customer: o.customer }));
  const datedActive = active.filter((o) => o.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
  const initialMonth = datedActive.length ? monthOf(datedActive[0].deadline as string) : monthOf(PROFILE_TODAY);

  const toggle = (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
      {(['list', 'calendar'] as const).map((v) => (
        <button key={v} onClick={() => setView(v)} className={`rounded-md px-2 py-0.5 capitalize transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><i className={`ph-bold ${v === 'list' ? 'ph-rows' : 'ph-calendar-blank'} mr-1`} aria-hidden />{v}</button>
      ))}
    </div>
  );

  return (
    <Card icon="ph-stack" title="Active workload" right={toggle}>
      {/* utilization + capacity + deadline windows */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{util}% utilization · {money(workload.valueInFlight)} in flight</span>
          <span className="flex items-center gap-1.5"><Step dir="down" onClick={() => setCap(capacity - 1)} /><span className={`font-semibold ${over ? 'text-destructive' : ''}`}>{workload.load}/{capacity}</span><Step dir="up" onClick={() => setCap(capacity + 1)} /></span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, background: barColor(workload.load, capacity) }} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
          {win.overdue > 0 && <span className="pill pill-bad"><i className="ph-bold ph-warning-circle" aria-hidden />{win.overdue} overdue</span>}
          <WlChip label="today" n={win.today} tone={win.today > 0 ? 'warn' : 'mute'} />
          <WlChip label="≤3d" n={win.d3} tone={win.d3 > 0 ? 'soft' : 'mute'} />
          <WlChip label="≤7d" n={win.d7} tone="mute" />
          <span className="ml-auto text-[10px] text-muted-foreground">deadlines: today · 3d · 7d</span>
        </div>
      </div>

      {view === 'calendar' ? (
        calTasks.length === 0 ? <Empty>No dated orders to plot.</Empty> : <DeadlineCalendar tasks={calTasks} initialMonth={initialMonth} today={PROFILE_TODAY} />
      ) : (
        <>
          {active.length === 0 ? <Empty>No orders in flight.</Empty> : (
            <div className="space-y-1.5">{active.map((o) => <OrderRow key={o.id} o={o} tierMeta={tierMeta} />)}</div>
          )}
          {workload.shipped.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recently shipped · {money(workload.valueDelivered)}</p>
              <div className="space-y-1">{workload.shipped.map((o) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted/50">
                  <i className="ph-fill ph-check-circle text-emerald-500" aria-hidden /><span className="font-medium">{o.code}</span>
                  <span className="truncate text-xs text-muted-foreground">{o.service} · {o.customer}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{statusLabel[o.status]}</span><span className="text-xs font-medium">{money(o.value)}</span>
                </Link>
              ))}</div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
function WlChip({ label, n, tone }: { label: string; n: number; tone: 'warn' | 'soft' | 'mute' }) {
  const cls = n === 0 ? 'bg-muted/60 text-muted-foreground/60' : tone === 'warn' ? 'bg-amber-500/15 text-amber-700' : tone === 'soft' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${cls}`}><span className="tabular-nums">{n}</span>{label}</span>;
}

function ScoreCard({ s, teamAvg }: { s: StaffInsight; teamAvg: TeamAvg }) {
  const avgOf: Record<string, number> = { quality: teamAvg.quality, 'on-time': teamAvg.onTime, throughput: teamAvg.throughput };
  return (
    <Card icon="ph-chart-bar" title="Score breakdown" right={<span className="text-xs text-muted-foreground">composite {s.composite}</span>}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid shrink-0 place-items-center">
          <div className="relative grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${s.composite * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
            <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-card"><span className="display text-2xl font-bold leading-none">{s.composite}</span></div>
          </div>
          <span className="mt-1 text-[11px] text-muted-foreground">{s.rank ? `Rank #${s.rank.rank} / ${s.rank.total}` : 'unranked'}</span>
        </div>
        <div className="flex-1 space-y-2.5">
          {s.breakdown.segments.map((seg) => {
            const avg = avgOf[seg.key] ?? 0; const delta = seg.score - avg;
            return (
              <div key={seg.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">{seg.label}<span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{Math.round(seg.weight * 100)}%</span></span>
                  <span className="font-semibold">{seg.score}{seg.key === 'throughput' ? '' : '%'}<span className="text-muted-foreground"> · {seg.points} pts</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(seg.score, 100)}%` }} /></div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{seg.goal !== null ? `goal ${seg.goal}${seg.key === 'throughput' ? '' : '%'} · ${seg.headroom} pts headroom` : 'volume context'}</span>
                  {avg > 0 && delta !== 0 && <span className={`font-semibold ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{delta > 0 ? `+${delta}` : delta} vs avg</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {s.lever ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <i className="ph-bold ph-target mt-0.5 text-primary" aria-hidden />
          <span>Best lever: <b>{s.lever.key === 'on-time' ? 'On-time delivery' : 'Quality'}</b> at {s.lever.score}% — closing the gap to goal adds about <b>{s.lever.headroom} composite points</b>, the most of any coachable metric.</span>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600"><i className="ph-bold ph-check-circle" aria-hidden />Both coachable levers are at or above goal — nothing to nudge.</p>
      )}
    </Card>
  );
}

/* ───────────────────────── Performance ───────────────────────── */
function PerformanceTab({ s, teamAvg }: { s: StaffInsight; teamAvg: TeamAvg }) {
  const st = s.stats;
  const maxDist = Math.max(1, ...Object.values(st.ratingDist));
  return (
    <div className="space-y-4">
      <Card icon="ph-chart-bar" title="Work activity" right={<span className="text-xs text-muted-foreground">tasks &amp; pay over time</span>}>
        <WorkActivityChart data={s.activity} types={ACTIVITY_TYPE_META} />
      </Card>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <ScoreCard s={s} teamAvg={teamAvg} />

        <Card icon="ph-seal-check" title="Work quality" right={<span className="text-xs text-muted-foreground">{st.total} tasks on record</span>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Mini label="First-pass" value={`${st.firstPassRate}%`} hint={`${st.total - st.tasksWithRevision}/${st.total} clean`} />
            <Mini label="Revision rate" value={`${st.revisionRate}%`} hint={`${st.avgRevisions} rounds/task`} />
            <Mini label="On-time" value={`${st.onTimeRate}%`} hint={`${st.onTimeCount}/${st.total}`} />
            <Mini label="Avg rating" value={st.avgRating != null ? `${st.avgRating}★` : '—'} hint={`${st.rated} rated`} />
            <Mini label="Turnaround" value={st.avgTurnaround != null ? `${st.avgTurnaround}d` : '—'} hint="start → delivery" />
            <Mini label="Streak" value={`${s.streak.current}`} hint={`best ${s.streak.best} · no-revision`} />
          </div>
        </Card>

        <Card icon="ph-squares-four" title="By service">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="p-2">Service</th><th className="p-2 text-right">Tasks</th><th className="p-2 text-right">Avg ★</th><th className="p-2 text-right">Revision</th><th className="p-2 text-right">On-time</th></tr></thead>
              <tbody>
                {st.byService.map((r) => (
                  <tr key={r.service} className="border-b border-border/50 last:border-0">
                    <td className="p-2 font-medium">{r.service}{st.topService === r.service && <span className="ml-1.5 pill pill-good"><i className="ph-fill ph-star" aria-hidden />best</span>}</td>
                    <td className="p-2 text-right">{r.count} <span className="text-muted-foreground">· {r.pct}%</span></td>
                    <td className="p-2 text-right">{r.avgRating != null ? `${r.avgRating}` : '—'}</td>
                    <td className={`p-2 text-right ${r.revisionRate > 30 ? 'text-amber-600' : ''}`}>{r.revisionRate}%</td>
                    <td className={`p-2 text-right ${r.onTimeRate < 85 ? 'text-amber-600' : ''}`}>{r.onTimeRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card icon="ph-star" title="Rating distribution" right={st.avgRating != null ? <span className="text-xs font-semibold">{st.avgRating}★ avg</span> : undefined}>
          {st.rated === 0 ? <Empty>No ratings yet.</Empty> : (
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => { const n = st.ratingDist[star] ?? 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="flex w-8 items-center gap-0.5 text-muted-foreground">{star}<i className="ph-fill ph-star text-amber-400" aria-hidden /></span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(n / maxDist) * 100}%` }} /></div>
                    <span className="w-5 text-right font-medium">{n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card icon="ph-chart-line-up" title="Rating trend">
          {s.ratings.length < 2 ? <Empty>Not enough rated months.</Empty> : <RatingTrend points={s.ratings} />}
        </Card>

        <Card icon="ph-arrows-counter-clockwise" title="Why work bounces" right={<span className="text-xs text-muted-foreground">{st.tasksWithRevision} tasks</span>}>
          {s.revisions.length === 0 ? <Empty>No revisions on record — clean.</Empty> : (
            <div className="space-y-2">{s.revisions.map((r) => (
              <div key={r.key} className="flex items-center justify-between text-xs">
                <span className="font-medium">{r.label}</span>
                <span className="text-muted-foreground">{r.count}×</span>
              </div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
    </div>
  );
}

/* Set-pay editor — fixed salary + commission rate + bonus, with gig pay shown read-only.
   Writes the per-staff override shared with Finance › Payouts (lib/payOverrides). */
function CompensationEditor({ staffId, payroll }: { staffId: string; payroll: StaffInsight['payroll'] }) {
  const money = useMoney();
  const { override, save, clear } = usePayOverride(staffId);
  const [editing, setEditing] = useState(false);
  const seed = { base: payroll.base, rate: payroll.rate, basis: payroll.basis, gig: payroll.gig, bonus: payroll.bonus };
  const eff = effectivePay(seed, override);
  const roleRate = Math.round(payroll.rate * 100);
  const [dBase, setDBase] = useState(payroll.base);
  const [dRate, setDRate] = useState(roleRate);
  const [dBonus, setDBonus] = useState(payroll.bonus);

  const startEdit = () => { setDBase(eff.base); setDRate(eff.ratePct); setDBonus(eff.bonus); setEditing(true); };
  const saveEdit = () => { save({ base: Math.max(0, dBase), rate: Math.max(0, Math.min(100, dRate)), bonus: Math.max(0, dBonus) }); setEditing(false); };
  const previewCommission = Math.round(payroll.basis * (dRate / 100));
  const previewTotal = dBase + payroll.gig + previewCommission + dBonus;

  const inp = 'w-full bg-transparent px-2 py-1.5 text-sm font-semibold tabular-nums outline-none';
  const Field = (label: string, node: ReactNode, hint?: string) => (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</label>
      {node}
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card icon="ph-receipt" title="Compensation"
      right={editing ? <span className="text-xs text-muted-foreground">editing</span> : (
        <div className="flex items-center gap-2">
          {override && <span className="pill pill-warn" title="A custom override is set">custom</span>}
          <button onClick={startEdit} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent"><i className="ph-bold ph-pencil-simple" />Set pay</button>
        </div>
      )}>
      {!editing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stack label="Base salary" value={money(eff.base)} sub="fixed monthly" />
            <Stack label="Gig pay" value={money(eff.gig)} sub={`${payroll.completedOrders} gigs · piece-rate`} />
            <Stack label="Commission" value={money(eff.commission)} sub={`${eff.ratePct}% × ${money(payroll.basis)}`} />
            <Stack label="Bonus" value={money(eff.bonus)} sub="this cycle" />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold">Total due this month</span>
            <span className="display text-2xl font-bold text-primary">{money(eff.total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Gig rates are set per service in Finance. Salary, rate &amp; bonus saved here are reflected in Finance › Payouts.</p>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Field('Fixed salary', (
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <span className="shrink-0 border-r border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">$</span>
                <input type="number" min={0} step={50} value={dBase} onChange={(e) => setDBase(Number(e.target.value) || 0)} className={inp} />
              </div>
            ), `role default ${money(payroll.base)}`)}
            {Field('Commission rate', (
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <input type="number" min={0} max={100} step={1} value={dRate} onChange={(e) => setDRate(Number(e.target.value) || 0)} className={inp} />
                <span className="shrink-0 border-l border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">%</span>
              </div>
            ), `× ${money(payroll.basis)} billable = ${money(previewCommission)}`)}
            {Field('Bonus', (
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background focus-within:border-primary">
                <span className="shrink-0 border-r border-border bg-muted px-2 py-1.5 text-sm text-muted-foreground">$</span>
                <input type="number" min={0} step={10} value={dBonus} onChange={(e) => setDBonus(Number(e.target.value) || 0)} className={inp} />
              </div>
            ), 'one-off this cycle')}
            {Field('Gig pay', (
              <div className="flex items-center rounded-lg border border-dashed border-border bg-muted/40 px-2 py-1.5 text-sm font-semibold tabular-nums text-muted-foreground">{money(payroll.gig)}</div>
            ), `${payroll.completedOrders} gigs · global rate`)}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-semibold">New total this month</span>
            <span className="display text-xl font-bold text-primary">{money(previewTotal)}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            {override && <button onClick={() => { clear(); setEditing(false); }} className="mr-auto text-xs font-semibold text-muted-foreground hover:text-destructive">Reset to role default</button>}
            <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
            <button onClick={saveEdit} className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Save pay</button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Pay & wallet ───────────────────────── */
function PayTab({ s }: { s: StaffInsight }) {
  const money = useMoney();
  const p = s.payroll;
  const e = s.earnings;
  const maxMonth = Math.max(1, ...s.earningsSeries.map((m) => m.takeHome));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <CompensationEditor staffId={s.id} payroll={p} />

        <Card icon="ph-chart-bar" title="Earnings history" right={<span className="text-xs text-muted-foreground">YTD {money(e.ytd)}</span>}>
          <div className="flex items-end gap-2 sm:gap-3">
            {s.earningsSeries.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">{money(m.takeHome)}</span>
                <div className="flex w-full max-w-[2.4rem] flex-col-reverse overflow-hidden rounded-md" style={{ height: 120 }} title={`${m.label}: base ${money(m.base)} + comm ${money(m.commission)} + bonus ${money(m.bonus)}`}>
                  <div style={{ height: `${(m.base / maxMonth) * 100}%`, background: 'hsl(var(--primary)/0.35)' }} />
                  <div style={{ height: `${(m.commission / maxMonth) * 100}%`, background: 'hsl(var(--primary))' }} />
                  <div style={{ height: `${(m.bonus / maxMonth) * 100}%`, background: '#f59e0b' }} />
                </div>
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <Legend color="hsl(var(--primary)/0.35)" label="Base" />
            <Legend color="hsl(var(--primary))" label="Commission" />
            <Legend color="#f59e0b" label="Bonus" />
            <span className="ml-auto">Avg {money(e.avg)}/mo{e.momPct != null && <> · <span className={e.momPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{e.momPct >= 0 ? '+' : ''}{e.momPct}% MoM</span></>}</span>
          </div>
        </Card>

        <TierLadder s={s} />

        <Card icon="ph-list-bullets" title="Wallet activity" right={<span className="text-xs text-muted-foreground">latest {s.ledger.length}</span>}>
          {s.ledger.length === 0 ? <Empty>No wallet activity yet.</Empty> : (
            <div className="space-y-1">
              {s.ledger.map((entry) => { const meta = WALLET_KIND_META[entry.kind]; const credit = entry.amount >= 0;
                return (
                  <div key={entry.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                    <i className={`ph-bold ${meta.icon} ${credit ? 'text-emerald-500' : 'text-rose-500'}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{entry.label}{entry.pending && <span className="ml-1.5 pill pill-warn">clearing</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{entry.at}</span>
                    <span className={`w-16 shrink-0 text-right font-semibold ${credit ? 'text-emerald-600' : 'text-rose-600'}`}>{credit ? '+' : '−'}{money(Math.abs(entry.amount))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card icon="ph-hand-coins" title="Commission wallet">
          <div className="rounded-xl border border-border p-3 text-center">
            <p className="display text-3xl font-bold">{money(s.wallet.balance)}</p>
            <p className="text-[11px] text-muted-foreground">current balance</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Mini label="Withdrawable" value={money(s.wallet.available)} />
            <Mini label="Clearing" value={money(s.wallet.clearing)} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Commission accrues here as tasks clear; penalties debit it. Separate from base payroll.</p>
        </Card>

        <Card icon="ph-credit-card" title="Payout methods" right={<span className="text-xs text-muted-foreground">{s.methods.length}</span>}>
          {s.methods.length === 0 ? <Empty>No methods on file.</Empty> : (
            <div className="space-y-2">
              {s.methods.map((m) => { const meta = PAYOUT_METHOD_META[m.kind];
                return (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                    <i className={`ph-bold ${meta.icon} text-primary`} aria-hidden />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.label}</p><p className="text-[10px] text-muted-foreground">{meta.label} · {m.feePct}% fee · {m.etaDays}d ETA</p></div>
                    {m.isDefault && <span className="pill pill-good">default</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card icon="ph-hand-coins" title="Payout requests" right={<span className="text-xs text-muted-foreground">{s.payouts.length}</span>}>
          {s.payouts.length === 0 ? <Empty>No payout requests.</Empty> : (
            <div className="space-y-2">
              {s.payouts.map((po) => { const stm = PAYOUT_STATUS_META[po.status];
                return (
                  <div key={po.id} className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{money(po.amount)}</span>
                    <span className="text-xs text-muted-foreground">{po.requestedAt}</span>
                    <span className={`ml-auto pill ${stm.pill}`}>{stm.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card icon="ph-trend-up" title="Lifetime">
          <Row label="Total commission" value={money(e.totalCommission)} />
          <Row label="Total bonus" value={money(e.totalBonus)} />
          {e.best && <Row label="Best month" value={`${e.best.label} · ${money(e.best.takeHome)}`} />}
          <Row label="Archive commission" value={money(s.stats.totalCommission)} />
          {s.stats.avgCommission != null && <Row label="Avg / task" value={money(s.stats.avgCommission)} />}
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── Conduct ───────────────────────── */
function ConductTab({ s }: { s: StaffInsight }) {
  const money = useMoney();
  const ps = s.penalties.summary;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <Card icon="ph-gavel" title="Penalties" right={<span className="text-xs text-muted-foreground">{ps.total} on record</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Applied" value={money(ps.appliedTotal)} hint={`${ps.applied} fines`} />
            <Mini label="Pending" value={money(ps.pendingTotal)} hint={`${ps.pending} to review`} />
            <Mini label="This month" value={money(ps.monthTotal)} />
            <Mini label="Waived" value={`${ps.waived}`} hint="forgiven" />
          </div>
          {s.penalties.items.length === 0 ? <p className="mt-3"><Empty>Clean record — no penalties.</Empty></p> : (
            <div className="mt-3 space-y-2">
              {s.penalties.items.map((p) => { const meta = PENALTY_TYPE_META[p.type]; const stm = PENALTY_STATUS_META[p.status];
                return (
                  <div key={p.id} className="rounded-xl border border-border px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <i className={`ph-bold ${meta.icon} text-muted-foreground`} aria-hidden />
                      <span className="font-medium">{meta.label}</span>
                      {p.taskCode && <span className="text-xs text-muted-foreground">{p.taskCode}</span>}
                      <span className="ml-auto font-semibold">−{money(p.amount)}</span>
                      <span className={`pill ${stm.pill}`}>{stm.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.reason} <span className="text-foreground/70">· {p.detail}</span></p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{p.createdAt} · {p.by}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card icon="ph-trophy" title="Rewards" right={<span className="text-xs text-muted-foreground">{money(s.rewards.earned)} earned</span>}>
          <div className="space-y-2.5">
            {s.rewards.list.map((r) => (
              <div key={r.id}>
                <div className="flex items-center gap-2 text-xs">
                  <i className={`ph-fill ${r.icon} ${r.unlocked ? 'text-amber-500' : 'text-muted-foreground'}`} aria-hidden />
                  <span className="flex-1 truncate font-medium">{r.title}</span>
                  <span className={`text-[10px] font-semibold uppercase ${REWARD_KIND_META[r.kind].tone}`}>+{money(r.amount)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${r.progressPct}%`, background: r.unlocked ? '#10b981' : 'hsl(var(--primary))' }} /></div>
                  <span className="w-24 shrink-0 text-right text-[10px] text-muted-foreground">{r.unlocked ? 'earned' : r.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card icon="ph-scales" title="Penalty rules" right={<span className="text-xs text-muted-foreground">auto-flag</span>}>
          <div className="space-y-2">
            {PENALTY_RULES.map((r) => { const meta = PENALTY_TYPE_META[r.type];
              return (
                <div key={r.type} className="flex items-start gap-2 text-xs">
                  <i className={`ph-bold ${meta.icon} mt-0.5 text-muted-foreground`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.label} {!r.enabled && <span className="text-muted-foreground">(off)</span>}</p>
                    <p className="text-[11px] text-muted-foreground">{r.threshold} → {r.sizing === 'flat' ? `$${r.value} flat` : r.sizing === 'pct' ? `${r.value}% of commission` : `${r.value}% progressive`}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Rules auto-flag fines; a manager confirms or waives. Rewards pay a fixed bonus into the wallet when a bar is cleared.</p>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── History ───────────────────────── */
function HistoryTab({ s }: { s: StaffInsight }) {
  const money = useMoney();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <Card icon="ph-clock-counter-clockwise" title="Completed work" right={<span className="text-xs text-muted-foreground">{s.history.length} tasks · {money(s.stats.totalCommission)} earned</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="p-2">Task</th><th className="p-2">Customer</th><th className="p-2 text-right">★</th><th className="p-2 text-right">Rev</th><th className="p-2 text-center">On-time</th><th className="p-2 text-right">Pay</th></tr></thead>
              <tbody>
                {s.history.map((w) => (
                  <tr key={w.code} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                    <td className="p-2"><span className="font-medium">{w.code}</span><span className="block text-[11px] text-muted-foreground">{w.service} · {w.pkg} · {w.completedAt}</span></td>
                    <td className="p-2">{w.customer}</td>
                    <td className="p-2 text-right">{w.rating != null ? <span className="inline-flex items-center gap-0.5">{w.rating}<i className="ph-fill ph-star text-amber-400" aria-hidden /></span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className={`p-2 text-right ${w.revisions > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{w.revisions || '—'}</td>
                    <td className="p-2 text-center">{w.onTime ? <i className="ph-fill ph-check-circle text-emerald-500" aria-hidden /> : <i className="ph-fill ph-clock-countdown text-rose-500" aria-hidden />}</td>
                    <td className="p-2 text-right font-semibold">{money(w.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card icon="ph-users-three" title="Top clients" right={<span className="text-xs text-muted-foreground">{s.customers.length}</span>}>
          {s.customers.length === 0 ? <Empty>No history.</Empty> : (
            <div className="space-y-2">{s.customers.slice(0, 8).map((c) => (
              <div key={c.customer} className="flex items-center justify-between text-sm">
                <CustomerHoverCard customer={c.customer}><span className="truncate hover:underline">{c.customer}</span></CustomerHoverCard>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">{c.avgRating != null && <span className="inline-flex items-center gap-0.5">{c.avgRating}<i className="ph-fill ph-star text-amber-400" aria-hidden /></span>}<span className="font-semibold text-foreground">{c.count}</span></span>
              </div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */
// Live local time at the staffer's timezone (parsed from a "GMT+7" style label). Mounted-guarded
// so SSR and first client render agree (no hydration mismatch).
function tzOffsetMinutes(tz: string): number | null {
  const m = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(tz);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + (h < 0 ? -mm : mm);
}
function LocalClock({ tz }: { tz: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const off = tzOffsetMinutes(tz);
    if (off === null) return;
    const tick = () => {
      const d = new Date();
      const local = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + off * 60000);
      setNow(local.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [tz]);
  return <span className="font-medium tabular-nums">{now ?? '—'}</span>;
}

// Commission tier ladder — where the staffer sits among the bands, and the gap to the next.
function TierLadder({ s }: { s: StaffInsight }) {
  const cur = s.tier.current;
  const next = s.tier.next;
  return (
    <Card icon="ph-stairs" title="Commission tier" right={<span className="text-xs text-muted-foreground">{cur.level} · {cur.mult}×</span>}>
      <div className="grid grid-cols-4 gap-1.5">
        {COMMISSION_TIERS.map((t) => {
          const isCur = t.level === cur.level;
          const reached = s.composite >= t.minComposite;
          return (
            <div key={t.level} className={`rounded-lg border p-2 text-center ${isCur ? 'border-primary bg-primary/10' : reached ? 'border-border bg-muted/40' : 'border-dashed border-border opacity-60'}`}>
              <p className={`text-xs font-bold ${isCur ? 'text-primary' : ''}`}>{t.level}</p>
              <p className="text-[10px] text-muted-foreground">{t.mult}× · ≥{t.minComposite}</p>
              {isCur && <i className="ph-fill ph-caret-up mt-0.5 block text-primary" aria-hidden />}
            </div>
          );
        })}
      </div>
      {next ? (
        <p className="mt-2.5 text-xs text-muted-foreground"><i className="ph-bold ph-arrow-fat-up mr-1 text-primary" aria-hidden /><b className="text-foreground">{s.tier.toNext} composite points</b> to <b className="text-foreground">{next.level}</b> ({next.mult}× commission).</p>
      ) : (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-600"><i className="ph-bold ph-crown" aria-hidden />Top commission band reached.</p>
      )}
    </Card>
  );
}

function tenureFrom(since: string): string {
  const start = new Date(`${since}T00:00:00`);
  const now = new Date('2026-06-26T00:00:00');
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  return months >= 12 ? `${Math.floor(months / 12)}y ${months % 12}m` : `${months}m`;
}
function barColor(load: number, cap: number): string {
  if (load > cap) return 'hsl(var(--destructive))';
  const pct = (load / cap) * 100;
  return pct >= 100 ? 'hsl(var(--destructive))' : pct > 80 ? '#f59e0b' : 'hsl(var(--primary))';
}
const initialsOf = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }} aria-hidden>{initialsOf(name)}</span>;
}
function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden /> {title}</p>{right}</div>{children}</div>;
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border/40 py-1.5 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-base font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p>{hint && <p className="text-[9px] text-muted-foreground/80">{hint}</p>}</div>;
}
function Stack({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl border border-border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="display mt-1 text-xl font-bold">{value}</p>{sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}</div>;
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: color }} />{label}</span>;
}
function Step({ dir, onClick }: { dir: 'down' | 'up'; onClick: () => void }) {
  return <button onClick={onClick} aria-label={dir === 'down' ? 'Decrease capacity' : 'Increase capacity'} className="grid h-5 w-5 place-items-center rounded border border-border text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground"><i className={`ph-bold ${dir === 'down' ? 'ph-minus' : 'ph-plus'}`} aria-hidden /></button>;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
function OrderRow({ o, tierMeta }: { o: ProfileOrder; tierMeta: TierMeta }) {
  const money = useMoney();
  return (
    <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-primary/50">
      <PriorityBadge priority={o.priority} />
      <span className="font-medium">{o.code}</span>
      <span className="text-xs text-muted-foreground">{o.service} · {o.pkg}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-fill ${tierMeta[o.tier]?.icon ?? 'ph-circle'}`} style={{ color: tierMeta[o.tier]?.color }} aria-hidden />{o.customer}</span>
      <span className="ml-auto" /><StatusBadge status={o.status} /><span className="text-xs font-medium">{money(o.value)}</span>
      <Due d={o.daysToDue} />
    </Link>
  );
}
function Due({ d }: { d: number }) {
  if (!Number.isFinite(d) || d >= 9999) return <span className="text-[11px] text-muted-foreground">—</span>;
  const tone = d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`shrink-0 text-[11px] font-medium ${tone}`}>{d < 0 ? `${-d}d over` : d === 0 ? 'today' : `${d}d`}</span>;
}
function RatingTrend({ points }: { points: { label: string; avg: number | null; count: number }[] }) {
  const w = 240, h = 70, pad = 8;
  const vals = points.map((p) => p.avg ?? 0);
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - 1) / 4) * (h - pad * 2); // 1..5 → bottom..top
  const line = points.map((p, i) => `${x(i)},${y(p.avg ?? 0)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" height={h}>
        <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.avg ?? 0)} r={2.5} fill="hsl(var(--primary))" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">{points.map((p, i) => <span key={i}>{p.label}</span>)}</div>
    </div>
  );
}
