'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { monthGrid, monthLabel, WEEKDAYS } from '@/lib/calendar';
import { daysToDue, slaChip } from '@/lib/staff';
import { serviceMeta } from '@/data/staffMock';

export interface CalTask { id: string; code: string; service: string; deadline: string }

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

export function DeadlineCalendar({ tasks, initialMonth, today }: { tasks: CalTask[]; initialMonth: string; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);

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
          return (
            <div
              key={c.date}
              className={`min-h-[78px] rounded-lg border p-1.5 text-left transition ${
                c.inMonth ? 'border-border bg-background' : 'border-transparent bg-muted/30'
              } ${c.isToday ? 'ring-2 ring-primary/50' : ''}`}
            >
              <span className={`text-[11px] font-semibold ${c.isToday ? 'text-primary' : c.inMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {c.day}
              </span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 2).map((t) => {
                  const sla = slaChip(daysToDue(t.deadline, today));
                  const m = serviceMeta(t.service);
                  return (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/staff/tasks/${t.id}`)}
                      title={`${t.code} · ${t.service}`}
                      className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold transition hover:opacity-80 ${TONE[sla?.tone ?? 'neutral']}`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
                      <span className="truncate">{t.code}</span>
                    </button>
                  );
                })}
                {items.length > 2 && <span className="block px-1.5 text-[10px] font-medium text-muted-foreground">+{items.length - 2} more</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-destructive/40" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> Due soon</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/30" /> Upcoming</span>
        <span className="ml-auto">Click a chip to open the task.</span>
      </div>
    </div>
  );
}
