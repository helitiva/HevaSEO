'use client';

import { useMemo, useState } from 'react';
import { money } from '@/data/adminMock';
import type { AnalyticsPoint } from '@/data/analytics.server';

const PRESETS = [7, 14, 30, 90] as const;

/**
 * Bookings vs recognized revenue, daily. Two bars per day, on ONE shared scale — unlike the Finance
 * deposits-vs-revenue chart, both series are order value, so they're directly comparable.
 *
 * What used to be here: a single "Revenue" bar stacked by service — except the stack applied the
 * GLOBAL service mix to every single day, so each bar had an identical, invented composition. The real
 * per-service split is the Service mix panel below; this chart now shows the split that changes daily
 * and that the business actually turns on: what was sold vs what was earned.
 */
export function RevenueChart({ data }: { data: AnalyticsPoint[] }) {
  const [period, setPeriod] = useState<number | 'custom'>(30);
  const [hover, setHover] = useState<number | null>(null);
  const minIso = data[0].iso;
  const maxIso = data[data.length - 1].iso;
  const [from, setFrom] = useState<string>(data[Math.max(0, data.length - 30)].iso);
  const [to, setTo] = useState<string>(maxIso);

  const series = useMemo(() => {
    if (period === 'custom') return data.filter((d) => d.iso >= from && d.iso <= to);
    return data.slice(-period);
  }, [data, period, from, to]);

  const W = 760, H = 264, padL = 46, padR = 14, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const safe = series.length ? series : data.slice(-7);
  // round the axis to a "nice" step scaled to the data — a fixed $500 step flattened every real bar to
  // nothing once the live figures turned out to be tens of dollars, not thousands
  const peak = Math.max(...safe.map((d) => Math.max(d.booked, d.recognized)), 1);
  const step = peak > 2000 ? 500 : peak > 400 ? 100 : peak > 40 ? 20 : 5;
  const niceMax = Math.ceil(peak / step) * step || step;
  const maxOrd = Math.ceil(Math.max(...safe.map((d) => d.orders), 1) / 5) * 5 || 5;
  const x = (i: number) => padL + (safe.length === 1 ? iw / 2 : (i / (safe.length - 1)) * iw);
  const bw = Math.max(1.5, (iw / safe.length) * 0.28); // two bars per day, side by side
  const yRev = (v: number) => padT + ih - (v / niceMax) * ih;
  const yOrd = (v: number) => padT + ih - (v / maxOrd) * ih;
  const grid = Array.from({ length: 5 }, (_, i) => (i * niceMax) / 4);
  const xEvery = Math.max(1, Math.ceil(safe.length / 7));
  const linePath = safe.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yOrd(d.orders).toFixed(1)}`).join(' ');
  const totalBooked = safe.reduce((s, d) => s + d.booked, 0);
  const totalRec = safe.reduce((s, d) => s + d.recognized, 0);
  const fmtK = (g: number) => (g >= 1000 ? `$${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `$${Math.round(g)}`);
  const h = hover != null ? safe[hover] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" aria-hidden /> Bookings vs revenue &amp; order volume</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{period === 'custom' ? `${from} → ${to}` : `Last ${period} days`} · <span className="font-semibold text-indigo-500">{money(totalBooked)}</span> booked · <span className="font-semibold text-emerald-600">{money(totalRec)}</span> recognized</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => { setPeriod(p); setHover(null); }}
                className={`rounded-md px-2 py-0.5 transition ${period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{p}d</button>
            ))}
          </div>
          <div className={`inline-flex items-center gap-1 rounded-lg border p-1 text-xs ${period === 'custom' ? 'border-primary' : 'border-border'}`}>
            <input type="date" value={from} min={minIso} max={to} onChange={(e) => { setFrom(e.target.value); setPeriod('custom'); setHover(null); }} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
            <span className="text-muted-foreground">→</span>
            <input type="date" value={to} min={from} max={maxIso} onChange={(e) => { setTo(e.target.value); setPeriod('custom'); setHover(null); }} className="w-[7.5rem] rounded bg-transparent px-1 outline-none" />
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bookings versus recognized revenue and order volume" onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yRev(g)} y2={yRev(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
            <text x={padL - 8} y={yRev(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
          </g>
        ))}
        {safe.map((d, i) => {
          const dim = hover != null && hover !== i;
          const bar = (v: number, dx: number, fill: string) => (
            <rect x={x(i) + dx} y={yRev(v)} width={bw} height={Math.max(0, padT + ih - yRev(v))} fill={fill} fillOpacity={dim ? 0.3 : 0.92} rx={2} />
          );
          return (
            <g key={`bar${i}`} onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }}>
              {/* a wide invisible hit area — the bars themselves are a few px wide on a 90-day window */}
              <rect x={x(i) - iw / safe.length / 2} y={padT} width={iw / safe.length} height={ih} fill="transparent" />
              {d.booked > 0 && bar(d.booked, -bw - 1, '#6366f1')}
              {d.recognized > 0 && bar(d.recognized, 1, '#22c55e')}
            </g>
          );
        })}
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {safe.map((d, i) => (<circle key={`c${i}`} cx={x(i)} cy={yOrd(d.orders)} r={hover === i ? 3.5 : 1.6} fill="#f59e0b" />))}
        {safe.map((d, i) => (i % xEvery === 0 || i === safe.length - 1
          ? <text key={`x${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{d.date}</text>
          : null))}
        {h && <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + ih} stroke="hsl(var(--foreground))" strokeOpacity={0.25} />}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="legend-dot" style={{ background: '#6366f1' }} />Booked <span className="opacity-70">(order placed)</span></span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="legend-dot" style={{ background: '#22c55e' }} />Recognized <span className="opacity-70">(delivered — earned)</span></span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-0.5 w-3 rounded bg-amber-500" />Orders</span>
      </div>
      <div className="mt-1 text-center text-xs">
        {h
          ? <span><span className="font-semibold">{h.date}</span> · <span className="text-muted-foreground">Booked</span> <b>{money(h.booked)}</b> · <span className="text-muted-foreground">Recognized</span> <b>{money(h.recognized)}</b> · <span className="text-muted-foreground">Orders</span> <b>{h.orders}</b></span>
          : <span className="text-muted-foreground">Hover a day for detail · the gap between booked and recognized is work sold but not yet delivered</span>}
      </div>
    </div>
  );
}
