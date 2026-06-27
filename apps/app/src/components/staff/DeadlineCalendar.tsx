'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { monthGrid, monthLabel, WEEKDAYS } from '@/lib/calendar';
import { daysToDue, slaChip, PRIORITY_RANK } from '@/lib/staff';
import { serviceMeta, careRankOf } from '@/data/staffMock';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { CareTags } from '@/components/staff/CareTags';
import type { OrderStatus, Priority, WorkHours } from '@/data/staffMock';

export interface CalTask { id: string; code: string; service: string; deadline: string; status: OrderStatus; priority: Priority; customer: string }

// A task is "done" once it's left the staffer's hands — shown muted with a tick.
const DONE = new Set<OrderStatus>(['approved', 'delivered', 'completed']);
// Weekday index Mon=0 … Sun=6 to line up with the WorkHours schedule.
const weekdayMon = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
function serviceCounts(items: CalTask[]): [string, number][] {
  const m = new Map<string, number>();
  for (const t of items) m.set(t.service, (m.get(t.service) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const TONE: Record<string, string> = {
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'bg-primary/10 text-primary',
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const longDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const isWeekend = (date: string) => { const d = new Date(`${date}T00:00:00Z`).getUTCDay(); return d === 0 || d === 6; };

export function DeadlineCalendar({ tasks, initialMonth, today, offDays, hours }: { tasks: CalTask[]; initialMonth: string; today: string; offDays?: Set<string>; hours?: WorkHours[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [panelDate, setPanelDate] = useState<string | null>(null);

  // Group tasks by their deadline date for O(1) cell lookup.
  const byDate = useMemo(() => {
    const map = new Map<string, CalTask[]>();
    for (const t of tasks) {
      const list = map.get(t.deadline) ?? [];
      list.push(t);
      map.set(t.deadline, list);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => monthGrid(month, today), [month, today]);
  const monthTaskCount = tasks.filter((t) => t.deadline.startsWith(month)).length;
  // Order the day's tasks by who needs care first: client rank, then task priority.
  const panelTasks = (panelDate ? (byDate.get(panelDate) ?? []) : [])
    .slice()
    .sort((a, b) => careRankOf(b.customer) - careRankOf(a.customer) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const open = (id: string) => { setPanelDate(null); router.push(`/staff/tasks/${id}`); };

  return (
    <div className="kcard">
      <div className="mb-3 flex items-center justify-between">
        <p className="display text-base font-bold">{monthLabel(month)}</p>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{monthTaskCount} deadline{monthTaskCount === 1 ? '' : 's'}</span>
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-caret-left" aria-hidden /></button>
          <button onClick={() => setMonth(initialMonth)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">Today</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-caret-right" aria-hidden /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{w}</div>
        ))}
        {cells.map((c) => {
          const items = byDate.get(c.date) ?? [];
          const isOff = offDays?.has(c.date) ?? false;
          const conflict = isOff && items.length > 0;
          const clickable = items.length > 0;
          const Tag = clickable ? 'button' : 'div';
          const wh = hours?.find((h) => h.day === weekdayMon(c.date));
          const onLeave = isOff;
          const dayOff = !onLeave && wh ? !wh.on : false;
          const working = !onLeave && wh ? wh.on : false;
          const counts = serviceCounts(items);
          return (
            <Tag
              key={c.date}
              {...(clickable ? { onClick: () => setPanelDate(c.date), 'aria-label': `${items.length} task${items.length === 1 ? '' : 's'} on ${longDate(c.date)}` } : {})}
              title={isOff ? 'Time off' : undefined}
              className={`flex min-h-[104px] w-full flex-col rounded-lg border p-1.5 text-left transition ${
                c.inMonth ? (isWeekend(c.date) ? 'border-border bg-muted/20' : 'border-border bg-background') : 'border-transparent bg-muted/30'
              } ${isOff && c.inMonth ? 'bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,transparent_6px_12px)]' : ''} ${c.isToday ? 'ring-2 ring-primary/50' : ''} ${conflict ? 'ring-2 ring-amber-500/60' : ''} ${clickable ? 'cursor-pointer hover:border-primary/60' : ''}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-semibold ${c.isToday ? 'text-primary' : c.inMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>{c.day}</span>
                <span className="flex items-center gap-1">
                  {conflict && <i className="ph-bold ph-warning text-[11px] text-amber-500" title="Deadline on your day off" />}
                  {items.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold leading-4 text-primary" title={`${items.length} deadline${items.length === 1 ? '' : 's'}`}>{items.length}</span>}
                </span>
              </span>

              {/* service breakdown — how many of each service (desktop, busy days) */}
              {c.inMonth && items.length >= 2 && (
                <div className="mt-1 hidden flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:flex">
                  {counts.map(([svc, n]) => { const m = serviceMeta(svc); return (
                    <span key={svc} title={`${n} × ${svc}`} className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: m.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{n}
                    </span>
                  ); })}
                </div>
              )}

              {/* desktop: labelled chips */}
              <div className="mt-1 hidden space-y-1 sm:block">
                {items.slice(0, 2).map((t) => {
                  const sla = slaChip(daysToDue(t.deadline, today));
                  const m = serviceMeta(t.service);
                  const done = DONE.has(t.status);
                  return (
                    <span key={t.id} title={`${t.code} · ${t.service}${done ? ' · done' : ''}`} className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold ${done ? 'bg-muted text-muted-foreground line-through' : TONE[sla?.tone ?? 'neutral']}`}>
                      {done ? <i className="ph-bold ph-check shrink-0 text-emerald-500" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />}
                      <span className="truncate">{t.code}</span>
                    </span>
                  );
                })}
                {items.length > 2 && <span className="block px-1.5 text-[10px] font-semibold text-primary">+{items.length - 2} more</span>}
              </div>
              {/* mobile: service-coloured dots (tap the day to see details) */}
              <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {items.slice(0, 5).map((t) => <span key={t.id} className="h-1.5 w-1.5 rounded-full" style={{ background: serviceMeta(t.service).color }} aria-hidden />)}
                {items.length > 5 && <span className="text-[9px] font-semibold text-muted-foreground">+{items.length - 5}</span>}
              </div>

              {/* availability footer — working hours / day off / leave */}
              {c.inMonth && (onLeave || dayOff || working) && (
                <p className={`mt-auto hidden items-center gap-1 truncate pt-1 text-[9px] font-medium sm:flex ${onLeave ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {onLeave ? <><i className="ph-bold ph-airplane-takeoff" />On leave</>
                    : dayOff ? <><i className="ph-bold ph-moon" />Day off</>
                    : <><i className="ph-bold ph-clock" />{wh!.start}–{wh!.end}</>}
                </p>
              )}
            </Tag>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-destructive/40" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> Due soon</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/30" /> Upcoming</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-check text-emerald-500" /> Done</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-clock" /> Working hours</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-moon" /> Day off</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-airplane-takeoff" /> On leave</span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground"><i className="ph-bold ph-info mr-1" />Tasks sit on their <b className="font-semibold text-foreground">deadline</b> (due date). The badge counts deadlines that day; coloured dots break them down by service. Click a day to see every task.</p>

      <SlideOver open={panelDate !== null} onClose={() => setPanelDate(null)} title={panelDate ? longDate(panelDate) : ''}>
        <p className="mb-1 text-sm text-muted-foreground">{panelTasks.length} task{panelTasks.length === 1 ? '' : 's'} due {offDays?.has(panelDate ?? '') && <span className="font-semibold text-amber-600 dark:text-amber-400">· on your day off</span>}</p>
        {panelTasks.length > 1 && <p className="mb-3 text-[11px] text-muted-foreground"><i className="ph-bold ph-sort-ascending" /> Sorted by client priority — highest-rank / most particular first.</p>}
        <ul className="space-y-2">
          {panelTasks.map((t) => { const m = serviceMeta(t.service); const sla = slaChip(daysToDue(t.deadline, today)); const top = careRankOf(t.customer) === 2; return (
            <li key={t.id}>
              <button onClick={() => open(t.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:bg-muted/40 ${top ? 'border-l-[3px] border-l-amber-500 border-border' : 'border-border'}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-bold ${m.icon}`} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{t.code}</span>{t.service}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5"><span className="truncate text-xs text-muted-foreground">{t.customer}</span><CareTags company={t.customer} /></span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="flex items-center gap-1"><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></span>
                  {sla && <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONE[sla.tone]}`}>{sla.label}</span>}
                </span>
                <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground" />
              </button>
            </li>
          ); })}
        </ul>
      </SlideOver>
    </div>
  );
}
