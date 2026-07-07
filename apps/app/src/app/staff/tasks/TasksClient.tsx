'use client';

import { useEffect, useState } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { SlideOver } from '@/components/shared/SlideOver';
import { TaskDetailPanel, type PanelTask } from '@/components/staff/TaskDetailPanel';
import { BOARD_COLUMNS, serviceMeta, type StaffTask, type ClientSummary } from '@/data/staffMock';
import { daysToDue, TODAY } from '@/lib/staff';

type View = 'board' | 'table';

const DEADLINE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fmtDeadline = (d: string | null): string => (d ? DEADLINE_FMT.format(new Date(d)) : '—');

// Map the board's StaffTask onto the shared detail-panel shape.
const toPanelTask = (t: StaffTask): PanelTask => ({
  id: t.id, code: t.code, service: t.service, pkg: t.pkg, customer: t.customer,
  status: t.status, priority: t.priority, deadline: t.deadline, start: t.created, brief: t.brief,
});

// Real client dossier for the panel, built from the staffer's own visible tasks (they can't read the
// customers CRM table) — the order count + service mix for that client, money-blind.
const panelClient = (customer: string, board: StaffTask[]): ClientSummary => {
  const mine = board.filter((t) => t.customer === customer);
  const counts = new Map<string, number>();
  mine.forEach((t) => counts.set(t.service, (counts.get(t.service) ?? 0) + 1));
  const byService = [...counts.entries()].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count);
  return { company: customer, tier: null, since: null, tags: [], orders: mine.length, byService, topService: byService[0]?.service ?? null, staff: [], note: null };
};

export function TasksClient({ board }: { board: StaffTask[] }) {
  const [view, setView] = useState<View>('board');
  const [sel, setSel] = useState<StaffTask | null>(null);

  // View choice lives in the URL so it survives reloads and is shareable.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'table' || v === 'board') setView(v);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === 'board') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [view]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === 'board' ? <BoardView board={board} onOpen={setSel} /> : <TableView board={board} onOpen={setSel} />}

      <SlideOver open={!!sel} onClose={() => setSel(null)} title={sel ? sel.code : ''}>
        {sel && <TaskDetailPanel task={toPanelTask(sel)} today={TODAY} client={panelClient(sel.customer, board)} />}
      </SlideOver>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const items: { key: View; label: string; icon: string }[] = [
    { key: 'board', label: 'Board', icon: 'ph-kanban' },
    { key: 'table', label: 'Table', icon: 'ph-rows' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Task view">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={view === it.key}
          onClick={() => onChange(it.key)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-semibold transition ${
            view === it.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className={`ph-bold ${it.icon}`} aria-hidden /> {it.label}
        </button>
      ))}
    </div>
  );
}

function BoardView({ board, onOpen }: { board: StaffTask[]; onOpen: (t: StaffTask) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {BOARD_COLUMNS.map((col) => {
        const tasks = board.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{col.label}</p>
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">{tasks.length}</span>
            </div>
            {tasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Nothing here</p>
            ) : (
              tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: StaffTask; onOpen: (t: StaffTask) => void }) {
  const m = serviceMeta(task.service);
  const project = task.note?.replace(/^Project:\s*/i, '') ?? null;
  return (
    <button type="button" onClick={() => onOpen(task)} className="kcard kcard-anim block w-full text-left transition hover:border-primary/50">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ background: `${m.color}1f`, color: m.color }}><i className={`ph-bold ${m.icon} text-[11px]`} aria-hidden /></span>
          <span className="truncate font-semibold">{task.code}</span>
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{task.service} · {task.pkg}</p>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5"><i className="ph-bold ph-buildings shrink-0 text-muted-foreground/70" aria-hidden /><span className="truncate">{task.customer}</span></p>
        {task.site && <p className="flex items-center gap-1.5"><i className="ph-bold ph-globe-simple shrink-0 text-muted-foreground/70" aria-hidden /><span className="truncate">{task.site.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span></p>}
        {project && <p className="flex items-center gap-1.5"><i className="ph-bold ph-folder shrink-0 text-muted-foreground/70" aria-hidden /><span className="truncate">{project}</span></p>}
        {task.keywords.length > 0 && <p className="flex items-center gap-1.5"><i className="ph-bold ph-tag shrink-0 text-muted-foreground/70" aria-hidden /><span className="truncate">{task.keywords.slice(0, 3).join(', ')}{task.keywords.length > 3 ? ` +${task.keywords.length - 3}` : ''}</span></p>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <SlaChip daysToDue={daysToDue(task.deadline)} />
        {task.deadline && <span className="text-[11px] tabular-nums text-muted-foreground">{fmtDeadline(task.deadline)}</span>}
      </div>
    </button>
  );
}

function TableView({ board, onOpen }: { board: StaffTask[]; onOpen: (t: StaffTask) => void }) {
  // Group order follows the board stages so the table reads in the same workflow sequence.
  const order = new Map(BOARD_COLUMNS.map((c, i) => [c.status, i]));
  const rows = [...board].sort((a, b) => (order.get(a.status) ?? 99) - (order.get(b.status) ?? 99));

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-semibold">Task</th>
            <th className="px-3 py-2.5 font-semibold">Client</th>
            <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Skill</th>
            <th className="px-3 py-2.5 text-center font-semibold">Priority</th>
            <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Deadline</th>
            <th className="px-3 py-2.5 font-semibold">SLA</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="w-8 px-2 py-2.5" aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const m = serviceMeta(t.service);
            return (
              <tr
                key={t.id} onClick={() => onOpen(t)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(t); } }}
                className="group cursor-pointer border-b border-border/50 outline-none transition last:border-0 hover:bg-muted/40 focus-visible:bg-muted/60"
              >
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a`, color: m.color }}>
                      <i className={`ph-bold ${m.icon}`} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-tight">{t.service}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{t.code} · {t.pkg}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{t.customer}</td>
                <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">{t.skill ?? '—'}</td>
                <td className="px-3 py-2.5 text-center"><PriorityBadge priority={t.priority} /></td>
                <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{fmtDeadline(t.deadline)}</td>
                <td className="px-3 py-2.5"><SlaChip daysToDue={daysToDue(t.deadline)} /></td>
                <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                <td className="px-2 py-2.5 text-right text-muted-foreground transition group-hover:text-primary"><i className="ph-bold ph-arrow-right" aria-hidden /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
