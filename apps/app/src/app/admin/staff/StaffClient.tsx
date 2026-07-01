'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlideOver } from '@/components/shared/SlideOver';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { impersonate } from '@/lib/impersonation';
import { type OrderStatus, type Priority, type Tier } from '@/data/adminMock';
import { useMoney, useShowMoney, useImpersonatePolicy } from '@/lib/viewer';
import { addCreatedStaff, useCreatedStaff } from '@/data/staffAccountsStore';
import { createStaffMemberAction } from '@/app/admin/staff/staff.actions';
import { OutboxButton } from '@/components/admin/accounts/OutboxDrawer';

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
  managerId: string | null; managerName: string | null;
  // pay + conduct signals from the shared admin insight layer
  tier: string; rank: number | null;
  monthlyPay: number; walletBalance: number;
  pendingFines: number; appliedFines: number;
  rewardsUnlocked: number; rewardsTotal: number;
  firstPassRate: number; avgRating: number | null;
  isNew?: boolean; // admin-provisioned this session — no analytics yet
}
export interface ManagerVM {
  id: string; name: string; title: string; email: string;
  reportIds: string[]; reportNames: string[];
}
type SkillMeta = Record<string, { label: string; icon: string; color: string }>;
interface Props { initialStaff: StaffVM[]; managers: ManagerVM[]; skillMeta: SkillMeta }
interface Teammate { id: string; name: string; active: boolean; load: number; capacity: number }

type SortKey = 'composite' | 'quality' | 'onTime' | 'throughput' | 'load' | 'pay' | 'name';
const SORT_LABEL: Record<SortKey, string> = {
  composite: 'Score', quality: 'Quality', onTime: 'On-time', throughput: 'Throughput', load: 'Utilization', pay: 'Pay', name: 'Name',
};

export function StaffClient({ initialStaff, managers, skillMeta }: Props) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const allSkills = Object.keys(skillMeta);
  // admin-provisioned staff (this session, persisted in localStorage)
  const createdStaff = useCreatedStaff();
  // editable staff attributes (active / capacity / skills / identity)
  const [staff, setStaff] = useState<StaffVM[]>(initialStaff);

  // Merge created staff into the editable roster as they appear in the store, without
  // clobbering in-session edits to existing rows. New rows render a "pending" state.
  useEffect(() => {
    setStaff((list) => {
      const have = new Set(list.map((s) => s.id));
      const fresh = createdStaff
        .filter((c) => !have.has(c.id))
        .map<StaffVM>((c) => ({
          id: c.id, name: c.name, role: c.role || 'Specialist', email: c.email,
          since: c.createdAt.slice(0, 10), tz: 'GMT+7', skills: c.skills, capacity: c.capacity, active: true,
          composite: 0, quality: 0, onTime: 0, throughput: 0, trend: [0, 0, 0, 0, 0, 0, 0, 0],
          load: 0, overdue: 0, dueSoon: 0, valueInFlight: 0, completed: 0, activeOrders: [],
          managerId: null, managerName: null,
          tier: 'Starter', rank: null, monthlyPay: 0, walletBalance: 0, pendingFines: 0, appliedFines: 0,
          rewardsUnlocked: 0, rewardsTotal: 0, firstPassRate: 0, avgRating: null, isNew: true,
        }));
      return fresh.length ? [...list, ...fresh] : list;
    });
  }, [createdStaff]);
  // every in-flight order, flattened with the staff it was originally assigned to
  const flatOrders = useMemo(() => initialStaff.flatMap((s) => s.activeOrders.map((o) => ({ order: o, home: s.name }))), [initialStaff]);
  // live placement of each order → enables reassigning between staff on this page
  const [placement, setPlacement] = useState<Record<string, string>>(() => Object.fromEntries(flatOrders.map((f) => [f.order.id, f.home])));

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [fSkill, setFSkill] = useState('');
  const [fManager, setFManager] = useState('');
  const [fStatus, setFStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [fAvail, setFAvail] = useState<'all' | 'free' | 'full' | 'over'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('composite');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [invited, setInvited] = useState<{ email: string; tempPassword: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [log, setLog] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);

  const record = (text: string, icon = 'ph-pencil-simple') => {
    setToast(text); setTimeout(() => setToast(null), 2400);
    setLog((l) => [{ id: `${Date.now()}.${l.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text, icon }, ...l].slice(0, 30));
  };

  // ---- live roster: merge editable attrs with placement-derived workload ----
  const roster = useMemo<StaffVM[]>(() => staff.map((s) => {
    const orders = flatOrders.filter((f) => placement[f.order.id] === s.name).map((f) => f.order).sort((a, b) => a.daysToDue - b.daysToDue);
    return {
      ...s, activeOrders: orders, load: orders.length,
      valueInFlight: orders.reduce((n, o) => n + o.value, 0),
      overdue: orders.filter((o) => o.daysToDue < 0).length,
      dueSoon: orders.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 1).length,
    };
  }), [staff, placement, flatOrders]);

  const patch = (id: string, fn: (s: StaffVM) => StaffVM) => setStaff((list) => list.map((s) => (s.id === id ? fn(s) : s)));
  const toggleActive = (s: StaffVM) => { patch(s.id, (x) => ({ ...x, active: !x.active })); record(`${s.name} ${s.active ? 'paused — won’t receive new work' : 'reactivated'}`, s.active ? 'ph-pause-circle' : 'ph-play-circle'); };
  const setCapacity = (s: StaffVM, n: number) => { const cap = Math.max(1, Math.min(20, n)); if (cap === s.capacity) return; patch(s.id, (x) => ({ ...x, capacity: cap })); record(`${s.name} capacity → ${cap} slots`, 'ph-sliders'); };
  const toggleSkill = (s: StaffVM, skill: string) => {
    const has = s.skills.includes(skill); patch(s.id, (x) => ({ ...x, skills: has ? x.skills.filter((k) => k !== skill) : [...x.skills, skill] }));
    record(`${s.name} ${has ? 'lost' : 'gained'} ${skillMeta[skill].label} skill`, 'ph-certificate');
  };
  const reassign = (orderId: string, toName: string, code: string) => { setPlacement((p) => ({ ...p, [orderId]: toName })); record(`Reassigned ${code} → ${toName}`, 'ph-arrows-left-right'); };
  // inc-E23 — real provisioning: create_staff_member makes a SHADOW profile + staff_details + wallet;
  // the person claims it by signing up with the same email. The overlay add keeps the new member visible
  // in this (mock-display) roster immediately; the credential panel is replaced by an invite confirmation.
  const addStaff = async (data: { name: string; email: string; role: string; capacity: number; skills: string[] }) => {
    if (adding) return;
    setAdding(true);
    const res = await createStaffMemberAction({ name: data.name, email: data.email, roleLabel: data.role, capacity: data.capacity, skills: data.skills });
    setAdding(false);
    if (!res.ok) { setToast(res.error); record(`Could not add ${data.name}: ${res.error}`, 'ph-warning-circle'); return; }
    addCreatedStaff({ id: `s${Date.now()}`, name: data.name, email: data.email, role: data.role, capacity: data.capacity, skills: data.skills, createdAt: new Date().toISOString() });
    setInvited({ email: data.email, tempPassword: res.tempPassword });
    record(`Added ${data.name} — share their temporary password`, 'ph-user-plus');
  };

  // ---- bulk selection ----
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = () => setSel(new Set());
  const bulkActive = (active: boolean) => { const ids = [...sel]; setStaff((list) => list.map((s) => (sel.has(s.id) ? { ...s, active } : s))); clearSel(); record(`${ids.length} member${ids.length > 1 ? 's' : ''} ${active ? 'reactivated' : 'paused'}`, active ? 'ph-play-circle' : 'ph-pause-circle'); };

  // ---- team aggregates (active staff only for capacity/utilization) ----
  const team = useMemo(() => {
    const act = roster.filter((s) => s.active);
    const cap = act.reduce((n, s) => n + s.capacity, 0);
    const load = act.reduce((n, s) => n + s.load, 0);
    return {
      total: roster.length, active: act.length, paused: roster.length - act.length,
      avgQuality: act.length ? Math.round(act.reduce((n, s) => n + s.quality, 0) / act.length) : 0,
      avgOnTime: act.length ? Math.round(act.reduce((n, s) => n + s.onTime, 0) / act.length) : 0,
      throughput: act.reduce((n, s) => n + s.throughput, 0),
      cap, load, util: cap ? Math.round((load / cap) * 100) : 0,
      free: Math.max(0, cap - load), overloaded: act.filter((s) => s.load > s.capacity).length,
      payroll: roster.reduce((n, s) => n + s.monthlyPay, 0),
      pendingFines: roster.reduce((n, s) => n + s.pendingFines, 0),
    };
  }, [roster]);

  // ---- skill coverage (bus-factor) ----
  const coverage = useMemo(() => allSkills.map((skill) => {
    const holders = roster.filter((s) => s.active && s.skills.includes(skill));
    return { skill, count: holders.length, cap: holders.reduce((n, s) => n + s.capacity, 0), load: holders.reduce((n, s) => n + s.load, 0), names: holders.map((s) => s.name) };
  }), [roster, allSkills]);

  const visible = useMemo(() => roster
    .filter((s) => (!search.trim() || `${s.name} ${s.role}`.toLowerCase().includes(search.toLowerCase()))
      && (!fSkill || s.skills.includes(fSkill))
      && (!fManager || s.managerId === fManager)
      && (fStatus === 'all' || (fStatus === 'active' ? s.active : !s.active))
      && (fAvail === 'all' || avail(s) === fAvail))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name)
      : sortBy === 'load' ? (b.load / b.capacity) - (a.load / a.capacity)
      : sortBy === 'pay' ? b.monthlyPay - a.monthlyPay
      : b[sortBy] - a[sortBy]),
    [roster, search, fSkill, fManager, fStatus, fAvail, sortBy]);

  const stranded = useMemo(() => roster.filter((s) => !s.active && s.load > 0), [roster]);
  const rank = useMemo(() => new Map([...roster].filter((s) => s.active).sort((a, b) => b.composite - a.composite).map((s, i) => [s.id, i] as const)), [roster]);
  const teammates: Teammate[] = useMemo(() => roster.map((s) => ({ id: s.id, name: s.name, active: s.active, load: s.load, capacity: s.capacity })), [roster]);

  const panel = panelId ? roster.find((s) => s.id === panelId) ?? null : null;
  // ---- panel prev/next (through the visible list) + copy link + URL deep-link ----
  const panelIdx = panelId ? visible.findIndex((s) => s.id === panelId) : -1;
  const prevStaff = panelIdx > 0 ? visible[panelIdx - 1] : null;
  const nextStaff = panelIdx >= 0 && panelIdx < visible.length - 1 ? visible[panelIdx + 1] : null;
  const copyStaffLink = (id: string) => { try { void navigator.clipboard?.writeText(`${window.location.origin}/admin/staff?staff=${id}`); } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('staff'); if (id && roster.some((s) => s.id === id)) setPanelId(id); }, [roster]);
  // deep-link a manager's team from the Managers page (?manager=mgr1)
  useEffect(() => { const mid = new URLSearchParams(window.location.search).get('manager'); if (mid && managers.some((m) => m.id === mid)) setFManager(mid); }, [managers]);
  useEffect(() => { const url = new URL(window.location.href); if (panelId) url.searchParams.set('staff', panelId); else url.searchParams.delete('staff'); window.history.replaceState(null, '', `${url.pathname}${url.search}`); }, [panelId]);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' && nextStaff) setPanelId(nextStaff.id);
      else if (e.key === 'k' && prevStaff) setPanelId(prevStaff.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, nextStaff, prevStaff]);
  const filtered = !!(search || fSkill || fManager || fStatus !== 'all' || fAvail !== 'all');
  const allSelected = visible.length > 0 && visible.every((s) => sel.has(s.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(visible.map((s) => s.id)));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">Manage the delivery team — capacity, skills, workload and performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/staff/leave" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent"><i className="ph-bold ph-airplane-takeoff mr-1" aria-hidden />Leave requests</Link>
          <OutboxButton />
          <button onClick={() => setAddOpen(true)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-user-plus mr-1" aria-hidden />Add staff</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi icon="ph-users-three" label="Team" value={`${team.active}`} sub={team.paused ? `${team.paused} paused` : 'all active'} />
        <Kpi icon="ph-seal-check" label="Avg quality" value={`${team.avgQuality}%`} />
        <Kpi icon="ph-clock" label="Avg on-time" value={`${team.avgOnTime}%`} tone={team.avgOnTime < 85 ? 'warn' : undefined} />
        <Kpi icon="ph-lightning" label="Throughput" value={String(team.throughput)} sub="last 30d" />
        <Kpi icon="ph-gauge" label="Utilization" value={`${team.util}%`} tone={team.util >= 90 ? 'warn' : team.util < 50 ? undefined : 'good'} sub={`${team.load}/${team.cap} slots`} />
        <Kpi icon="ph-tray" label="Free capacity" value={String(team.free)} tone={team.free === 0 ? 'warn' : 'good'} sub={team.overloaded ? `${team.overloaded} overloaded` : 'slots open'} />
        {showMoney && <Kpi icon="ph-wallet" label="Monthly payroll" value={money(team.payroll)} sub="base + commission + bonus" />}
        <Kpi icon="ph-gavel" label="Fines pending" value={String(team.pendingFines)} tone={team.pendingFines > 0 ? 'warn' : 'good'} sub={team.pendingFines > 0 ? 'awaiting review' : 'none open'} />
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
                    <span className="flex items-center gap-1.5 font-medium"><i className={`ph-fill ${meta.icon}`} style={{ color: meta.color }} aria-hidden />{meta.label}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {thin && <span className="pill pill-warn"><i className="ph-bold ph-warning" aria-hidden />{c.count === 0 ? 'no cover' : 'single point'}</span>}
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
          {stranded.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <i className="ph-bold ph-warning mt-0.5 text-amber-600" aria-hidden />
              <span><b>{stranded.map((s) => s.name).join(', ')}</b> {stranded.length > 1 ? 'are' : 'is'} paused but still holding {stranded.reduce((n, s) => n + s.load, 0)} order{stranded.reduce((n, s) => n + s.load, 0) > 1 ? 's' : ''} in flight. <button onClick={() => setPanelId(stranded[0].id)} className="font-semibold text-primary hover:underline">Reassign →</button></span>
            </div>
          )}
          <div className="space-y-2.5">
            {[...[...roster].filter((s) => s.active).sort((a, b) => (b.load / b.capacity) - (a.load / a.capacity)), ...stranded].map((s) => {
              const pct = Math.round((s.load / s.capacity) * 100); const t = avail(s);
              return (
                <button key={s.id} onClick={() => setPanelId(s.id)} className="block w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Avatar name={s.name} size={18} /><span className="font-medium">{s.name}</span>{!s.active && <span className="pill pill-warn"><i className="ph-bold ph-pause" aria-hidden />paused</span>}</span>
                    <span className={`text-xs font-semibold ${!s.active ? 'text-amber-600' : t === 'over' ? 'text-destructive' : t === 'full' ? 'text-amber-600' : 'text-muted-foreground'}`}>{s.load}/{s.capacity}{!s.active ? ' · stranded' : t === 'over' ? ' · over' : t === 'full' ? ' · full' : pct < 40 ? ' · idle' : ''}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: !s.active ? '#f59e0b' : barColor(s.load, s.capacity) }} /></div>
                </button>
              );
            })}
            <p className="pt-1 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" aria-hidden />{team.free} free slots across active staff{team.overloaded ? ` · ${team.overloaded} over capacity` : ''}. Click a row to rebalance.</p>
          </div>
        </Card>
      </div>

      {/* managers — who manages whom */}
      <Card icon="ph-user-circle-gear" title="Managers" right={<span className="text-xs text-muted-foreground">{managers.length} managers · {roster.length} staff</span>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {managers.map((m) => {
            const reports = roster.filter((s) => s.managerId === m.id);
            const teamLoad = reports.reduce((n, s) => n + s.load, 0);
            const teamCap = reports.filter((s) => s.active).reduce((n, s) => n + s.capacity, 0);
            const isFiltered = fManager === m.id;
            return (
              <div key={m.id} className={`rounded-xl border p-3 transition ${isFiltered ? 'border-primary/50 bg-primary/5' : 'border-border bg-background/40'}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.title}</p>
                  </div>
                  <button
                    onClick={() => setFManager(isFiltered ? '' : m.id)}
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${isFiltered ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}
                  >
                    {isFiltered ? 'Filtering' : `${reports.length} staff`}
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {reports.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPanelId(s.id)}
                      title={`${s.name} · ${s.role}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2 text-[11px] font-medium transition hover:border-primary/50"
                    >
                      <Avatar name={s.name} size={18} />
                      <span>{s.name}</span>
                      {!s.active && <i className="ph-fill ph-pause-circle text-amber-500" aria-hidden />}
                    </button>
                  ))}
                  {reports.length === 0 && <span className="text-[11px] text-muted-foreground">No staff assigned</span>}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-gauge mr-1" aria-hidden />{teamLoad}/{teamCap} slots in use across the team</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* roster toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / role" aria-label="Search staff by name or role" className="w-44 rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary sm:w-52" /></div>
        <button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-semibold sm:hidden ${filtered ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border'}`}><i className="ph-bold ph-funnel" aria-hidden />Filters{filtered ? ' ·' : ''}</button>
        <div className={`${showFilters ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 sm:flex sm:w-auto`}>
          <select value={fSkill} onChange={(e) => setFSkill(e.target.value)} aria-label="Filter by skill" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="">All skills</option>{allSkills.map((k) => <option key={k} value={k}>{skillMeta[k].label}</option>)}</select>
          <select value={fManager} onChange={(e) => setFManager(e.target.value)} aria-label="Filter by manager" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="">All managers</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} aria-label="Filter by status" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="all">Any status</option><option value="active">Active</option><option value="paused">Paused</option></select>
          <select value={fAvail} onChange={(e) => setFAvail(e.target.value as typeof fAvail)} aria-label="Filter by load" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"><option value="all">Any load</option><option value="free">Has capacity</option><option value="full">At capacity</option><option value="over">Overloaded</option></select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} aria-label="Sort staff" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary">{(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORT_LABEL[k]}</option>)}</select>
          {filtered && <button onClick={() => { setSearch(''); setFSkill(''); setFManager(''); setFStatus('all'); setFAvail('all'); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all staff" className="accent-primary" />All</label>
        <span className="text-xs text-muted-foreground">{visible.length} of {roster.length}</span>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm font-semibold">
          {(['grid', 'table'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 capitalize transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><i className={`ph-bold ${v === 'grid' ? 'ph-squares-four' : 'ph-rows'} mr-1`} aria-hidden />{v}</button>
          ))}
        </div>
      </div>

      {/* bulk action bar */}
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-semibold">{sel.size} selected</span>
          <span className="ml-auto" />
          <button onClick={() => bulkActive(true)} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-play mr-1" aria-hidden />Activate</button>
          <button onClick={() => bulkActive(false)} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-pause mr-1" aria-hidden />Pause</button>
          <button onClick={clearSel} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No staff match these filters.</p>
      ) : view === 'grid' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => <StaffCard key={s.id} s={s} medal={rank.get(s.id)} skillMeta={skillMeta} selected={sel.has(s.id)} onSelect={() => toggleSel(s.id)} onManage={() => setPanelId(s.id)} onToggle={() => toggleActive(s)} onCapacity={(n) => setCapacity(s, n)} />)}
        </div>
      ) : (
        <StaffTable rows={visible} rankMap={rank} skillMeta={skillMeta} sel={sel} allSelected={allSelected} onToggleAll={toggleAll} onToggleSel={toggleSel} onManage={setPanelId} onToggle={toggleActive} />
      )}

      {/* action log */}
      <Card icon="ph-clock-counter-clockwise" title="Recent changes" right={<span className="text-xs text-muted-foreground">{log.length} event{log.length === 1 ? '' : 's'}</span>}>
        {log.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No changes yet — pause a member, tweak capacity, reassign work or edit skills and it shows up here.</p>
        ) : (
          <ul className="scrollbar-thin max-h-60 space-y-2 overflow-y-auto pr-1">
            {log.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} aria-hidden /></span>
                <span className="min-w-0 flex-1 truncate">{h.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.at}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {panel && (
        <SlideOver open onClose={() => setPanelId(null)} title={panel.name}>
          <ManagePanel s={panel} skillMeta={skillMeta} allSkills={allSkills} teammates={teammates}
            prev={prevStaff} next={nextStaff} onNav={setPanelId} onCopy={() => copyStaffLink(panel.id)} copied={copied}
            onToggleActive={() => toggleActive(panel)} onCapacity={(n) => setCapacity(panel, n)} onToggleSkill={(k) => toggleSkill(panel, k)} onReassign={reassign} />
        </SlideOver>
      )}
      {addOpen && <AddStaffModal allSkills={allSkills} skillMeta={skillMeta} invited={invited} busy={adding} onClose={() => { setAddOpen(false); setInvited(null); }} onSave={addStaff} />}
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
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden /> {title}</p>{right}</div>{children}</div>;
}
function Spark({ data, color = 'hsl(var(--primary))', w = 132, h = 36 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data); const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.75} fill={color} />
    </svg>
  );
}

function Medal({ rank }: { rank: number }) {
  const c = rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : '#b45309';
  return <i className="ph-fill ph-medal" style={{ color: c }} title={`#${rank + 1} by score`} aria-hidden />;
}
function StepBtn({ dir, onClick }: { dir: 'down' | 'up'; onClick: () => void }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={dir === 'down' ? 'Decrease capacity' : 'Increase capacity'} className="grid h-5 w-5 place-items-center rounded border border-border text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground"><i className={`ph-bold ${dir === 'down' ? 'ph-minus' : 'ph-plus'}`} aria-hidden /></button>;
}

function StaffCard({ s, medal, skillMeta, selected, onSelect, onManage, onToggle, onCapacity }: { s: StaffVM; medal?: number; skillMeta: SkillMeta; selected: boolean; onSelect: () => void; onManage: () => void; onToggle: () => void; onCapacity: (n: number) => void }) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const pct = Math.round((s.load / s.capacity) * 100);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div role="button" tabIndex={0} onClick={onManage} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onManage(); } }} title="Open quick panel" className={`flex cursor-pointer flex-col rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? 'border-primary/50 ring-1 ring-primary/30' : s.active ? 'border-border' : 'border-border bg-muted/30 opacity-80'}`}>
      <div className="flex items-start gap-2.5">
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={stop} aria-label={`Select ${s.name}`} className="mt-1 accent-primary" />
        <div className="relative"><Avatar name={s.name} />{!s.active && <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-card"><i className="ph-fill ph-pause-circle text-amber-500" aria-hidden /></span>}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StaffHoverCard staff={s.id}><Link href={`/admin/staff/${s.id}`} onClick={stop} className="truncate font-semibold hover:text-primary hover:underline">{s.name}</Link></StaffHoverCard>
            {medal !== undefined && medal < 3 && <Medal rank={medal} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{s.role}</p>
          {s.isNew && <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"><i className="ph-bold ph-sparkle" aria-hidden />New · pending first activity</span>}
          {s.managerName && <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground"><i className="ph-bold ph-user-circle-gear shrink-0" aria-hidden />{s.managerName}</p>}
        </div>
        <div className="text-right">
          <p className="display text-2xl font-bold leading-none text-primary">{s.composite || '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">score</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {s.skills.length ? s.skills.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium"><i className={`ph-fill ${skillMeta[k].icon}`} style={{ color: skillMeta[k].color }} aria-hidden />{skillMeta[k].label}</span>) : <span className="text-[11px] text-muted-foreground">No skills set</span>}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Workload</span>
          <span className="flex items-center gap-1.5">
            <StepBtn dir="down" onClick={() => onCapacity(s.capacity - 1)} />
            <span className={`font-semibold ${s.load > s.capacity ? 'text-destructive' : 'text-foreground'}`}>{s.load}/{s.capacity} · {pct}%</span>
            <StepBtn dir="up" onClick={() => onCapacity(s.capacity + 1)} />
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(s.load, s.capacity) }} /></div>
      </div>

      <div className={`mt-3 grid gap-2 border-t border-border/60 pt-3 text-center ${showMoney ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Stat label="Quality" value={`${s.quality}%`} />
        <Stat label="On-time" value={`${s.onTime}%`} tone={s.onTime < 85 ? 'warn' : undefined} />
        {showMoney && <Stat label="In flight" value={money(s.valueInFlight)} />}
      </div>

      {/* pay + conduct signals (from /staff/finance + /staff/performance) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="Commission tier"><i className="ph-bold ph-seal-check text-primary" aria-hidden />{s.tier}</span>
        {showMoney && <span className="inline-flex items-center gap-1" title="Pay this cycle (base + commission + bonus)"><i className="ph-bold ph-wallet" aria-hidden />{money(s.monthlyPay)}/mo</span>}
        {s.pendingFines > 0 && <span className="inline-flex items-center gap-1 font-semibold text-amber-600" title="Penalties awaiting review"><i className="ph-bold ph-gavel" aria-hidden />{s.pendingFines} fine{s.pendingFines > 1 ? 's' : ''}</span>}
        {s.rewardsTotal > 0 && <span className="ml-auto inline-flex items-center gap-1" title="Rewards unlocked"><i className="ph-bold ph-trophy text-amber-500" aria-hidden />{s.rewardsUnlocked}/{s.rewardsTotal}</span>}
      </div>

      {(s.overdue > 0 || s.dueSoon > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.overdue > 0 && <span className="pill" style={{ background: '#ef44441f', color: '#dc2626' }}><i className="ph-bold ph-warning-circle" aria-hidden />{s.overdue} overdue</span>}
          {s.dueSoon > 0 && <span className="pill pill-warn"><i className="ph-bold ph-timer" aria-hidden />{s.dueSoon} due soon</span>}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        <button onClick={(e) => { stop(e); onToggle(); }} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent" title={s.active ? 'Pause new assignments' : 'Reactivate'}><i className={`ph-bold ${s.active ? 'ph-pause' : 'ph-play'} mr-1`} aria-hidden />{s.active ? 'Pause' : 'Activate'}</button>
        <span className="ml-auto text-[11px] text-muted-foreground"><i className="ph-bold ph-cursor-click mr-0.5" aria-hidden />card = quick panel</span>
        <Link href={`/admin/staff/${s.id}`} onClick={stop} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-user-circle mr-1" aria-hidden />Profile</Link>
      </div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return <div><p className={`text-sm font-bold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}

function StaffTable({ rows, rankMap, skillMeta, sel, allSelected, onToggleAll, onToggleSel, onManage, onToggle }: { rows: StaffVM[]; rankMap: Map<string, number>; skillMeta: SkillMeta; sel: Set<string>; allSelected: boolean; onToggleAll: () => void; onToggleSel: (id: string) => void; onManage: (id: string) => void; onToggle: (s: StaffVM) => void }) {
  const money = useMoney();
  const showMoney = useShowMoney();
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="p-3"><input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all staff" className="accent-primary" /></th>
          <th className="p-3">Staff</th><th className="p-3">Skills</th><th className="p-3 w-40">Workload</th>
          <th className="p-3 text-right">Score</th><th className="p-3">Tier</th><th className="p-3 text-right">Quality</th><th className="p-3 text-right">On-time</th>{showMoney && <th className="p-3 text-right">Pay/mo</th>}<th className="p-3 text-right">Done</th><th className="p-3 text-right">Open</th>
        </tr></thead>
        <tbody>
          {rows.map((s) => { const medal = rankMap.get(s.id); const pct = Math.round((s.load / s.capacity) * 100);
            return (
              <tr key={s.id} onClick={() => onManage(s.id)} className={`cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40 ${sel.has(s.id) ? 'bg-primary/5' : ''} ${s.active ? '' : 'opacity-70'}`}>
                <td className="p-3"><input type="checkbox" checked={sel.has(s.id)} onChange={() => onToggleSel(s.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${s.name}`} className="accent-primary" /></td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5"><StaffHoverCard staff={s.id}><Link href={`/admin/staff/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary hover:underline">{s.name}</Link></StaffHoverCard>{medal !== undefined && medal < 3 && <Medal rank={medal} />}{!s.active && <span className="pill pill-warn"><i className="ph-bold ph-pause" aria-hidden />paused</span>}{s.pendingFines > 0 && <span className="pill pill-warn" title="Penalties pending review"><i className="ph-bold ph-gavel" aria-hidden />{s.pendingFines}</span>}</div>
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
                <td className="p-3"><span className="inline-flex items-center gap-1 text-xs"><i className="ph-bold ph-seal-check text-primary" aria-hidden />{s.tier}</span></td>
                <td className="p-3 text-right">{s.quality}%</td>
                <td className={`p-3 text-right ${s.onTime < 85 ? 'font-semibold text-amber-600' : ''}`}>{s.onTime}%</td>
                {showMoney && <td className="p-3 text-right font-medium">{money(s.monthlyPay)}</td>}
                <td className="p-3 text-right text-muted-foreground">{s.throughput}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onToggle(s); }} className="text-muted-foreground hover:text-foreground" title={s.active ? 'Pause' : 'Activate'}><i className={`ph-bold ${s.active ? 'ph-pause' : 'ph-play'}`} aria-hidden /></button>
                    <Link href={`/admin/staff/${s.id}`} onClick={(e) => e.stopPropagation()} className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold hover:bg-accent">Profile</Link>
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

function ManagePanel({ s, skillMeta, allSkills, teammates, prev, next, onNav, onCopy, copied, onToggleActive, onCapacity, onToggleSkill, onReassign }: {
  s: StaffVM; skillMeta: SkillMeta; allSkills: string[]; teammates: Teammate[];
  prev: StaffVM | null; next: StaffVM | null; onNav: (id: string) => void; onCopy: () => void; copied: boolean;
  onToggleActive: () => void; onCapacity: (n: number) => void; onToggleSkill: (k: string) => void; onReassign: (orderId: string, toName: string, code: string) => void;
}) {
  const money = useMoney();
  const showMoney = useShowMoney();
  const imp = useImpersonatePolicy();
  const pct = Math.round((s.load / s.capacity) * 100);
  const targets = teammates.filter((t) => t.id !== s.id && t.active);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => prev && onNav(prev.id)} disabled={!prev} title="Previous (k)" aria-label="Previous staff" className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"><i className="ph-bold ph-caret-left" aria-hidden /></button>
        <button onClick={() => next && onNav(next.id)} disabled={!next} title="Next (j)" aria-label="Next staff" className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"><i className="ph-bold ph-caret-right" aria-hidden /></button>
        <button onClick={onCopy} title="Copy shareable link" className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"><i className={`ph-bold ${copied ? 'ph-check text-emerald-500' : 'ph-link-simple'}`} aria-hidden />{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="flex items-center gap-3">
        <Avatar name={s.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.role}</p>
          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
          <p className="text-xs text-muted-foreground">Since {s.since} · {s.tz}</p>
          {s.managerName && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><i className="ph-bold ph-user-circle-gear" aria-hidden />Reports to <span className="font-medium text-foreground">{s.managerName}</span></p>}
        </div>
        <button onClick={onToggleActive} role="switch" aria-checked={s.active} aria-label="Toggle active status" className={`relative h-6 w-11 shrink-0 rounded-full transition ${s.active ? 'bg-primary' : 'bg-muted'}`} title={s.active ? 'Active — receiving work' : 'Paused'}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.active ? 'left-[22px]' : 'left-0.5'}`} /></button>
      </div>
      <p className={`-mt-2 text-xs font-semibold ${s.active ? 'text-emerald-600' : 'text-amber-600'}`}><i className={`ph-bold ${s.active ? 'ph-check-circle' : 'ph-pause-circle'} mr-1`} aria-hidden />{s.active ? 'Active — eligible for new assignments' : 'Paused — excluded from auto-routing'}</p>

      <div className="grid grid-cols-4 gap-2">
        <Mini label="Score" value={String(s.composite || '—')} />
        <Mini label="Quality" value={`${s.quality}%`} />
        <Mini label="On-time" value={`${s.onTime}%`} />
        <Mini label="Done" value={String(s.throughput)} />
      </div>

      <Section title="Pay & conduct">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="pill" style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}><i className="ph-bold ph-seal-check" aria-hidden />{s.tier} tier</span>
          {s.rank && <span className="pill pill-good"><i className="ph-bold ph-trophy" aria-hidden />#{s.rank}</span>}
          {s.pendingFines > 0 ? <span className="pill pill-warn"><i className="ph-bold ph-gavel" aria-hidden />{s.pendingFines} fine{s.pendingFines > 1 ? 's' : ''} pending</span> : <span className="pill pill-good"><i className="ph-bold ph-check" aria-hidden />clean record</span>}
          {s.rewardsTotal > 0 && <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}><i className="ph-fill ph-trophy" aria-hidden />{s.rewardsUnlocked}/{s.rewardsTotal} rewards</span>}
        </div>
        <div className={`mt-2 grid gap-2 ${showMoney ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {showMoney && <Mini label="Pay / mo" value={money(s.monthlyPay)} />}
          {showMoney && <Mini label="Wallet" value={money(s.walletBalance)} />}
          <Mini label="Avg ★" value={s.avgRating != null ? `${s.avgRating}` : '—'} />
        </div>
      </Section>

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
          <button onClick={() => onCapacity(s.capacity - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Decrease capacity"><i className="ph-bold ph-minus" aria-hidden /></button>
          <div className="flex-1 text-center"><p className="display text-2xl font-bold">{s.capacity}</p><p className="text-[11px] text-muted-foreground">concurrent slots</p></div>
          <button onClick={() => onCapacity(s.capacity + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg hover:bg-accent" aria-label="Increase capacity"><i className="ph-bold ph-plus" aria-hidden /></button>
        </div>
        {s.load > s.capacity && <p className="mt-2 text-xs font-semibold text-destructive"><i className="ph-bold ph-warning mr-1" aria-hidden />Capacity is below current load ({s.load}) — they’re overbooked.</p>}
      </Section>

      <Section title="Skills">
        <div className="flex flex-wrap gap-1.5">
          {allSkills.map((k) => { const on = s.skills.includes(k); const m = skillMeta[k];
            return <button key={k} onClick={() => onToggleSkill(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} aria-hidden />{m.label}</button>;
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
              <div key={o.id} className="rounded-lg border border-border px-2.5 py-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <PriorityBadge priority={o.priority} />
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-primary hover:underline">{o.code}</Link>
                  <span className="truncate text-xs text-muted-foreground">{o.service}</span>
                  <span className="ml-auto" /><StatusBadge status={o.status} /><Due d={o.daysToDue} />
                </div>
                {targets.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <i className="ph-bold ph-arrow-bend-down-right text-xs text-muted-foreground" aria-hidden />
                    <select value="" onChange={(e) => { if (e.target.value) onReassign(o.id, e.target.value, o.code); }} aria-label={`Reassign ${o.code}`} className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary">
                      <option value="">Reassign to…</option>
                      {targets.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.load}/{t.capacity})</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {imp.canStaff && <button onClick={() => impersonate(s.id, imp.viewOnly ? 'view' : 'act')} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold transition hover:border-primary/50 hover:text-primary" title={imp.viewOnly ? `View ${s.name}’s portal (read-only)` : `Open the staff portal as ${s.name}`}><i className="ph-bold ph-user-switch" aria-hidden />{imp.viewOnly ? 'View as' : 'Impersonate'} {s.name.split(' ')[0]}</button>}
      <div className="flex items-stretch gap-2">
        <Link href={`/admin/staff/${s.id}`} className="flex-1 rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open full profile →</Link>
        <a href={`/admin/staff/${s.id}`} target="_blank" rel="noopener noreferrer" title="Open profile in a new tab" aria-label="Open profile in a new tab" className="grid shrink-0 place-items-center rounded-lg border border-border px-3 hover:bg-accent"><i className="ph-bold ph-arrow-square-out" aria-hidden /></a>
      </div>
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

function AddStaffModal({ allSkills, skillMeta, invited, busy, onClose, onSave }: { allSkills: string[]; skillMeta: SkillMeta; invited: { email: string; tempPassword: string } | null; busy: boolean; onClose: () => void; onSave: (d: { name: string; email: string; role: string; capacity: number; skills: string[] }) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [skills, setSkills] = useState<string[]>([]);
  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary';
  const toggle = (k: string) => setSkills((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const emailValid = /.+@.+\..+/.test(email.trim());
  const canSave = name.trim().length > 1 && emailValid;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="display mb-4 text-base font-bold">{invited ? 'Staff added' : 'Add staff member'}</p>
        {invited ? (
          <>
            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
              <p className="text-sm text-muted-foreground"><b className="text-foreground">{invited.email}</b> is set up as staff. Share these first-login credentials securely — they change the password on first sign-in.</p>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">
                <span className="text-muted-foreground">Temp password</span>
                <span className="select-all font-semibold text-foreground">{invited.tempPassword}</span>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-check" aria-hidden /> Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara N." className={inp} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Email (login)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. sara@hevaseo.com" className={inp} />{email && !emailValid && <span className="mt-1 block text-[11px] text-rose-500">Enter a valid email.</span>}</label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Role title</span><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. SEO Specialist" className={inp} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Capacity (concurrent slots)</span><input type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={`${inp} w-28`} /></label>
              <div><span className="mb-1 block text-xs font-semibold text-muted-foreground">Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {allSkills.map((k) => { const on = skills.includes(k); const m = skillMeta[k];
                    return <button key={k} type="button" onClick={() => toggle(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}><i className={`ph-${on ? 'fill' : 'bold'} ${on ? m.icon : 'ph-plus'}`} style={on ? { color: m.color } : undefined} aria-hidden />{m.label}</button>;
                  })}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={() => canSave && onSave({ name: name.trim(), email: email.trim(), role: role.trim(), capacity, skills })} disabled={!canSave || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"><i className={`ph-bold ${busy ? 'ph-circle-notch animate-spin' : 'ph-user-plus'}`} aria-hidden /> {busy ? 'Adding…' : 'Add member'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
