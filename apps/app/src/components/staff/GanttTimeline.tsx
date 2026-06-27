'use client';

// Timeline / Gantt view for the staff calendar. Each task is a horizontal bar on a day-scaled axis
// (start = task created date, end = deadline), with a frozen task list on the left, month + day
// header bands, weekend shading, the staffer's days-off, and a "today" line. Bars are tinted by
// service and link to the task. Pure presentational — takes the same CalTask the calendar uses.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { serviceMeta } from '@/data/staffMock';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlideOver } from '@/components/shared/SlideOver';
import { CareTags } from '@/components/staff/CareTags';
import { TaskDetailPanel } from '@/components/staff/TaskDetailPanel';
import { daysToDue, slaChip } from '@/lib/staff';
import type { OrderStatus, Priority } from '@/data/staffMock';

interface BriefField { label: string; value: string }
interface GanttTask {
  id: string; code: string; service: string; deadline: string;
  status: OrderStatus; priority: Priority; customer: string; start?: string; pkg?: string;
  brief?: BriefField[];
}

const SLA_TONE: Record<string, string> = {
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  neutral: 'bg-primary/10 text-primary',
};

const DAY_W = 30;     // px per day
const LEFT_W = 296;   // frozen task column
const ROW_H = 70;
const HEAD_H = 46;
const DONE = new Set<OrderStatus>(['approved', 'delivered', 'completed']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_COLOR: Record<string, string> = {
  new: '#94a3b8', confirmed: '#0ea5e9', assigned: '#0ea5e9', in_progress: 'hsl(var(--primary))',
  internal_review: '#a855f7', changes_requested: '#f59e0b', delivered: '#10b981', approved: '#10b981',
  completed: '#64748b', canceled: '#94a3b8',
};

const MS = 86400000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addD = (iso: string, n: number) => isoOf(toMs(iso) + n * MS);
const diffD = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / MS);
const weekdayMon = (iso: string) => (new Date(toMs(iso)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
const mondayOf = (iso: string) => addD(iso, -weekdayMon(iso));
const fmtShort = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function GanttTimeline({ tasks, today, offDays }: { tasks: GanttTask[]; today: string; offDays?: Set<string> }) {
  const [sel, setSel] = useState<GanttTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  // Click-drag anywhere on the grid (not on a bar/cell button) to pan the timeline left/right.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return; // preserve clicks on bars/cells
    const el = scrollRef.current; if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current; if (!drag.current || !el) return;
    el.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const endDrag = () => { drag.current = null; };

  const model = useMemo(() => {
    const startOf = (t: GanttTask) => t.start && t.start <= t.deadline ? t.start : t.deadline;
    const lo = tasks.map(startOf).concat(today).reduce((a, b) => (a < b ? a : b));
    const hi = tasks.map((t) => t.deadline).concat(today).reduce((a, b) => (a > b ? a : b));
    const rangeStart = mondayOf(addD(lo, -2));
    const rangeEnd = addD(hi, 3);
    const totalDays = diffD(rangeStart, rangeEnd) + 1;

    // Header month bands (consecutive same year-month).
    const bands: { key: string; label: string; left: number; width: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const iso = addD(rangeStart, i);
      const key = iso.slice(0, 7);
      const last = bands[bands.length - 1];
      if (last && last.key === key) last.width += DAY_W;
      else bands.push({ key, label: `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`, left: i * DAY_W, width: DAY_W });
    }
    const days = Array.from({ length: totalDays }, (_, i) => addD(rangeStart, i));
    const rows = [...tasks].sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : a.deadline.localeCompare(b.deadline)));
    const todayIdx = diffD(rangeStart, today);
    return { rangeStart, totalDays, width: totalDays * DAY_W, bands, days, rows, todayIdx };
  }, [tasks, today]);

  const { rangeStart, width, bands, days, rows, todayIdx } = model;
  // Two layered backgrounds: weekend shading (7-day period, rangeStart is a Monday → days 5–6) + 1px grid.
  const trackBg = `repeating-linear-gradient(to right, transparent 0, transparent ${5 * DAY_W}px, hsl(var(--muted)/0.5) ${5 * DAY_W}px, hsl(var(--muted)/0.5) ${7 * DAY_W}px), repeating-linear-gradient(to right, transparent 0, transparent ${DAY_W - 1}px, hsl(var(--border)/0.6) ${DAY_W - 1}px, hsl(var(--border)/0.6) ${DAY_W}px)`;
  const showToday = todayIdx >= 0 && todayIdx < model.totalDays;

  return (
    <>
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag} onPointerCancel={endDrag}
      className="scrollbar-thin cursor-grab select-none overflow-auto rounded-2xl border border-border bg-card active:cursor-grabbing"
      style={{ maxHeight: '82vh' }}
    >
      <div className="relative" style={{ width: LEFT_W + width }}>
        {/* ── header ── */}
        <div className="sticky top-0 z-20 flex bg-card" style={{ height: HEAD_H }}>
          <div className="sticky left-0 z-30 flex items-end border-b border-r border-border bg-card px-4 pb-1" style={{ width: LEFT_W }}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rows.length} task{rows.length === 1 ? '' : 's'}</span>
          </div>
          <div className="relative border-b border-border" style={{ width }}>
            {/* month bands */}
            <div className="relative" style={{ height: 22 }}>
              {bands.map((b) => (
                <div key={b.key} className="absolute top-0 flex h-full items-center border-l border-border px-2 text-[11px] font-semibold text-muted-foreground" style={{ left: b.left, width: b.width }}>{b.label}</div>
              ))}
            </div>
            {/* day ticks */}
            <div className="relative" style={{ height: HEAD_H - 22 }}>
              {days.map((d, i) => { const wknd = weekdayMon(d) >= 5; const isToday = d === today; const off = offDays?.has(d);
                return (
                  <div key={d} className={`absolute top-0 flex h-full flex-col items-center justify-center border-l text-[9px] leading-none ${isToday ? 'border-rose-400' : 'border-border/50'} ${wknd ? 'bg-muted/40' : ''}`} style={{ left: i * DAY_W, width: DAY_W }}>
                    <span className={`font-semibold ${isToday ? 'text-rose-500' : wknd ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>{d.slice(8)}</span>
                    {off && <span className="mt-0.5 h-1 w-1 rounded-full bg-amber-500" title="Day off" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── rows ── */}
        {rows.map((t) => {
          const meta = serviceMeta(t.service);
          const start = t.start && t.start <= t.deadline ? t.start : t.deadline;
          const offset = diffD(rangeStart, start);
          const span = Math.max(1, diffD(start, t.deadline) + 1);
          const done = DONE.has(t.status);
          const overdue = !done && t.deadline < today;
          const sla = done ? null : slaChip(daysToDue(t.deadline, today));
          const open = () => setSel(t);
          return (
            <div key={t.id} className="group/row flex" style={{ height: ROW_H }}>
              {/* frozen task info — click to open the detail panel */}
              <button
                onClick={open} type="button"
                className="sticky left-0 z-10 flex w-full flex-col justify-center gap-1.5 border-b border-r border-border bg-card px-4 py-2.5 text-left transition hover:bg-muted/40 group-hover/row:bg-muted/30"
                style={{ width: LEFT_W }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ background: `${meta.color}1f`, color: meta.color }}><i className={`ph-bold ${meta.icon} text-[11px]`} aria-hidden /></span>
                  <span className="truncate text-[13px] font-semibold">{t.customer}</span>
                  <span className="ml-auto shrink-0"><StatusBadge status={t.status} /></span>
                </span>
                <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                  <span className="font-mono text-[10px] text-foreground/70">{t.code}</span>
                  <span className="truncate">{t.service}{t.pkg ? ` · ${t.pkg}` : ''}</span>
                  <CareTags company={t.customer} />
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <PriorityBadge priority={t.priority} />
                  <span className="tabular-nums">{fmtShort(start)} → <span className={overdue ? 'font-semibold text-rose-500' : 'text-foreground/70'}>{fmtShort(t.deadline)}</span> · {span}d</span>
                  {sla && <span className={`ml-auto shrink-0 rounded px-1 py-0.5 font-semibold ${SLA_TONE[sla.tone]}`}>{sla.label}</span>}
                </span>
              </button>
              {/* timeline track */}
              <div className="relative border-b border-border/60" style={{ width, background: trackBg }}>
                {showToday && <div className="absolute top-0 z-0 w-px bg-rose-400/80" style={{ left: todayIdx * DAY_W + DAY_W / 2, height: ROW_H }} aria-hidden />}
                {(() => {
                  const barLeft = offset * DAY_W;
                  const barW = span * DAY_W;
                  const inside = barW >= 108;
                  const dot = <span className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/60" style={{ background: STATUS_COLOR[t.status] ?? '#94a3b8' }} aria-hidden />;
                  const label = <><span className="truncate">{t.code} · <span className="font-normal opacity-90">{t.customer}</span></span>{done && <i className="ph-bold ph-check shrink-0" aria-hidden />}</>;
                  return (
                    <button
                      type="button" onClick={open}
                      title={`${t.code} · ${t.service} · ${t.customer} — ${fmtShort(start)} → ${fmtShort(t.deadline)}`}
                      className="group absolute z-[1] flex items-center whitespace-nowrap text-[11px] font-semibold"
                      style={{ left: barLeft, top: (ROW_H - 24) / 2, height: 24 }}
                    >
                      <span
                        className="flex h-full items-center gap-1.5 overflow-hidden rounded-[7px] px-2 text-white shadow-sm ring-1 ring-black/10 transition group-hover:brightness-110"
                        style={{ width: barW, background: `linear-gradient(180deg, ${meta.color}, ${meta.color}cc)`, opacity: done ? 0.5 : 1 }}
                      >
                        {inside && <>{dot}{label}</>}
                      </span>
                      {!inside && <span className="ml-1.5 inline-flex items-center gap-1 text-foreground">{dot}{label}</span>}
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <SlideOver open={!!sel} onClose={() => setSel(null)} title={sel ? sel.code : ''}>
      {sel && <TaskDetailPanel task={sel} today={today} />}
    </SlideOver>
    </>
  );
}
