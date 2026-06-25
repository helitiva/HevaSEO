'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { money, statusLabel, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';

export interface ProfileOrder {
  id: string; code: string; service: string; pkg: string; status: OrderStatus; priority: Priority;
  value: number; customer: string; tier: Tier; deadline: string | null; daysToDue: number; created: string;
}
export interface MixRow { service: string; count: number; value: number; skill: string | null }
export interface CustomerRow { id: string | null; company: string; tier: Tier; count: number; value: number }
export interface ActivityRow { id: string; type: string; text: string; value: number; at: string }
type SkillMeta = Record<string, { label: string; icon: string; color: string }>;
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;

interface StaffLite {
  id: string; name: string; role: string; email: string; since: string; tz: string;
  skills: string[]; capacity: number; active: boolean;
  composite: number; quality: number; onTime: number; throughput: number; trend: number[];
}
interface Props {
  staff: StaffLite;
  load: number; valueInFlight: number; valueDelivered: number; overdue: number; dueSoon: number;
  shippedCount: number; rework: number; rankInTeam: number; teamSize: number; productivity: number;
  tenureMonths: number;
  teamAvg: { composite: number; quality: number; onTime: number; throughput: number; productivity: number };
  active: ProfileOrder[]; shipped: ProfileOrder[]; mix: MixRow[]; customers: CustomerRow[]; activity: ActivityRow[];
  skillMeta: SkillMeta; allSkills: string[]; tierMeta: TierMeta; serviceSkill: Record<string, string>;
}

const MIX_COLOR = ['#2563eb', '#10b981', '#38bdf8', '#a78bfa', '#f59e0b', '#fb923c', '#34d399'];
const ACT_ICON: Record<string, { icon: string; color: string }> = {
  assigned: { icon: 'ph-user-plus', color: 'text-sky-500' },
  progress: { icon: 'ph-spinner-gap', color: 'text-primary' },
  review: { icon: 'ph-magnifying-glass', color: 'text-violet-500' },
  delivered: { icon: 'ph-paper-plane-tilt', color: 'text-amber-500' },
  rework: { icon: 'ph-arrow-counter-clockwise', color: 'text-rose-500' },
  approved: { icon: 'ph-seal-check', color: 'text-emerald-500' },
  completed: { icon: 'ph-check-circle', color: 'text-emerald-500' },
  canceled: { icon: 'ph-x-circle', color: 'text-muted-foreground' },
  new: { icon: 'ph-package', color: 'text-muted-foreground' },
};

export function StaffProfileClient(p: Props) {
  const [active, setActive] = useState(p.staff.active);
  const [capacity, setCapacity] = useState(p.staff.capacity);
  const [skills, setSkills] = useState<string[]>(p.staff.skills);
  const [mixBy, setMixBy] = useState<'value' | 'orders'>('value');
  const [orderFilter, setOrderFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const s = p.staff;
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const util = Math.round((p.load / capacity) * 100);
  const free = Math.max(0, capacity - p.load);
  const over = p.load > capacity;
  const tenure = p.tenureMonths >= 12 ? `${Math.floor(p.tenureMonths / 12)}y ${p.tenureMonths % 12}m` : `${p.tenureMonths}m`;

  const setCap = (n: number) => { const c = Math.max(1, Math.min(20, n)); if (c === capacity) return; setCapacity(c); notify(`Capacity → ${c} slots`); };
  const toggleSkill = (k: string) => { const has = skills.includes(k); setSkills((x) => (has ? x.filter((y) => y !== k) : [...x, k])); notify(`${has ? 'Removed' : 'Added'} ${p.skillMeta[k].label} skill`); };
  const toggleActive = () => { setActive((a) => !a); notify(active ? 'Paused — excluded from auto-routing' : 'Reactivated'); };

  // services this person can take, given current (editable) skills — reactive to skill toggles
  const eligible = useMemo(() => Object.entries(p.serviceSkill).filter(([, sk]) => skills.includes(sk)).map(([svc]) => svc), [skills, p.serviceSkill]);

  // score pillars
  const pillars = [
    { label: 'Quality', score: s.quality, avg: p.teamAvg.quality, weight: 45, icon: 'ph-seal-check', color: '#10b981' },
    { label: 'On-time', score: s.onTime, avg: p.teamAvg.onTime, weight: 35, icon: 'ph-clock', color: '#2563eb' },
    { label: 'Productivity', score: p.productivity, avg: p.teamAvg.productivity, weight: 20, icon: 'ph-lightning', color: '#a855f7' },
  ];

  const mixSum = p.mix.reduce((n, m) => n + (mixBy === 'value' ? m.value : m.count), 0) || 1;
  const mixRows = [...p.mix].sort((a, b) => (mixBy === 'value' ? b.value - a.value : b.count - a.count));
  const statuses = useMemo(() => [...new Set(p.active.map((o) => o.status))], [p.active]);
  const activeRows = orderFilter ? p.active.filter((o) => o.status === orderFilter) : p.active;

  return (
    <section className="space-y-4">
      {/* header */}
      <div className="rounded-2xl border border-border bg-card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/staff" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent" title="Back to staff"><i className="ph-bold ph-arrow-left" aria-hidden /></Link>
            <Avatar name={s.name} size={52} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold tracking-tight">{s.name}</span>
                {active ? <span className="pill pill-live"><span />active</span> : <span className="pill pill-warn"><i className="ph-bold ph-pause" aria-hidden />paused</span>}
                {p.rankInTeam >= 0 && p.rankInTeam < 3 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: ['#f59e0b', '#94a3b8', '#b45309'][p.rankInTeam] }}><i className="ph-fill ph-medal" aria-hidden />#{p.rankInTeam + 1} in team</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.role} · {s.email} · {tenure} tenure</p>
              <div className="mt-1.5 flex flex-wrap gap-1">{skills.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium"><i className={`ph-fill ${p.skillMeta[k].icon}`} style={{ color: p.skillMeta[k].color }} aria-hidden />{p.skillMeta[k].label}</span>)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`mailto:${s.email}`} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-envelope-simple mr-1" aria-hidden />Email</a>
            <button onClick={toggleActive} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className={`ph-bold ${active ? 'ph-pause' : 'ph-play'} mr-1`} aria-hidden />{active ? 'Pause' : 'Activate'}</button>
            <Link href="/admin/assignment" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-arrows-left-right mr-1" aria-hidden />Reassign work</Link>
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-dots-three-vertical" aria-hidden /></button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-xl">
                    {[{ icon: 'ph-pencil-simple', label: 'Edit profile', fn: () => notify('Edit — wire to form') }, { icon: 'ph-identification-badge', label: 'Reset password', fn: () => notify('Reset link sent') }, { icon: 'ph-prohibit', label: 'Offboard', fn: () => notify('Offboard flow'), danger: true }].map((m) => (
                      <button key={m.label} onClick={() => { m.fn(); setMenuOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent ${m.danger ? 'text-destructive' : ''}`}><i className={`ph-bold ${m.icon}`} aria-hidden />{m.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-medal" label="Composite" value={String(s.composite)} sub={p.rankInTeam >= 0 ? `#${p.rankInTeam + 1} of ${p.teamSize} · avg ${p.teamAvg.composite}` : `avg ${p.teamAvg.composite}`} tone="good" />
        <Kpi icon="ph-seal-check" label="Quality" value={`${s.quality}%`} sub={`avg ${p.teamAvg.quality}%`} tone={s.quality >= p.teamAvg.quality ? 'good' : undefined} />
        <Kpi icon="ph-clock" label="On-time" value={`${s.onTime}%`} tone={s.onTime < 85 ? 'warn' : undefined} sub={`avg ${p.teamAvg.onTime}%`} />
        <Kpi icon="ph-lightning" label="Throughput" value={String(s.throughput)} sub={`avg ${p.teamAvg.throughput} · 30d`} />
        <Kpi icon="ph-gauge" label="Utilization" value={`${util}%`} tone={over ? 'warn' : util < 50 ? undefined : 'good'} sub={`${p.load}/${capacity} slots`} />
        <Kpi icon="ph-coins" label="In flight" value={money(p.valueInFlight)} sub={`${money(p.valueDelivered)} shipped`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* main */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* score breakdown */}
          <Card icon="ph-chart-bar" title="Score breakdown" right={<span className="text-xs text-muted-foreground">composite {s.composite}</span>}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid shrink-0 place-items-center">
                <div className="relative grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${s.composite * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
                  <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-card">
                    <span className="display text-2xl font-bold leading-none">{s.composite}</span>
                  </div>
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">{p.rankInTeam >= 0 ? `Rank #${p.rankInTeam + 1} / ${p.teamSize}` : 'unranked'}</span>
              </div>
              <div className="flex-1 space-y-2.5">
                {pillars.map((pl) => {
                  const delta = pl.score - pl.avg;
                  return (
                    <div key={pl.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium"><i className={`ph-fill ${pl.icon}`} style={{ color: pl.color }} aria-hidden />{pl.label}<span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{pl.weight}%</span></span>
                        <span className="font-semibold">{pl.score}<span className="text-muted-foreground"> · {Math.round((pl.score * pl.weight) / 100)} pts</span></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pl.score, 100)}%`, background: pl.color }} /></div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>team avg {pl.avg}</span>
                        {delta !== 0 && <span className={`font-semibold ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{delta > 0 ? `+${delta}` : delta} vs avg</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />Composite blends quality (45%), on-time delivery (35%) and productivity (20%, relative to the busiest teammate).</p>
          </Card>

          {/* active workload */}
          <Card icon="ph-stack" title="Active workload" right={
            <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} aria-label="Filter active orders by status" className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"><option value="">All ({p.active.length})</option>{statuses.map((st) => <option key={st} value={st}>{statusLabel[st]}</option>)}</select>
          }>
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{p.load} of {capacity} slots · {money(p.valueInFlight)} in flight</span><span className={`font-semibold ${over ? 'text-destructive' : 'text-muted-foreground'}`}>{util}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, background: barColor(p.load, capacity) }} /></div>
              {(p.overdue > 0 || p.dueSoon > 0) && <div className="mt-2 flex gap-1.5">{p.overdue > 0 && <span className="pill" style={{ background: '#ef44441f', color: '#dc2626' }}><i className="ph-bold ph-warning-circle" aria-hidden />{p.overdue} overdue</span>}{p.dueSoon > 0 && <span className="pill pill-warn"><i className="ph-bold ph-timer" aria-hidden />{p.dueSoon} due soon</span>}</div>}
            </div>
            {activeRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="p-2">Order</th><th className="p-2">Customer</th><th className="p-2">Status</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Due</th></tr></thead>
                  <tbody>
                    {activeRows.map((o) => (
                      <tr key={o.id} className="border-b border-border/50 hover:bg-muted/40">
                        <td className="p-2"><div className="flex items-center gap-1.5"><PriorityBadge priority={o.priority} /><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.code}</Link></div><span className="text-[11px] text-muted-foreground">{o.service} · {o.pkg}</span></td>
                        <td className="p-2"><span className="inline-flex items-center gap-1"><i className={`ph-fill ${p.tierMeta[o.tier].icon}`} style={{ color: p.tierMeta[o.tier].color }} aria-hidden />{o.customer}</span></td>
                        <td className="p-2"><StatusBadge status={o.status} /></td>
                        <td className="p-2 text-right font-semibold">{money(o.value)}</td>
                        <td className="p-2 text-right"><Due d={o.daysToDue} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* performance trend */}
          <Card icon="ph-chart-line-up" title="Throughput trend" right={<span className="text-xs text-muted-foreground">last 8 weeks</span>}>
            <Area data={s.trend} />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Mini label="This week" value={String(s.trend[s.trend.length - 1])} />
              <Mini label="Weekly avg" value={String(Math.round(s.trend.reduce((a, b) => a + b, 0) / s.trend.length))} />
              <Mini label="Peak" value={String(Math.max(...s.trend))} />
            </div>
          </Card>

          {/* service mix */}
          <Card icon="ph-chart-donut" title="Service mix" right={
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
              {(['value', 'orders'] as const).map((k) => <button key={k} onClick={() => setMixBy(k)} className={`rounded-md px-2 py-0.5 capitalize transition ${mixBy === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{k === 'value' ? 'Value' : 'Orders'}</button>)}
            </div>
          }>
            {mixRows.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
              <div className="space-y-2.5">
                {mixRows.map((m, i) => { const pct = Math.round(((mixBy === 'value' ? m.value : m.count) / mixSum) * 100); return (
                  <div key={m.service}>
                    <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MIX_COLOR[i % MIX_COLOR.length] }} />{m.service}{m.skill && !skills.includes(m.skill) && <span className="pill pill-warn"><i className="ph-bold ph-warning" aria-hidden />off-skill</span>}</span><span className="text-muted-foreground">{m.count} · {money(m.value)} · <b className="text-foreground">{pct}%</b></span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: MIX_COLOR[i % MIX_COLOR.length] }} /></div>
                  </div>
                ); })}
              </div>
            )}
          </Card>

          {/* delivery history */}
          <Card icon="ph-check-square-offset" title="Delivery history" right={<span className="text-xs text-muted-foreground">{p.shippedCount} shipped · {money(p.valueDelivered)}</span>}>
            {p.shipped.length === 0 ? <p className="text-sm text-muted-foreground">Nothing shipped yet.</p> : (
              <div className="space-y-1.5">
                {p.shipped.map((o) => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted/50">
                    <i className="ph-fill ph-check-circle text-emerald-500" aria-hidden />
                    <span className="font-medium">{o.code}</span>
                    <span className="truncate text-xs text-muted-foreground">{o.service} · {o.customer}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{statusLabel[o.status]}</span>
                    <span className="text-xs font-semibold">{money(o.value)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* activity */}
          <Card icon="ph-scroll" title="Recent activity">
            {p.activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity.</p> : (
              <ul className="space-y-2.5">
                {p.activity.map((a) => { const m = ACT_ICON[a.type] ?? { icon: 'ph-dot', color: 'text-muted-foreground' }; return (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${m.icon} ${m.color}`} aria-hidden /></span>
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.at.slice(5)}</span>
                  </li>
                ); })}
              </ul>
            )}
          </Card>
        </div>

        {/* sidebar */}
        <div className="min-w-0 space-y-4">
          {/* capacity & availability */}
          <Card icon="ph-sliders-horizontal" title="Capacity & availability">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{active ? 'Accepting work' : 'Paused'}</span>
              <button onClick={toggleActive} role="switch" aria-checked={active} aria-label="Toggle active status" className={`relative h-6 w-11 rounded-full transition ${active ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? 'left-[22px]' : 'left-0.5'}`} /></button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => setCap(capacity - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Decrease capacity"><i className="ph-bold ph-minus" aria-hidden /></button>
              <div className="flex-1 text-center"><p className="display text-2xl font-bold">{capacity}</p><p className="text-[11px] text-muted-foreground">concurrent slots</p></div>
              <button onClick={() => setCap(capacity + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Increase capacity"><i className="ph-bold ph-plus" aria-hidden /></button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Mini label="In use" value={String(p.load)} />
              <Mini label="Free" value={String(free)} />
              <Mini label="Util" value={`${util}%`} />
            </div>
            {over && <p className="mt-2 text-xs font-semibold text-destructive"><i className="ph-bold ph-warning mr-1" aria-hidden />Overbooked — load exceeds capacity.</p>}
          </Card>

          {/* skills */}
          <Card icon="ph-certificate" title="Skills & services">
            <div className="flex flex-wrap gap-1.5">
              {p.allSkills.map((k) => { const on = skills.includes(k); const m = p.skillMeta[k];
                return <button key={k} onClick={() => toggleSkill(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} aria-hidden />{m.label}</button>;
              })}
            </div>
            <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Eligible services</p>
            <div className="flex flex-wrap gap-1.5">{eligible.length ? eligible.map((svc) => <span key={svc} className="rounded-md border border-border px-2 py-0.5 text-xs">{svc}</span>) : <span className="text-xs text-muted-foreground">No skills set</span>}</div>
          </Card>

          {/* details */}
          <Card icon="ph-identification-card" title="Details">
            <div className="space-y-1.5 text-sm">
              <Row label="Email" value={<a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a>} />
              <Row label="Role" value={s.role} />
              <Row label="Timezone" value={s.tz} />
              <Row label="Joined" value={s.since} />
              <Row label="Tenure" value={tenure} />
            </div>
          </Card>

          {/* quality signals */}
          <Card icon="ph-pulse" title="Quality signals">
            <div className="grid grid-cols-2 gap-2">
              <Mini label="On-time" value={`${s.onTime}%`} />
              <Mini label="Rework" value={String(p.rework)} />
              <Mini label="Shipped" value={String(p.shippedCount)} />
              <Mini label="Delivered $" value={money(p.valueDelivered)} />
            </div>
            {p.rework > 0 && <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-arrow-counter-clockwise mr-1" aria-hidden />{p.rework} order{p.rework > 1 ? 's' : ''} currently in change-request — watch turnaround.</p>}
          </Card>

          {/* customers served */}
          <Card icon="ph-buildings" title="Customers served" right={<span className="text-xs text-muted-foreground">{p.customers.length}</span>}>
            {p.customers.length === 0 ? <p className="text-sm text-muted-foreground">No customers yet.</p> : (
              <ul className="space-y-1.5">
                {p.customers.slice(0, 6).map((c) => (
                  <li key={c.company} className="flex items-center gap-2 text-sm">
                    <i className={`ph-fill ${p.tierMeta[c.tier].icon}`} style={{ color: p.tierMeta[c.tier].color }} aria-hidden />
                    {c.id ? <Link href={`/admin/customers/${c.id}`} className="truncate font-medium hover:text-primary hover:underline">{c.company}</Link> : <span className="truncate font-medium">{c.company}</span>}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.count} · {money(c.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl"><i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}</div>}
    </section>
  );
}

// ---------- helpers ----------
function barColor(load: number, cap: number): string {
  if (load > cap) return 'hsl(var(--destructive))';
  const pct = (load / cap) * 100;
  return pct >= 100 ? 'hsl(var(--destructive))' : pct > 80 ? '#f59e0b' : 'hsl(var(--primary))';
}
function hueOf(name: string): number { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }}>{initials}</span>;
}
function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden /> {title}</p>{right}</div>{children}</div>;
}
function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right font-medium">{value}</span></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function Due({ d }: { d: number }) {
  if (!Number.isFinite(d) || d >= 9999) return <span className="text-[11px] text-muted-foreground">no due</span>;
  const tone = d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`text-[11px] font-medium ${tone}`}>{d < 0 ? `${-d}d over` : d === 0 ? 'today' : `${d}d`}</span>;
}
function Area({ data, w = 520, h = 96 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data); const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 10 - ((v - min) / range) * (h - 24);
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const fill = `${x(0)},${h - 4} ${line} ${x(data.length - 1)},${h - 4}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={h} aria-hidden>
      <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>
      <polygon points={fill} fill="url(#spk)" />
      <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === data.length - 1 ? 3.5 : 2} fill="hsl(var(--primary))" />)}
    </svg>
  );
}
