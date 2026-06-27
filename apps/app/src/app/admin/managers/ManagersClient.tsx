'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/shared/SlideOver';
import { money } from '@/data/adminMock';

// ── view-model types (built in page.tsx) ──────────────────────────────────────
export interface StaffMemberVM {
  id: string; name: string; role: string; active: boolean; skills: string[];
  capacity: number; load: number; overdue: number; dueSoon: number; valueInFlight: number;
  composite: number; quality: number; onTime: number;
  managerId: string | null;
}
export interface ManagerMeta { id: string; name: string; title: string; email: string }
export interface TeamLeaveVM {
  id: string; staffId: string; staffName: string; role: string;
  from: string; to: string; days: number; reason: string; status: 'pending' | 'approved' | 'declined';
}
type SkillMeta = Record<string, { label: string; icon: string; color: string }>;
type LeaveState = Record<string, 'pending' | 'approved' | 'declined'>;
type Assignment = Record<string, string | null>; // staffId → managerId | null
type SortKey = 'team' | 'util' | 'quality' | 'name';

const SORT_LABEL: Record<SortKey, string> = { team: 'Team size', util: 'Utilization', quality: 'Avg quality', name: 'Name' };

// ── derived per-manager shape, recomputed from live assignment ──
interface DerivedManager extends ManagerMeta {
  team: StaffMemberVM[]; leave: TeamLeaveVM[];
  teamSize: number; activeCount: number; cap: number; load: number; util: number; free: number;
  avgQuality: number; avgOnTime: number; valueInFlight: number; overdue: number; dueSoon: number;
  overloaded: number; pendingLeave: number;
}

function derive(meta: ManagerMeta, staff: StaffMemberVM[], leave: TeamLeaveVM[], assignment: Assignment, leaveState: LeaveState): DerivedManager {
  const team = staff.filter((s) => assignment[s.id] === meta.id);
  const act = team.filter((s) => s.active);
  const cap = act.reduce((n, s) => n + s.capacity, 0);
  const load = act.reduce((n, s) => n + s.load, 0);
  const teamLeave = leave.filter((l) => assignment[l.staffId] === meta.id);
  return {
    ...meta, team, leave: teamLeave,
    teamSize: team.length, activeCount: act.length,
    cap, load, util: cap ? Math.round((load / cap) * 100) : 0, free: Math.max(0, cap - load),
    avgQuality: act.length ? Math.round(act.reduce((n, s) => n + s.quality, 0) / act.length) : 0,
    avgOnTime: act.length ? Math.round(act.reduce((n, s) => n + s.onTime, 0) / act.length) : 0,
    valueInFlight: team.reduce((n, s) => n + s.valueInFlight, 0),
    overdue: team.reduce((n, s) => n + s.overdue, 0),
    dueSoon: team.reduce((n, s) => n + s.dueSoon, 0),
    overloaded: act.filter((s) => s.load > s.capacity).length,
    pendingLeave: teamLeave.filter((l) => (leaveState[l.id] ?? l.status) === 'pending').length,
  };
}

export function ManagersClient({ managers, staff, leave, skillMeta }: {
  managers: ManagerMeta[]; staff: StaffMemberVM[]; leave: TeamLeaveVM[]; skillMeta: SkillMeta;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('team');
  const [panelId, setPanelId] = useState<string | null>(null);
  // live staff→manager assignment (admin edits this on the page)
  const [assignment, setAssignment] = useState<Assignment>(() => Object.fromEntries(staff.map((s) => [s.id, s.managerId])));
  const [leaveState, setLeaveState] = useState<LeaveState>(() => Object.fromEntries(leave.map((l) => [l.id, l.status])));
  const [toast, setToast] = useState<string | null>(null);

  const nameOf = (id: string | null) => managers.find((m) => m.id === id)?.name ?? null;
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const assign = (staffId: string, managerId: string | null) => {
    const who = staff.find((s) => s.id === staffId)?.name ?? 'Staff';
    setAssignment((a) => ({ ...a, [staffId]: managerId }));
    notify(managerId ? `${who} → ${nameOf(managerId)}'s team` : `${who} unassigned from a manager`);
  };
  const decide = (id: string, status: 'approved' | 'declined', who: string) => {
    setLeaveState((s) => ({ ...s, [id]: status }));
    notify(`${who}'s leave ${status === 'approved' ? 'approved ✓' : 'declined'}`);
  };

  // ── drag a staff chip onto a manager card (or the unassign zone) ──
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null); // manager id | '__unassigned'
  const endDrag = () => { setDragId(null); setOverTarget(null); };
  const dropOn = (target: string) => {
    if (dragId) {
      const current = staff.find((s) => s.id === dragId);
      const next = target === '__unassigned' ? null : target;
      if (current && (assignment[dragId] ?? null) !== next) assign(dragId, next);
    }
    endDrag();
  };

  const derived = useMemo(() => managers.map((m) => derive(m, staff, leave, assignment, leaveState)),
    [managers, staff, leave, assignment, leaveState]);
  const unmanaged = useMemo(() => staff.filter((s) => !assignment[s.id]), [staff, assignment]);

  const totals = useMemo(() => {
    const cap = derived.reduce((n, m) => n + m.cap, 0);
    const load = derived.reduce((n, m) => n + m.load, 0);
    const act = derived.filter((m) => m.activeCount > 0);
    const assigned = staff.length - unmanaged.length;
    return {
      managers: managers.length,
      staff: assigned,
      util: cap ? Math.round((load / cap) * 100) : 0,
      avgQuality: act.length ? Math.round(act.reduce((n, m) => n + m.avgQuality, 0) / act.length) : 0,
      span: managers.length ? (assigned / managers.length).toFixed(1) : '0',
      pending: derived.reduce((n, m) => n + m.pendingLeave, 0),
      overloaded: derived.reduce((n, m) => n + m.overloaded, 0),
    };
  }, [derived, managers, staff, unmanaged]);

  const visible = useMemo(() => derived
    .filter((m) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      // match the manager, their title, or any staff name on their team
      return `${m.name} ${m.title}`.toLowerCase().includes(q) || m.team.some((s) => s.name.toLowerCase().includes(q));
    })
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name)
      : sortBy === 'util' ? b.util - a.util
      : sortBy === 'quality' ? b.avgQuality - a.avgQuality
      : b.teamSize - a.teamSize),
    [derived, search, sortBy]);

  const panel = panelId ? derived.find((m) => m.id === panelId) ?? null : null;

  // deep-link the open manager (?m=mgr1) — shareable + survives refresh
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('m'); if (id && managers.some((x) => x.id === id)) setPanelId(id); }, [managers]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (panelId) url.searchParams.set('m', panelId); else url.searchParams.delete('m');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [panelId]);

  return (
    <section className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Managers</h1>
          <p className="text-sm text-muted-foreground">Team leads, their staff, capacity and approvals — assign who manages whom.</p>
        </div>
        <button onClick={() => notify('Invite manager — wire to backend later')} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-user-plus mr-1" aria-hidden />Add manager</button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-user-circle-gear" label="Managers" value={String(totals.managers)} />
        <Kpi icon="ph-users-three" label="Staff managed" value={String(totals.staff)} sub={`${totals.span} avg span`} />
        <Kpi icon="ph-gauge" label="Team utilization" value={`${totals.util}%`} tone={totals.util >= 90 ? 'warn' : 'good'} />
        <Kpi icon="ph-seal-check" label="Avg quality" value={`${totals.avgQuality}%`} />
        <Kpi icon="ph-airplane-takeoff" label="Pending leave" value={String(totals.pending)} tone={totals.pending ? 'warn' : 'good'} sub="awaiting you" />
        <Kpi icon="ph-warning-circle" label="Overloaded" value={String(totals.overloaded)} tone={totals.overloaded ? 'warn' : 'good'} sub="staff over cap" />
      </div>

      {/* unmanaged / unassign drop zone — visible when there are unmanaged staff or a drag is in progress */}
      {(unmanaged.length > 0 || dragId) && (
        <div
          onDragOver={(e) => { if (dragId) e.preventDefault(); }}
          onDragEnter={() => dragId && setOverTarget('__unassigned')}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverTarget((t) => (t === '__unassigned' ? null : t)); }}
          onDrop={(e) => { e.preventDefault(); dropOn('__unassigned'); }}
          className={`rounded-xl border px-3 py-2.5 transition ${overTarget === '__unassigned' ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40' : 'border-amber-500/30 bg-amber-500/5'}`}
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <i className="ph-bold ph-warning" aria-hidden />
            {dragId ? 'Drop here to leave unmanaged' : `${unmanaged.length} staff have no manager — drag onto a manager, or assign:`}
          </p>
          <div className="flex flex-wrap gap-2">
            {unmanaged.map((u) => (
              <div
                key={u.id} draggable
                onDragStart={(e) => { setDragId(u.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', u.id); }}
                onDragEnd={endDrag}
                className={`flex cursor-grab items-center gap-1.5 rounded-lg border border-border bg-card py-1 pl-2 pr-1 text-xs active:cursor-grabbing ${dragId === u.id ? 'opacity-40' : ''}`}
              >
                <i className="ph-bold ph-dots-six-vertical text-muted-foreground" aria-hidden />
                <span className="font-medium">{u.name}</span>
                <ManagerSelect managers={managers} value={null} onChange={(mid) => assign(u.id, mid)} />
              </div>
            ))}
            {unmanaged.length === 0 && <span className="text-[11px] text-muted-foreground">Everyone has a manager.</span>}
          </div>
        </div>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search manager, title or staff…" aria-label="Search managers or staff" className="w-52 rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary sm:w-64" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} aria-label="Sort managers" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORT_LABEL[k]}</option>)}
        </select>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><i className="ph-bold ph-hand-grabbing" aria-hidden />Drag a staff chip onto a manager to reassign</span>
        <span className="text-xs text-muted-foreground">{visible.length} of {managers.length}</span>
      </div>

      {/* directory */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No managers or staff match &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((m) => (
            <ManagerCard
              key={m.id} m={m} onOpen={() => setPanelId(m.id)}
              dragId={dragId} isOver={overTarget === m.id}
              onChipDragStart={setDragId} onChipDragEnd={endDrag}
              onCardEnter={() => dragId && setOverTarget(m.id)}
              onCardLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverTarget((t) => (t === m.id ? null : t)); }}
              onCardDrop={() => dropOn(m.id)}
            />
          ))}
        </div>
      )}

      {/* detail panel */}
      {panel && (
        <SlideOver open onClose={() => setPanelId(null)} title={panel.name}>
          <ManagerPanel
            m={panel} allStaff={staff} managers={managers} assignment={assignment} skillMeta={skillMeta} leaveState={leaveState}
            onAssign={assign} onDecide={decide}
          />
        </SlideOver>
      )}

      {/* toast */}
      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-[90] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">
          <i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}
        </div>
      )}
    </section>
  );
}

// ── reusable manager picker ───────────────────────────────────────────────────
function ManagerSelect({ managers, value, onChange, includeUnassign }: {
  managers: ManagerMeta[]; value: string | null; onChange: (mid: string | null) => void; includeUnassign?: boolean;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Assign to manager"
      className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
    >
      <option value="">{includeUnassign ? 'Unassign' : 'Pick manager…'}</option>
      {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

// ── directory card ────────────────────────────────────────────────────────────
function ManagerCard({ m, onOpen, dragId, isOver, onChipDragStart, onChipDragEnd, onCardEnter, onCardLeave, onCardDrop }: {
  m: DerivedManager; onOpen: () => void;
  dragId: string | null; isOver: boolean;
  onChipDragStart: (staffId: string) => void; onChipDragEnd: () => void;
  onCardEnter: () => void; onCardLeave: (e: React.DragEvent) => void; onCardDrop: () => void;
}) {
  const dragActive = dragId !== null;
  const dropping = isOver && !m.team.some((s) => s.id === dragId); // only highlight if it would actually move
  return (
    <div
      role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      onDragOver={(e) => { if (dragActive) e.preventDefault(); }}
      onDragEnter={onCardEnter}
      onDragLeave={onCardLeave}
      onDrop={(e) => { e.preventDefault(); onCardDrop(); }}
      title="Open manager · drop a staff here to assign"
      className={`flex cursor-pointer flex-col rounded-2xl border bg-card p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${dropping ? 'border-primary ring-2 ring-primary/40' : dragActive ? 'border-dashed border-primary/40' : 'border-border hover:border-primary/40 hover:shadow-sm'}`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={m.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name}</p>
          <p className="truncate text-xs text-muted-foreground">{m.title}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {m.pendingLeave > 0 && <span className="pill pill-warn"><i className="ph-bold ph-airplane-takeoff" aria-hidden />{m.pendingLeave} leave</span>}
          {m.overdue > 0 && <span className="pill" style={{ background: '#ef44441f', color: '#dc2626' }}><i className="ph-bold ph-warning-circle" aria-hidden />{m.overdue} overdue</span>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {m.team.map((s) => (
          <span
            key={s.id} draggable
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => { e.stopPropagation(); onChipDragStart(s.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); }}
            onDragEnd={onChipDragEnd}
            title={`${s.name} · ${s.role} — drag to another manager`}
            className={`inline-flex cursor-grab items-center gap-1 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-2 text-[11px] font-medium active:cursor-grabbing ${dragId === s.id ? 'opacity-40' : ''}`}
          >
            <i className="ph-bold ph-dots-six-vertical text-muted-foreground" aria-hidden /><Avatar name={s.name} size={18} />{s.name}{!s.active && <i className="ph-fill ph-pause-circle text-amber-500" aria-hidden />}
          </span>
        ))}
        {m.team.length === 0 && <span className="text-[11px] text-muted-foreground">{dragActive ? 'Drop a staff here' : 'No staff assigned — open to add'}</span>}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Team utilization</span>
          <span className={`font-semibold ${m.util >= 100 ? 'text-destructive' : m.util >= 90 ? 'text-amber-600' : 'text-foreground'}`}>{m.load}/{m.cap} · {m.util}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(m.util, 100)}%`, background: m.util >= 100 ? 'hsl(var(--destructive))' : m.util >= 90 ? '#f59e0b' : 'hsl(var(--primary))' }} /></div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-3 text-center">
        <Stat label="Team" value={String(m.teamSize)} />
        <Stat label="Quality" value={`${m.avgQuality}%`} />
        <Stat label="On-time" value={`${m.avgOnTime}%`} tone={m.avgOnTime < 85 ? 'warn' : undefined} />
        <Stat label="In flight" value={money(m.valueInFlight)} />
      </div>
    </div>
  );
}

// ── detail panel ──────────────────────────────────────────────────────────────
function ManagerPanel({ m, allStaff, managers, assignment, skillMeta, leaveState, onAssign, onDecide }: {
  m: DerivedManager; allStaff: StaffMemberVM[]; managers: ManagerMeta[]; assignment: Assignment;
  skillMeta: SkillMeta; leaveState: LeaveState;
  onAssign: (staffId: string, managerId: string | null) => void;
  onDecide: (id: string, status: 'approved' | 'declined', who: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const leave = m.leave.map((l) => ({ ...l, status: leaveState[l.id] ?? l.status }));
  const pending = leave.filter((l) => l.status === 'pending');
  const resolved = leave.filter((l) => l.status !== 'pending');
  const others = managers.filter((x) => x.id !== m.id);
  // staff not on this team — addable, grouped by current owner
  const addable = allStaff.filter((s) => assignment[s.id] !== m.id);
  const nameOf = (id: string | null) => managers.find((x) => x.id === id)?.name ?? 'Unassigned';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={m.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{m.title}</p>
          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          <p className="text-xs text-muted-foreground">{m.teamSize} staff · {m.activeCount} active</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <PanelStat label="Utilization" value={`${m.util}%`} tone={m.util >= 90 ? 'warn' : 'good'} />
        <PanelStat label="Avg quality" value={`${m.avgQuality}%`} />
        <PanelStat label="Avg on-time" value={`${m.avgOnTime}%`} tone={m.avgOnTime < 85 ? 'warn' : undefined} />
        <PanelStat label="Free slots" value={String(m.free)} tone={m.free === 0 ? 'warn' : 'good'} />
        <PanelStat label="In flight" value={money(m.valueInFlight)} />
        <PanelStat label="Overdue" value={String(m.overdue)} tone={m.overdue ? 'warn' : 'good'} />
      </div>

      {/* skill coverage — gaps flagged so a team isn't blind to a skill */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><i className="ph-bold ph-certificate text-primary" aria-hidden />Skill coverage</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(skillMeta).map((k) => {
            const n = m.team.filter((s) => s.active && s.skills.includes(k)).length;
            const meta = skillMeta[k];
            return (
              <span key={k} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${n === 0 ? 'border-amber-500/40 bg-amber-500/5 text-amber-700' : 'border-border bg-muted'}`}>
                <i className={`ph-fill ${meta.icon}`} style={{ color: n === 0 ? undefined : meta.color }} aria-hidden />
                {meta.label}
                <span className={n === 0 ? 'font-semibold' : 'text-muted-foreground'}>{n === 0 ? 'gap' : `×${n}`}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* leave approvals */}
      <Section icon="ph-airplane-takeoff" title="Leave approvals" badge={pending.length ? String(pending.length) : undefined}>
        {leave.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leave requests from this team.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Avatar name={l.staffName} size={20} />{l.staffName}</span>
                  <span className="text-xs text-muted-foreground">{l.days}d</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{l.from} → {l.to}</p>
                <p className="mt-1 text-xs">{l.reason}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onDecide(l.id, 'approved', l.staffName)} className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-check mr-1" aria-hidden />Approve</button>
                  <button onClick={() => onDecide(l.id, 'declined', l.staffName)} className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-x mr-1" aria-hidden />Decline</button>
                </div>
              </div>
            ))}
            {resolved.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-2 font-medium"><Avatar name={l.staffName} size={18} />{l.staffName} · {l.days}d</span>
                <span className={`pill ${l.status === 'approved' ? 'pill-live' : 'pill'}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* team roster — editable */}
      <Section
        icon="ph-users-three" title="Team" badge={String(m.teamSize)}
        action={<button onClick={() => setAdding((v) => !v)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${adding ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}><i className="ph-bold ph-user-plus" aria-hidden />Add staff</button>}
      >
        {/* capacity context */}
        <p className={`mb-2 flex items-center gap-1.5 text-[11px] ${m.load > m.cap ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
          <i className={`ph-bold ${m.load > m.cap ? 'ph-warning' : 'ph-gauge'}`} aria-hidden />
          {m.load > m.cap ? `Over capacity by ${m.load - m.cap} — rebalance or raise capacity` : `${m.load}/${m.cap} slots used · ${m.free} free`}
        </p>

        {/* add picker */}
        {adding && (
          <div className="mb-3 rounded-xl border border-border bg-background/40 p-2">
            <p className="mb-1.5 px-1 text-[11px] font-semibold text-muted-foreground">Add a staff member to {m.name}&apos;s team</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {addable.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent">
                  <Avatar name={s.name} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{s.name} <span className="font-normal text-muted-foreground">· {s.load}/{s.capacity} load</span></p>
                    <p className="truncate text-[10px] text-muted-foreground">{s.role} · now: {nameOf(assignment[s.id])}</p>
                  </div>
                  <button onClick={() => onAssign(s.id, m.id)} className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:border-primary hover:text-primary"><i className="ph-bold ph-plus" aria-hidden />Add</button>
                </div>
              ))}
              {addable.length === 0 && <p className="px-1 py-2 text-[11px] text-muted-foreground">Everyone is already on this team.</p>}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {m.team.map((s) => {
            const pct = s.capacity ? Math.round((s.load / s.capacity) * 100) : 0;
            return (
              <div key={s.id} className={`rounded-xl border p-2.5 ${s.active ? 'border-border bg-background/40' : 'border-border bg-muted/30 opacity-80'}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/staff?staff=${s.id}`} className="block truncate text-sm font-semibold hover:text-primary hover:underline">{s.name}</Link>
                    <p className="truncate text-[11px] text-muted-foreground">{s.role}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${s.load > s.capacity ? 'text-destructive' : 'text-foreground'}`}>{s.load}/{s.capacity}</p>
                    <p className="text-[10px] text-muted-foreground">Q{s.quality} · {s.onTime}%</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: s.load > s.capacity ? 'hsl(var(--destructive))' : pct > 85 ? '#f59e0b' : 'hsl(var(--primary))' }} /></div>
                  {s.overdue > 0 && <span className="pill" style={{ background: '#ef44441f', color: '#dc2626' }}>{s.overdue} late</span>}
                  {!s.active && <span className="pill pill-warn">paused</span>}
                </div>
                {/* reassign / remove */}
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">Move to</span>
                  <select
                    value={m.id}
                    onChange={(e) => onAssign(s.id, e.target.value || null)}
                    aria-label={`Reassign ${s.name}`}
                    className="rounded-md border border-border bg-background px-1.5 py-1 outline-none focus:border-primary"
                  >
                    <option value={m.id}>{m.name} (current)</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    <option value="">Unassign</option>
                  </select>
                </div>
              </div>
            );
          })}
          {m.team.length === 0 && <p className="text-xs text-muted-foreground">No staff yet — use <b>Add staff</b> above.</p>}
        </div>
        <Link href={`/admin/staff?manager=${m.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open team in Staff <i className="ph-bold ph-arrow-right" aria-hidden /></Link>
      </Section>
    </div>
  );
}

// ── small bits ────────────────────────────────────────────────────────────────
function Section({ icon, title, badge, action, children }: { icon: string; title: string; badge?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} aria-hidden />{title}</p>
        {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{badge}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
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
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div>
      <p className={`text-sm font-semibold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
function PanelStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : '';
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2 text-center">
      <p className={`display text-base font-bold leading-none ${col}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// self-contained avatar (keeps this surface independent of the staff module)
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }}>{initialsOf(name)}</span>;
}
function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}
function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
