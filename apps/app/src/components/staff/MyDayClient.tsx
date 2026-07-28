'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge } from '@/components/shared/StatBadge';
import type { Priority } from '@/data/adminMock';
import { money } from '@/data/adminMock';
import { SlaChip } from '@/components/staff/SlaChip';
import { DeliverableSubmit } from '@/components/staff/DeliverableSubmit';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { deliverablesFor, statusLabel, type OrderStatus, type StaffEarnings, type LatestReview } from '@/data/staffMock';
import { primaryActionFor, applyAction, undoAction, deriveKpis, groupFocus, filterFocus, type MyDayTask, type MyDayState } from '@/lib/myDay';

export interface OverviewData {
  earnings: StaffEarnings | null;
  manager: { name: string; title: string; message: string | null; at: string | null };
  review: LatestReview | null;
  customers: { name: string; active: number; services: string[] }[];
  onTime: number;
  wallet: { available: number; balance: number };
  tier: { level: string; mult: number; nextLevel: string | null; toNext: number };
  reward: { title: string; progressPct: number; hint: string; amount: number } | null;
  earnedBonus: number;
  fines: { pending: number; pendingTotal: number; appliedTotal: number };
  upcoming: { code: string; service: string; days: number }[];
  streak: number;
  avgCommission: number;
}

const SHORTCUTS = [
  { href: '/staff/tasks', icon: 'ph-kanban', label: 'My tasks' },
  { href: '/staff/calendar', icon: 'ph-calendar-dots', label: 'Calendar' },
  { href: '/staff/deliverables', icon: 'ph-package', label: 'Deliverables' },
  { href: '/staff/performance', icon: 'ph-chart-line-up', label: 'Performance' },
  { href: '/staff/finance', icon: 'ph-wallet', label: 'Finance' },
  { href: '/staff/notes', icon: 'ph-note-pencil', label: 'Notes' },
  { href: '/staff/docs', icon: 'ph-book-open-text', label: 'Docs' },
];

interface Props { greeting: string; capacity: number; everHadTasks: boolean; initialFocus: MyDayTask[]; overview: OverviewData; }

const VERB_TONE: Record<string, string> = { Submitted: 'text-emerald-500', Started: 'text-primary', Resumed: 'text-amber-500' };
const STATUS_CHIPS: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: statusLabel.assigned },
  { key: 'in_progress', label: statusLabel.in_progress },
  { key: 'changes_requested', label: statusLabel.changes_requested },
];

// Shared column template so every row + the header line up as a real table.
const COLS = 'grid grid-cols-[8rem_7rem_10.5rem_minmax(0,1fr)_auto] items-center gap-x-3';

export function MyDayClient({ greeting, capacity, everHadTasks, initialFocus, overview }: Props) {
  const router = useRouter();
  const [state, setState] = useState<MyDayState>({ focus: initialFocus, log: [] });
  const [sel, setSel] = useState(-1); // -1 = nothing selected; first j/k enters the list
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; entryId: string } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const idc = useRef(0);
  const makeId = () => `c${idc.current++}`;
  const kpis = deriveKpis(state);

  const visible = filterFocus(state.focus, statusFilter, query);
  const groups = groupFocus(visible);

  const subtitle =
    kpis.overdue > 0 ? `${kpis.overdue} overdue — clear ${kpis.overdue === 1 ? 'it' : 'these'} first`
      : kpis.dueToday > 0 ? `${kpis.dueToday} due today`
        : kpis.load > 0 ? `${kpis.load} task${kpis.load === 1 ? '' : 's'} need you`
          : 'Nothing needs you right now';

  function flash(text: string, entryId: string) {
    setToast({ text, entryId });
    setTimeout(() => setToast((c) => (c?.entryId === entryId ? null : c)), 5000);
  }

  function act(id: string) {
    const task = state.focus.find((x) => x.id === id);
    if (!task) return;
    const action = primaryActionFor(task.status);
    if (!action) return;
    if (action.to === 'internal_review') { setSubmitId(id); return; }
    const next = applyAction(state, id, now(), makeId);
    setState(next);
    flash(`${task.code} · ${verbPast(action.label)}`, next.log[0].id);
  }

  function confirmSubmit() {
    if (!submitId) return;
    const task = state.focus.find((x) => x.id === submitId);
    const next = applyAction(state, submitId, now(), makeId);
    setState(next);
    setSubmitId(null);
    if (task) flash(`${task.code} · sent to review`, next.log[0].id);
  }

  function undo(entryId: string) { setState((s) => undoAction(s, entryId)); setToast(null); }
  function clearFilters() { setQuery(''); setStatusFilter('all'); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing && !submitId) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (submitId || typing) return;
      const max = visible.length - 1;
      if (e.key === 'j') { e.preventDefault(); setSel((i) => Math.min(i + 1, max)); }
      else if (e.key === 'k') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && visible[sel]) router.push(`/staff/tasks/${visible[sel].id}`);
      else if (e.key === ' ' && visible[sel]) { e.preventDefault(); act(visible[sel].id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, sel, submitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTask = submitId ? state.focus.find((x) => x.id === submitId) : null;

  function renderRow(task: MyDayTask, index: number) {
    const action = primaryActionFor(task.status);
    return (
      <li key={task.id} onClick={() => router.push(`/staff/tasks/${task.id}`)}
        className={`${COLS} group cursor-pointer px-2 py-2.5 transition hover:bg-foreground/[0.06] ${index === sel ? 'bg-primary/10' : ''}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <PriorityDot priority={task.priority} />
          <span className="truncate font-medium">{task.code}</span>
        </div>
        <div><SlaChip daysToDue={task.days} /></div>
        <div className="overflow-hidden"><StatusBadge status={task.status} /></div>
        <div className="truncate text-sm text-muted-foreground">{task.service} · {task.pkg}</div>
        <div className="flex items-center justify-end gap-1.5">
          {action && (
            <button onClick={(e) => { e.stopPropagation(); act(task.id); }}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 ${action.primary ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
              <i className={`ph-bold ${action.icon}`} aria-hidden /> {shortLabel(action.label)}
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); copyLink(task.id, () => flash(`${task.code} · link copied`, makeId())); }} aria-label="Copy link"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground opacity-0 transition hover:bg-accent focus:opacity-100 group-hover:opacity-100"><i className="ph-bold ph-link" aria-hidden /></button>
        </div>
      </li>
    );
  }

  let flatIndex = -1;

  return (
    <section className="mx-auto max-w-7xl">
      {(() => {
        const doneToday = kpis.cleared;
        const total = doneToday + kpis.load;
        const pct = total > 0 ? Math.round((doneToday / total) * 100) : 100;
        const queueCommission = Math.round(kpis.load * overview.avgCommission);
        return (
          <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="display text-2xl font-bold tracking-tight">{greeting}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {overview.streak > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600" title="consecutive first-pass deliveries">
                    <i className="ph-fill ph-fire" aria-hidden /> {overview.streak} first-pass streak
                  </span>
                )}
                {kpis.load > 0 && queueCommission > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600" title="estimated commission for finishing your open queue">
                    <i className="ph-fill ph-coins" aria-hidden /> ≈{money(queueCommission)} to earn
                  </span>
                )}
              </div>
            </div>

            {(kpis.load > 0 || doneToday > 0) && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-muted-foreground">Today’s momentum</span>
                  <span>{doneToday === 0 && kpis.load > 0 ? 'Let’s get the first one done' : kpis.load === 0 ? 'Queue clear — nice 🎉' : `${doneToday} done · ${kpis.load} to go`}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Stat row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon="ph-gauge" label="My load" value={`${kpis.load}/${capacity}`} tone={kpis.load >= capacity ? 'warn' : 'primary'} />
        <StatTile icon="ph-warning" label="Overdue" value={String(kpis.overdue)} tone={kpis.overdue ? 'bad' : 'muted'} />
        <StatTile icon="ph-calendar-check" label="Due today" value={String(kpis.dueToday)} tone={kpis.dueToday ? 'warn' : 'muted'} />
        <StatTile icon="ph-clock" label="On-time" value={`${overview.onTime}%`} tone={overview.onTime < 85 ? 'warn' : 'good'} />
        <StatTile icon="ph-check-circle" label="Cleared today" value={String(kpis.cleared)} tone={kpis.cleared ? 'good' : 'muted'} />
      </div>

      {/* Quick links to every staff surface */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
            <i className={`ph-bold ${s.icon} text-primary`} aria-hidden /> {s.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Work column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="kcard">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <i className="ph-bold ph-target text-primary" aria-hidden /> Focus today
                {state.focus.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{state.focus.length}</span>}
              </p>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                <kbd className="rounded border border-border bg-muted px-1">j</kbd>/<kbd className="rounded border border-border bg-muted px-1">k</kbd> · <kbd className="rounded border border-border bg-muted px-1">space</kbd> act · <kbd className="rounded border border-border bg-muted px-1">/</kbd> search
              </span>
            </div>

            {state.focus.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                  <i className="ph-bold ph-magnifying-glass text-muted-foreground" aria-hidden />
                  <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search my tasks…  (press /)" aria-label="Search my tasks" className="w-full bg-transparent outline-none" />
                  {query && <button onClick={() => setQuery('')} aria-label="Clear search"><i className="ph-bold ph-x text-muted-foreground" aria-hidden /></button>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {STATUS_CHIPS.map((c) => {
                    const n = c.key === 'all' ? state.focus.length : state.focus.filter((t) => t.status === c.key).length;
                    return (
                      <button key={c.key} onClick={() => { setStatusFilter(c.key); setSel(-1); }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${statusFilter === c.key ? 'bg-primary text-primary-foreground' : 'border border-border hover:border-primary/50'}`}>
                        {c.label} <span className="opacity-70">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {state.focus.length === 0 ? (
              <div>
                {kpis.cleared > 0 && <p className="mb-3 text-center text-sm font-semibold text-emerald-500">You cleared {kpis.cleared} today 🎉</p>}
                <EmptyState kind={emptyKindFor(everHadTasks || kpis.cleared > 0)} />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <i className="ph-bold ph-funnel-x text-2xl text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">No tasks match your search or filter.</p>
                <button onClick={clearFilters} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Clear filters</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className={`${COLS} border-b border-border px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground`}>
                    <span>Task</span><span>Due</span><span>Status</span><span>Brief</span><span className="text-right">Action</span>
                  </div>
                  {groups.map((g) => (
                    <div key={g.key} className="mb-1">
                      <p className="px-2 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.label} · {g.items.length}</p>
                      <ul className="divide-y divide-border/50 border-t border-border/50">
                        {g.items.map((task) => { flatIndex += 1; return renderRow(task, flatIndex); })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {state.log.length > 0 && (
            <div className="kcard">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-check-circle text-emerald-500" aria-hidden /> Cleared today · {state.log.length}</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {state.log.map((e) => (
                  <li key={e.id}><span className={VERB_TONE[e.verb] ?? ''}>{e.verb}</span> · {e.code} · {e.at}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Context rail */}
        <aside className="space-y-3">
          {/* Wallet & pay */}
          <Link href="/staff/finance" className="kcard block transition hover:border-primary/40">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-wallet text-emerald-500" aria-hidden /> Wallet</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600" title="commission tier">
                <i className="ph-fill ph-medal" aria-hidden /> {overview.tier.level} {overview.tier.mult}×
              </span>
            </div>
            <p className="display text-xl font-bold">{money(overview.wallet.available)} <span className="text-xs font-normal text-muted-foreground">available</span></p>
            {overview.earnings && <p className="mt-0.5 text-xs text-muted-foreground">{money(overview.earnings.takeHome)} take-home this month</p>}
            {overview.fines.pending > 0 && (
              <p className="mt-2 flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-500">
                <i className="ph-bold ph-warning-octagon" aria-hidden /> {overview.fines.pending} fine{overview.fines.pending === 1 ? '' : 's'} pending · −{money(overview.fines.pendingTotal)}
              </p>
            )}
          </Link>

          {/* Next bonus */}
          <Link href="/staff/performance" className="kcard block transition hover:border-primary/40">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-fill ph-gift text-emerald-500" aria-hidden /> Next bonus</p>
              {overview.earnedBonus > 0 && <span className="text-[10px] font-semibold text-emerald-600">{money(overview.earnedBonus)} earned</span>}
            </div>
            {overview.reward ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{overview.reward.title}</span>
                  <span className="text-xs font-bold text-emerald-600">+{money(overview.reward.amount)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${overview.reward.progressPct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{overview.reward.hint}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">All bonuses earned 🎉</p>}
          </Link>

          {/* This week's deadlines */}
          <Link href="/staff/calendar" className="kcard block transition hover:border-primary/40">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-calendar-dots text-primary" aria-hidden /> This week</p>
            {overview.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deadlines in the next 7 days.</p>
            ) : (
              <ul className="space-y-1.5">
                {overview.upcoming.map((u) => (
                  <li key={u.code} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{u.code}</span> <span className="text-muted-foreground">· {u.service}</span></span>
                    <span className={`shrink-0 text-xs font-semibold ${u.days === 0 ? 'text-amber-500' : u.days <= 2 ? 'text-amber-500' : 'text-muted-foreground'}`}>{u.days === 0 ? 'today' : `${u.days}d`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Link>

          <div className="kcard">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-user-circle text-primary" aria-hidden /> From {overview.manager.name}</p>
            <p className="text-sm">{overview.manager.message ?? 'No note yet.'}</p>
            {overview.manager.at && <p className="mt-1 text-[11px] text-muted-foreground">{overview.manager.at}</p>}
          </div>

          <div className="kcard">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className={`ph-bold ${overview.review?.changesRequested ? 'ph-arrow-counter-clockwise text-amber-500' : 'ph-seal-check text-emerald-500'}`} aria-hidden /> Latest review</p>
            {overview.review ? (
              <>
                <p className="text-sm">{overview.review.note}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{overview.review.taskCode} · {overview.review.at}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No review feedback yet.</p>}
          </div>

          {overview.customers.length > 0 && (
            <div className="kcard">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-users-three text-primary" aria-hidden /> Customers you’re caring for</p>
              <ul className="space-y-2">
                {overview.customers.slice(0, 4).map((c) => (
                  <li key={c.name} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.active} task{c.active === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <SlideOver open={!!submitId} onClose={() => setSubmitId(null)} title={submitTask ? `Submit ${submitTask.code}` : 'Submit'}>
        {submitTask && <DeliverableSubmit history={deliverablesFor(submitTask.id)} onSubmit={confirmSubmit} />}
      </SlideOver>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {toast.text}
          <button onClick={() => undo(toast.entryId)} className="font-semibold text-amber-400 hover:underline">Undo</button>
        </div>
      )}
    </section>
  );
}

function now() { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function shortLabel(label: string) { return label === 'Submit for review' ? 'Submit' : label; }
function verbPast(label: string) { return label === 'Start' ? 'started' : label === 'Resume' ? 'resumed' : 'submitted'; }
function copyLink(id: string, done: () => void) {
  navigator.clipboard?.writeText(`${window.location.origin}/staff/tasks/${id}`).then(done, done);
}

function PriorityDot({ priority }: { priority: Priority }) {
  const c = priority === 'high' ? 'bg-destructive' : priority === 'med' ? 'bg-amber-500' : 'bg-muted-foreground';
  const label = `${priority === 'high' ? 'High' : priority === 'med' ? 'Medium' : 'Low'} priority`;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${c}`} title={label} aria-label={label} />;
}

function StatTile({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: 'bad' | 'warn' | 'good' | 'primary' | 'muted' }) {
  const color = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : tone === 'muted' ? 'text-muted-foreground' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${color}`} aria-hidden />
      </div>
      <p className="display mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
