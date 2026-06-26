'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { monthGrid, monthLabel, WEEKDAYS } from '@/lib/calendar';
import { daysToDue, slaChip } from '@/lib/staff';
import { serviceMeta } from '@/data/staffMock';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import type { OrderStatus, Priority } from '@/data/staffMock';

export interface CalTask { id: string; code: string; service: string; deadline: string; status: OrderStatus; priority: Priority; customer: string }

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

export function DeadlineCalendar({ tasks, initialMonth, today, offDays }: { tasks: CalTask[]; initialMonth: string; today: string; offDays?: Set<string> }) {
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
  const panelTasks = panelDate ? (byDate.get(panelDate) ?? []) : [];
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
          return (
            <Tag
              key={c.date}
              {...(clickable ? { onClick: () => setPanelDate(c.date), 'aria-label': `${items.length} task${items.length === 1 ? '' : 's'} on ${longDate(c.date)}` } : {})}
              title={isOff ? 'Time off' : undefined}
              className={`min-h-[78px] w-full rounded-lg border p-1.5 text-left transition ${
                c.inMonth ? 'border-border bg-background' : 'border-transparent bg-muted/30'
              } ${isOff && c.inMonth ? 'bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,transparent_6px_12px)]' : ''} ${c.isToday ? 'ring-2 ring-primary/50' : ''} ${conflict ? 'ring-2 ring-amber-500/60' : ''} ${clickable ? 'cursor-pointer hover:border-primary/60' : ''}`}
            >
              <span className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold ${c.isToday ? 'text-primary' : c.inMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                  {c.day}
                </span>
                {isOff && c.inMonth && <i className={`ph-bold ${conflict ? 'ph-warning text-amber-500' : 'ph-moon text-muted-foreground'} text-[11px]`} title={conflict ? 'Deadline on your day off' : 'Time off'} />}
              </span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 2).map((t) => {
                  const sla = slaChip(daysToDue(t.deadline, today));
                  const m = serviceMeta(t.service);
                  return (
                    <span key={t.id} title={`${t.code} · ${t.service}`} className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold ${TONE[sla?.tone ?? 'neutral']}`}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
                      <span className="truncate">{t.code}</span>
                    </span>
                  );
                })}
                {items.length > 2 && <span className="block px-1.5 text-[10px] font-semibold text-primary">+{items.length - 2} more</span>}
              </div>
            </Tag>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-destructive/40" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> Due soon</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/30" /> Upcoming</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-moon" /> Time off</span>
        <span className="flex items-center gap-1"><i className="ph-bold ph-warning text-amber-500" /> Deadline on a day off</span>
        <span className="ml-auto">Click a day to see its tasks.</span>
      </div>

      <SlideOver open={panelDate !== null} onClose={() => setPanelDate(null)} title={panelDate ? longDate(panelDate) : ''}>
        <p className="mb-3 text-sm text-muted-foreground">{panelTasks.length} task{panelTasks.length === 1 ? '' : 's'} due {offDays?.has(panelDate ?? '') && <span className="font-semibold text-amber-600 dark:text-amber-400">· on your day off</span>}</p>
        <ul className="space-y-2">
          {panelTasks.map((t) => { const m = serviceMeta(t.service); const sla = slaChip(daysToDue(t.deadline, today)); return (
            <li key={t.id}>
              <button onClick={() => open(t.id)} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition hover:bg-muted/40">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-bold ${m.icon}`} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{t.code}</span>{t.service}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.customer}</span>
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
