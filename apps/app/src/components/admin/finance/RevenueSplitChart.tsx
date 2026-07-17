'use client';

import { money } from '@/data/adminMock';
import type { RevenueDay } from '@/data/adminRevenue.server';

/**
 * The daily money split, on SaaS accounting rules — the chart that replaces a mock "cashflow in vs out".
 * It keeps apart the two things that get added together by mistake:
 *
 *  · DEPOSITS   — cash the customer topped up that day. Ours to hold, NOT ours to book: it's a liability
 *                 until we do the work.
 *  · RECOGNIZED — revenue actually earned that day, booked when the order was DELIVERED (ASC 606).
 *
 * BOOKINGS (order value placed) is shown in the header for contrast: the gap between booked and recognized
 * is work we've been paid for but still owe.
 */
export function RevenueSplitChart({ days }: { days: RevenueDay[] }) {
  const sum = (k: keyof RevenueDay) => days.reduce((s, d) => s + (d[k] as number), 0);
  const deposits = sum('deposits');
  const bookings = sum('bookings');
  const recognized = sum('recognized');
  // Each series gets its OWN scale, drawn as its own row. Shared-scale would be honest but unreadable: one
  // $20k top-up day makes every $39 revenue bar ~1px. Separate rows keep both legible without pretending
  // the two are comparable magnitudes — the totals in the header carry the real proportion.
  const maxDep = Math.max(...days.map((d) => d.deposits), 1);
  const maxRec = Math.max(...days.map((d) => d.recognized), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <i className="ph-bold ph-chart-bar text-primary" aria-hidden /> Deposits vs revenue · daily
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last {days.length} days · <span className="font-semibold text-sky-600">{money(deposits)}</span> deposited ·{' '}
            <span className="font-semibold text-muted-foreground">{money(bookings)}</span> booked ·{' '}
            <span className="font-semibold text-emerald-600">{money(recognized)}</span> recognized
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky-500" /> Deposits <span className="text-muted-foreground">(cash in — a liability)</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Recognized <span className="text-muted-foreground">(earned on delivery)</span></span>
        </div>
      </div>

      <Series days={days} max={maxDep} pick={(d) => d.deposits} label="Deposits" color="bg-sky-500" peak={maxDep} />
      <Series days={days} max={maxRec} pick={(d) => d.recognized} label="Recognized" color="bg-emerald-500" peak={maxRec} />
      <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
        Deposits are <b className="text-foreground">not</b> revenue — the {money(deposits - recognized)} gap over this
        window is cash we hold against work still owed. Each row is scaled to its own peak, so the bar heights
        compare days <i>within</i> a row, not across them.
      </p>
    </div>
  );
}

/** One self-scaled row of daily bars. */
function Series({ days, max, pick, label, color, peak }: {
  days: RevenueDay[]; max: number; pick: (d: RevenueDay) => number; label: string; color: string; peak: number;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span className="font-semibold">{label} · daily</span>
        <span>peak {money(peak)}</span>
      </div>
      <div className="flex h-16 items-end gap-[3px]">
        {days.map((d) => {
          const v = pick(d);
          return (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              {/* a zero day still gets a hairline so the axis reads as a timeline, not a gap */}
              <span className={`w-full rounded-t-sm ${color} ${v ? 'opacity-70 group-hover:opacity-100' : 'opacity-20'}`}
                style={{ height: v ? `${Math.max((v / max) * 100, 3)}%` : '2px' }} />
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {d.date} · {money(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
