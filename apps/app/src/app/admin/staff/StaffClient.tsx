'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { SlideOver } from '@/components/admin/SlideOver';
import { money, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';

export interface ActiveOrder {
  id: string; code: string; service: string; pkg: string; status: OrderStatus;
  priority: Priority; value: number; customer: string; tier: Tier;
  deadline: string | null; daysToDue: number; skill: string | null;
}
export interface StaffVM {
  id: string; name: string; role: string; email: string; since: string; tz: string;
  skills: string[]; capacity: number; active: boolean;
  composite: number; quality: number; onTime: number; throughput: number; trend: number[];
  load: number; overdue: number; dueSoon: number; valueInFlight: number; completed: number;
  activeOrders: ActiveOrder[];
}
type SkillMeta = Record<string, { label: string; icon: string; color: string }>;
interface Props { initialStaff: StaffVM[]; skillMeta: SkillMeta }

type SortKey = 'composite' | 'quality' | 'onTime' | 'throughput' | 'load' | 'name';
const SORT_LABEL: Record<SortKey, string> = {
  composite: 'Score', quality: 'Quality', onTime: 'On-time', throughput: 'Throughput', load: 'Utilization', name: 'Name',
};

export function StaffClient({ initialStaff, skillMeta }: Props) {
  const allSkills = Object.keys(skillMeta);
  const [staff, setStaff] = useState<StaffVM[]>(initialStaff);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [fSkill, setFSkill] = useState('');
  const [fStatus, setFStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [fAvail, setFAvail] = useState<'all' | 'free' | 'full' | 'over'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('composite');
  const [panelId, setPanelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [log, setLog] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);

  const record = (text: string, icon = 'ph-pencil-simple') => {
    setToast(text); setTimeout(() => setToast(null), 2400);
    setLog((l) => [{ id: `${Date.now()}.${l.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text, icon }, ...l].slice(0, 30));
  };

  const patch = (id: string, fn: (s: StaffVM) => StaffVM) => setStaff((list) => list.map((s) => (s.id === id ? fn(s) : s)));
  const toggleActive = (s: StaffVM) => { patch(s.id, (x) => ({ ...x, active: !x.active })); record(`${s.name} ${s.active ? 'paused — won’t receive new work' : 'reactivated'}`, s.active ? 'ph-pause-circle' : 'ph-play-circle'); };
  const setCapacity = (s: StaffVM, n: number) => { const cap = Math.max(1, Math.min(20, n)); patch(s.id, (x) => ({ ...x, capacity: cap })); record(`${s.name} capacity → ${cap} slots`, 'ph-sliders'); };
  const toggleSkill = (s: StaffVM, skill: string) => {
    const has = s.skills.includes(skill); patch(s.id, (x) => ({ ...x, skills: has ? x.skills.filter((k) => k !== skill) : [...x.skills, skill] }));
    record(`${s.name} ${has ? 'lost' : 'gained'} ${skillMeta[skill].label} skill`, 'ph-certificate');
  };
  const addStaff = (data: { name: string; role: string; capacity: number; skills: string[] }) => {
    const vm: StaffVM = {
      id: `s${Date.now()}`, name: data.name, role: data.role || 'Specialist', email: `${data.name.split(' ')[0].toLowerCase()}@hevaseo.com`,
      since: '2026-06-25', tz: 'GMT+7', skills: data.skills, capacity: data.capacity, active: true,
      composite: 0, quality: 0, onTime: 0, throughput: 0, trend: [0, 0, 0, 0, 0, 0, 0, 0],
      load: 0, overdue: 0, dueSoon: 0, valueInFlight: 0, completed: 0, activeOrders: [],
    };
    setStaff((l) => [...l, vm]); setAddOpen(false); record(`Added ${vm.name} to the team`, 'ph-user-plus');
  };

  // ---- team aggregates (active staff only for capacity/utilization) ----
  const team = useMemo(() => {
    const act = staff.filter((s) => s.active);
    const cap = act.reduce((n, s) => n + s.capacity, 0);
    const load = act.reduce((n, s) => n + s.load, 0);
    return {
      total: staff.length, active: act.length, paused: staff.length - act.length,
      avgQuality: act.length ? Math.round(act.reduce((n, s) => n + s.quality, 0) / act.length) : 0,
      avgOnTime: act.length ? Math.round(act.reduce((n, s) => n + s.onTime, 0) / act.length) : 0,
      throughput: act.reduce((n, s) => n + s.throughput, 0),
      cap, load, util: cap ? Math.round((load / cap) * 100) : 0,
      free: Math.max(0, cap - load), overloaded: act.filter((s) => s.load > s.capacity).length,
      overdue: staff.reduce((n, s) => n + s.overdue, 0),
    };
  }, [staff]);

  // ---- skill coverage (bus-factor) ----
  const coverage = useMemo(() => allSkills.map((skill) => {
    const holders = staff.filter((s) => s.active && s.skills.includes(skill));
    return {
      skill, count: holders.length,
      cap: holders.reduce((n, s) => n + s.capacity, 0),
      load: holders.reduce((n, s) => n + s.load, 0),
      names: holders.map((s) => s.name),
    };
  }), [staff, allSkills]);

  const visible = useMemo(() => staff
    .filter((s) => (!search.trim() || `${s.name} ${s.role}`.toLowerCase().includes(search.toLowerCase()))
      && (!fSkill || s.skills.includes(fSkill))
      && (fStatus === 'all' || (fStatus === 'active' ? s.active : !s.active))
      && (fAvail === 'all' || avail(s) === fAvail))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name)
      : sortBy === 'load' ? (b.load / b.capacity) - (a.load / a.capacity)
      : b[sortBy] - a[sortBy]),
    [staff, search, fSkill, fStatus, fAvail, sortBy]);

  // rank by composite for medals (active staff)
  const rank = useMemo(() => {
    const ordered = [...staff].filter((s) => s.active).sort((a, b) => b.composite - a.composite);
    return new Map(ordered.map((s, i) => [s.id, i] as const));
  }, [staff]);

  const panel = panelId ? staff.find((s) => s.id === panelId) ?? null : null;
  const filtered = !!(search || fSkill || fStatus !== 'all' || fAvail !== 'all');

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">Manage the delivery team — capacity, skills, workload and performance.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-user-plus mr-1" />Add staff</button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-users-three" label="Team" value={`${team.active}`} sub={team.paused ? `${team.paused} paused` : 'all active'} />
        <Kpi icon="ph-seal-check" label="Avg quality" value={`${team.avgQuality}%`} />
        <Kpi icon="ph-clock" label="Avg on-time" value={`${team.avgOnTime}%`} tone={team.avgOnTime < 85 ? 'warn' : undefined} />
        <Kpi icon="ph-lightning" label="Throughput" value={String(team.throughput)} sub="last 30d" />
        <Kpi icon="ph-gauge" label="Utilization" value={`${team.util}%`} tone={team.util >= 90 ? 'warn' : team.util < 50 ? undefined : 'good'} sub={`${team.load}/${team.cap} slots`} />
        <Kpi icon="ph-tray" label="Free capacity" value={String(team.free)} tone={team.free === 0 ? 'warn' : 'good'} sub={team.overloaded ? `${team.overloaded} overloaded` : 'slots open'} />
      </div>

      {/* insight row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon="ph-certificate" title="Skill coverage" right={<span className="text-xs text-muted-foreground">bus-factor risk flagged</span>}>
          <div className="space-y-3">
            {coverage.map((c) => {
              const meta = skillMeta[c.skill]; const pct = c.cap ? Math.round((c.load / c.cap) * 100) : 0; const thin = c.count <= 1;
              return (
                <div key={c.skill}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium"><i className={`ph-fill ${meta.icon}`} style={{ color: meta.color }} />{meta.label}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {thin && <span className="pill pill-warn"><i className="ph-bold ph-warning" />{c.count === 0 ? 'no cover' : 'single point'}</span>}
                      <span className="text-muted-foreground">{c.count} staff · {c.load}/{c.cap}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? 'hsl(var(--destructive))' : pct > 80 ? '#f59e0b' : meta.color }} /></div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.names.length ? c.names.join(' · ') : 'Nobody covers this skill'}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card icon="ph-scales" title="Workload balance" right={<span className="text-xs text-muted-foreground">{team.util}% team load</span>}>
          <div className="space-y-2.5">
            {[...staff].filter((s) => s.active).sort((a, b) => (b.load / b.capacity) - (a.load / a.capacity)).map((s) => {
              const pct = Math.round((s.load / s.capacity) * 100); const t = avail(s);
              return (
                <button key={s.id} onClick={() => setPanelId(s.id)} className="block w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Avatar name={s.name} size={18} /><span className="font-medium">{s.name}</span></span>
                    <span className={`text-xs font-semibold ${t === 'over' ? 'text-destructive' : t === 'full' ? 'text-amber-600' : 'text-muted-foreground'}`}>{s.load}/{s.capacity}{t === 'over' ? ' · over' : t === 'full' ? ' · full' : pct < 40 ? ' · idle' : ''}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(s.load, s.capacity) }} /></div>
                </button>
              );
            })}
            <p className="pt-1 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" />{team.free} free slots across the team{team.overloaded ? ` · ${team.overloaded} over capacity` : ''}. Click a row to rebalance.</p>
          </div>
        </Card>
      </div>

      {/* roster toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / role" className="w-52 rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary" /></div>
        <select value={fSkill} onChange={(e) => setFSkill(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="">All skills</option>{allSkills.map((k) => <option key={k} value={k}>{skillMeta[k].label}</option>)}</select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="all">Any status</option><option value="active">Active</option><option value="paused">Paused</option></select>
        <select value={fAvail} onChange={(e) => setFAvail(e.target.value as typeof fAvail)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="all">Any load</option><option value="free">Has capacity</option><option value="full">At capacity</option><option value="over">Overloaded</option></select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary">{(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORT_LABEL[k]}</option>)}</select>
        {filtered && <button onClick={() => { setSearch(''); setFSkill(''); setFStatus('all'); setFAvail('all'); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} of {staff.length}</span>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm font-semibold">
          {(['grid', 'table'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 capitalize transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><i className={`ph-bold ${v === 'grid' ? 'ph-squares-four' : 'ph-rows'} mr-1`} />{v}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No staff match these filters.</p>
      ) : view === 'grid' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => <StaffCard key={s.id} s={s} medal={rank.get(s.id)} skillMeta={skillMeta} onManage={() => setPanelId(s.id)} onToggle={() => toggleActive(s)} />)}
        </div>
      ) : (
        <StaffTable rows={visible} rankMap={rank} skillMeta={skillMeta} onManage={setPanelId} onToggle={toggleActive} />
      )}

      {/* action log */}
      <Card icon="ph-clock-counter-clockwise" title="Recent changes" right={<span className="text-xs text-muted-foreground">{log.length} event{log.length === 1 ? '' : 's'}</span>}>
        {log.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No changes yet — pause a member, tweak capacity or edit skills and it shows up here.</p>
        ) : (
          <ul className="scrollbar-thin max-h-60 space-y-2 overflow-y-auto pr-1">
            {log.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} /></span>
                <span className="min-w-0 flex-1 truncate">{h.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.at}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {panel && (
        <SlideOver open onClose={() => setPanelId(null)} title={panel.name}>
          <ManagePanel s={panel} skillMeta={skillMeta} allSkills={allSkills}
            onToggleActive={() => toggleActive(panel)} onCapacity={(n) => setCapacity(panel, n)} onToggleSkill={(k) => toggleSkill(panel, k)} />
        </SlideOver>
      )}
      {addOpen && <AddStaffModal allSkills={allSkills} skillMeta={skillMeta} onClose={() => setAddOpen(false)} onSave={addStaff} />}
      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

// ---------- helpers ----------
function avail(s: StaffVM): 'free' | 'full' | 'over' {
  if (s.load > s.capacity) return 'over';
  if (s.load === s.capacity) return 'full';
  return 'free';
}
function barColor(load: number, cap: number): string {
  if (load > cap) return 'hsl(var(--destructive))';
  const pct = (load / cap) * 100;
  return pct >= 100 ? 'hsl(var(--destructive))' : pct > 80 ? '#f59e0b' : 'hsl(var(--primary))';
}
function hueOf(name: string): number { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initialsOf(name: string): string { return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }}>{initialsOf(name)}</span>;
}
function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function Spark({ data, color = 'hsl(var(--primary))', w = 132, h = 36 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data); const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.75} fill={color} />
    </svg>
  );
}

function Medal({ rank }: { rank: number }) {
  const c = rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : '#b45309';
  return <i className="ph-fill ph-medal" style={{ color: c }} title={`#${rank + 1} by score`} />;
}

function StaffCard({ s, medal, skillMeta, onManage, onToggle }: { s: StaffVM; medal?: number; skillMeta: SkillMeta; onManage: () => void; onToggle: () => void }) {
  const pct = Math.round((s.load / s.capacity) * 100);
  return (
    <div className={`flex flex-col rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm ${s.active ? 'border-border' : 'border-border bg-muted/30 opacity-80'}`}>
      <div className="flex items-start gap-3">
        <div className="relative"><Avatar name={s.name} />{!s.active && <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-card"><i className="ph-fill ph-pause-circle text-amber-500" /></span>}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/admin/staff/${s.id}`} className="truncate font-semibold hover:text-primary hover:underline">{s.name}</Link>
            {medal !== undefined && medal < 3 && <Medal rank={medal} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{s.role}</p>
        </div>
        <div className="text-right">
          <p className="display text-2xl font-bold leading-none text-primary">{s.composite || '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">score</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {s.skills.length ? s.skills.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium"><i className={`ph-fill ${skillMeta[k].icon}`} style={{ color: skillMeta[k].color }} />{skillMeta[k].label}</span>) : <span className="text-[11px] text-muted-foreground">No skills set</span>}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Workload</span>
          <span className={`font-semibold ${s.load > s.capacity ? 'text-destructive' : 'text-foreground'}`}>{s.load}/{s.capacity} · {pct}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(s.load, s.capacity) }} /></div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
        <Stat label="Quality" value={`${s.quality}%`} />
        <Stat label="On-time" value={`${s.onTime}%`} tone={s.onTime < 85 ? 'warn' : undefined} />
        <Stat label="In flight" value={money(s.valueInFlight)} />
      </div>

      {(s.overdue > 0 || s.dueSoon > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.overdue > 0 && <span className="pill pill-warn" style={{ background: '#ef44441f', color: '#dc2626' }}><i className="ph-bold ph-warning-circle" />{s.overdue} overdue</span>}
          {s.dueSoon > 0 && <span className="pill pill-warn"><i className="ph-bold ph-timer" />{s.dueSoon} due soon</span>}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        <button onClick={onToggle} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent" title={s.active ? 'Pause new assignments' : 'Reactivate'}><i className={`ph-bold ${s.active ? 'ph-pause' : 'ph-play'} mr-1`} />{s.active ? 'Pause' : 'Activate'}</button>
        <button onClick={onManage} className="ml-auto rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-sliders-horizontal mr-1" />Manage</button>
      </div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return <div><p className={`text-sm font-bold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}

function StaffTable({ rows, rankMap, skillMeta, onManage, onToggle }: { rows: StaffVM[]; rankMap: Map<string, number>; skillMeta: SkillMeta; onManage: (id: string) => void; onToggle: (s: StaffVM) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="p-3">Staff</th><th className="p-3">Skills</th><th className="p-3 w-40">Workload</th>
          <th className="p-3 text-right">Score</th><th className="p-3 text-right">Quality</th><th className="p-3 text-right">On-time</th><th className="p-3 text-right">Done</th><th className="p-3 text-right">Manage</th>
        </tr></thead>
        <tbody>
          {rows.map((s) => { const medal = rankMap.get(s.id); const pct = Math.round((s.load / s.capacity) * 100);
            return (
              <tr key={s.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${s.active ? '' : 'opacity-70'}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5"><Link href={`/admin/staff/${s.id}`} className="font-medium hover:text-primary hover:underline">{s.name}</Link>{medal !== undefined && medal < 3 && <Medal rank={medal} />}{!s.active && <span className="pill pill-warn"><i className="ph-bold ph-pause" />paused</span>}</div>
                      <p className="text-xs text-muted-foreground">{s.role}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{s.skills.map((k) => <i key={k} className={`ph-fill ${skillMeta[k].icon}`} style={{ color: skillMeta[k].color }} title={skillMeta[k].label} />)}</div></td>
                <td className="p-3">
                  <div className="flex items-center gap-2"><span className={`text-xs font-semibold ${s.load > s.capacity ? 'text-destructive' : 'text-muted-foreground'}`}>{s.load}/{s.capacity}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(s.load, s.capacity) }} /></div></div>
                </td>
                <td className="p-3 text-right"><span className="display font-bold text-primary">{s.composite || '—'}</span></td>
                <td className="p-3 text-right">{s.quality}%</td>
                <td className={`p-3 text-right ${s.onTime < 85 ? 'font-semibold text-amber-600' : ''}`}>{s.onTime}%</td>
                <td className="p-3 text-right text-muted-foreground">{s.throughput}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button onClick={() => onToggle(s)} className="text-muted-foreground hover:text-foreground" title={s.active ? 'Pause' : 'Activate'}><i className={`ph-bold ${s.active ? 'ph-pause' : 'ph-play'}`} /></button>
                    <button onClick={() => onManage(s.id)} className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold hover:bg-accent">Manage</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManagePanel({ s, skillMeta, allSkills, onToggleActive, onCapacity, onToggleSkill }: {
  s: StaffVM; skillMeta: SkillMeta; allSkills: string[]; onToggleActive: () => void; onCapacity: (n: number) => void; onToggleSkill: (k: string) => void;
}) {
  const pct = Math.round((s.load / s.capacity) * 100);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={s.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.role}</p>
          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
          <p className="text-xs text-muted-foreground">Since {s.since} · {s.tz}</p>
        </div>
        <button onClick={onToggleActive} role="switch" aria-checked={s.active} className={`relative h-6 w-11 shrink-0 rounded-full transition ${s.active ? 'bg-primary' : 'bg-muted'}`} title={s.active ? 'Active — receiving work' : 'Paused'}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.active ? 'left-[22px]' : 'left-0.5'}`} /></button>
      </div>
      <p className={`-mt-2 text-xs font-semibold ${s.active ? 'text-emerald-600' : 'text-amber-600'}`}><i className={`ph-bold ${s.active ? 'ph-check-circle' : 'ph-pause-circle'} mr-1`} />{s.active ? 'Active — eligible for new assignments' : 'Paused — excluded from auto-routing'}</p>

      <div className="grid grid-cols-4 gap-2">
        <Mini label="Score" value={String(s.composite || '—')} />
        <Mini label="Quality" value={`${s.quality}%`} />
        <Mini label="On-time" value={`${s.onTime}%`} />
        <Mini label="Done" value={String(s.throughput)} />
      </div>

      <Section title="Throughput trend">
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <Spark data={s.trend} />
          <div className="text-right"><p className="display text-lg font-bold">{s.trend[s.trend.length - 1]}</p><p className="text-[10px] text-muted-foreground">this week</p></div>
        </div>
      </Section>

      <Section title="Performance">
        <Bar label="Quality" pct={s.quality} />
        <Bar label="On-time delivery" pct={s.onTime} tone={s.onTime < 85 ? 'warn' : undefined} />
        <Bar label="Utilization" pct={pct} tone={s.load > s.capacity ? 'over' : pct > 80 ? 'warn' : undefined} hint={`${s.load}/${s.capacity}`} />
      </Section>

      <Section title="Capacity">
        <div className="flex items-center gap-3">
          <button onClick={() => onCapacity(s.capacity - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Decrease capacity"><i className="ph-bold ph-minus" /></button>
          <div className="flex-1 text-center"><p className="display text-2xl font-bold">{s.capacity}</p><p className="text-[11px] text-muted-foreground">concurrent slots</p></div>
          <button onClick={() => onCapacity(s.capacity + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Increase capacity"><i className="ph-bold ph-plus" /></button>
        </div>
        {s.load > s.capacity && <p className="mt-2 text-xs font-semibold text-destructive"><i className="ph-bold ph-warning mr-1" />Capacity is below current load ({s.load}) — they’re overbooked.</p>}
      </Section>

      <Section title="Skills">
        <div className="flex flex-wrap gap-1.5">
          {allSkills.map((k) => { const on = s.skills.includes(k); const m = skillMeta[k];
            return <button key={k} onClick={() => onToggleSkill(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} />{m.label}</button>;
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Skills decide which services auto-routing can send this person.</p>
      </Section>

      <Section title={`Active workload (${s.activeOrders.length})`}>
        {s.activeOrders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">No orders in flight.</p>
        ) : (
          <div className="space-y-1.5">
            {s.activeOrders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm transition hover:border-primary/50">
                <PriorityBadge priority={o.priority} />
                <span className="font-medium">{o.code}</span>
                <span className="truncate text-xs text-muted-foreground">{o.service}</span>
                <span className="ml-auto" /><StatusBadge status={o.status} />
                <Due d={o.daysToDue} />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Link href={`/admin/staff/${s.id}`} className="block rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open full profile →</Link>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="space-y-2">{children}</div></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-base font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function Bar({ label, pct, tone, hint }: { label: string; pct: number; tone?: 'warn' | 'over'; hint?: string }) {
  const bg = tone === 'over' ? 'hsl(var(--destructive))' : tone === 'warn' ? '#f59e0b' : 'hsl(var(--primary))';
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{hint ?? `${pct}%`}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: bg }} /></div>
    </div>
  );
}
function Due({ d }: { d: number }) {
  if (!Number.isFinite(d) || d >= 9999) return <span className="text-[11px] text-muted-foreground">—</span>;
  const tone = d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`shrink-0 text-[11px] font-medium ${tone}`}>{d < 0 ? `${-d}d over` : d === 0 ? 'today' : `${d}d`}</span>;
}

function AddStaffModal({ allSkills, skillMeta, onClose, onSave }: { allSkills: string[]; skillMeta: SkillMeta; onClose: () => void; onSave: (d: { name: string; role: string; capacity: number; skills: string[] }) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [skills, setSkills] = useState<string[]>([]);
  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary';
  const toggle = (k: string) => setSkills((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="display mb-4 text-base font-bold">Add staff member</p>
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara N." className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Role</span><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. SEO Specialist" className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Capacity (concurrent slots)</span><input type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={`${inp} w-28`} /></label>
          <div><span className="mb-1 block text-xs font-semibold text-muted-foreground">Skills</span>
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map((k) => { const on = skills.includes(k); const m = skillMeta[k];
                return <button key={k} type="button" onClick={() => toggle(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} />{m.label}</button>;
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
          <button onClick={() => name.trim() && onSave({ name: name.trim(), role: role.trim(), capacity, skills })} disabled={!name.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">Add member</button>
        </div>
      </div>
    </div>
  );
}
