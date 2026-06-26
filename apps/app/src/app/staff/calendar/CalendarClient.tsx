'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeadlineCalendar } from '@/components/staff/DeadlineCalendar';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { AvailabilityPanel } from './AvailabilityPanel';
import { CareTags } from '@/components/staff/CareTags';
import { serviceMeta, offDaysSet, MY_AVAILABILITY, careRankOf } from '@/data/staffMock';
import { daysToDue, slaChip } from '@/lib/staff';
import type { OrderStatus, Priority } from '@/data/staffMock';

export interface CalTask {
  id: string; code: string; service: string; deadline: string;
  status: OrderStatus; priority: Priority; customer: string;
}
type View = 'month' | 'agenda' | 'availability';

const VIEW_META: Record<View, { icon: string; label: string }> = {
  month: { icon: 'ph-calendar-blank', label: 'Month' },
  agenda: { icon: 'ph-list-bullets', label: 'Agenda' },
  availability: { icon: 'ph-user-circle-gear', label: 'Availability' },
};

const TONE: Record<string, string> = {
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'bg-primary/10 text-primary',
};

// Chronological buckets relative to today.
const BUCKETS: { key: string; label: string; test: (d: number) => boolean }[] = [
  { key: 'overdue', label: 'Overdue', test: (d) => d < 0 },
  { key: 'today', label: 'Today', test: (d) => d === 0 },
  { key: 'tomorrow', label: 'Tomorrow', test: (d) => d === 1 },
  { key: 'week', label: 'This week', test: (d) => d >= 2 && d <= 7 },
  { key: 'later', label: 'Later', test: (d) => d > 7 },
];

export function CalendarClient({ tasks, initialMonth, today }: { tasks: CalTask[]; initialMonth: string; today: string }) {
  const [view, setView] = useState<View>('month');
  const [service, setService] = useState<string>('');
  const [avail, setAvail] = useState(MY_AVAILABILITY);
  const offDays = useMemo(() => offDaysSet(avail.timeOff), [avail.timeOff]);

  // view is URL state — shareable / survives refresh
  useEffect(() => { const v = new URLSearchParams(window.location.search).get('view'); if (v === 'agenda' || v === 'month' || v === 'availability') setView(v); }, []);
  useEffect(() => { const url = new URL(window.location.href); url.searchParams.set('view', view); window.history.replaceState(null, '', `${url.pathname}${url.search}`); }, [view]);

  const services = useMemo(() => [...new Set(tasks.map((t) => t.service))].sort(), [tasks]);
  const shown = service ? tasks.filter((t) => t.service === service) : tasks;
  const showFilters = view !== 'availability';

  const kpis = useMemo(() => {
    const d = (t: CalTask) => daysToDue(t.deadline, today) ?? 0;
    return {
      overdue: tasks.filter((t) => d(t) < 0).length,
      today: tasks.filter((t) => d(t) === 0).length,
      week: tasks.filter((t) => { const x = d(t); return x >= 0 && x <= 7; }).length,
      later: tasks.filter((t) => d(t) > 7).length,
    };
  }, [tasks, today]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon="ph-warning-octagon" label="Overdue" value={kpis.overdue} tone={kpis.overdue ? 'bad' : undefined} />
        <Kpi icon="ph-calendar-check" label="Due today" value={kpis.today} tone={kpis.today ? 'warn' : undefined} />
        <Kpi icon="ph-calendar-dots" label="Next 7 days" value={kpis.week} />
        <Kpi icon="ph-clock-afternoon" label="Later" value={kpis.later} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(['month', 'agenda', 'availability'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 text-sm font-semibold transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <i className={`ph-bold ${VIEW_META[v].icon} mr-1`} />{VIEW_META[v].label}
            </button>
          ))}
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setService('')} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${!service ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>All</button>
            {services.map((s) => { const m = serviceMeta(s); const on = service === s; return (
              <button key={s} onClick={() => setService(on ? '' : s)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition" style={on ? { background: m.color, color: '#fff' } : { background: `${m.color}1a`, color: m.color }}>
                <i className={`ph-bold ${m.icon}`} />{s}
              </button>
            ); })}
          </div>
        )}
        {showFilters && <span className="ml-auto text-xs text-muted-foreground">{shown.length} deadline{shown.length === 1 ? '' : 's'}</span>}
      </div>

      {view === 'month' && <DeadlineCalendar tasks={shown} initialMonth={initialMonth} today={today} offDays={offDays} />}
      {view === 'agenda' && <AgendaList tasks={shown} today={today} />}
      {view === 'availability' && <AvailabilityPanel value={avail} onSave={setAvail} today={today} />}
    </div>
  );
}

function AgendaList({ tasks, today }: { tasks: CalTask[]; today: string }) {
  const router = useRouter();
  const sorted = [...tasks].sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  // Within a day-bucket, surface the highest-care clients first.
  const groups = BUCKETS.map((bk) => ({
    ...bk,
    items: sorted.filter((t) => bk.test(daysToDue(t.deadline, today) ?? 0)).sort((a, b) => careRankOf(b.customer) - careRankOf(a.customer)),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return <div className="kcard text-center text-sm text-muted-foreground">No deadlines match this filter.</div>;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="kcard">
          <p className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${g.key === 'overdue' ? 'text-destructive' : g.key === 'today' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {g.label} <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{g.items.length}</span>
          </p>
          <ul className="space-y-1.5">
            {g.items.map((t) => { const m = serviceMeta(t.service); const sla = slaChip(daysToDue(t.deadline, today)); return (
              <li key={t.id}>
                <button onClick={() => router.push(`/staff/tasks/${t.id}`)} className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition hover:bg-muted/40">
                  <span className="w-12 shrink-0 text-center">
                    <span className="block text-[10px] uppercase text-muted-foreground">{new Date(`${t.deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
                    <span className="block text-base font-bold leading-none">{t.deadline.slice(8)}</span>
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-bold ${m.icon}`} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{t.code}</span>{t.service}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5"><span className="truncate text-xs text-muted-foreground">{t.customer}</span><CareTags company={t.customer} /></span>
                  </span>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                  {sla && <span className={`hidden shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline ${TONE[sla.tone]}`}>{sla.label}</span>}
                  <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground" />
                </button>
              </li>
            ); })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: 'bad' | 'warn' }) {
  const col = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="kcard !p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${col}`} />
      </div>
      <p className="display mt-1 text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}
