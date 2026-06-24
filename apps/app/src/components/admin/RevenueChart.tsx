'use client';

import { useState } from 'react';
import { money, type RevenuePoint } from '@/data/adminMock';

const PERIODS = [7, 14, 30] as const;

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [period, setPeriod] = useState<number>(14);
  const [hover, setHover] = useState<number | null>(null);

  const series = data.slice(-period);
  const W = 760, H = 260, padL = 46, padR = 14, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;

  const maxRev = Math.max(...series.map((d) => d.revenue));
  const niceMax = Math.ceil(maxRev / 500) * 500 || 500;
  const maxOrd = Math.ceil(Math.max(...series.map((d) => d.orders)) / 5) * 5 || 5;

  const x = (i: number) => padL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const bw = Math.max(3, (iw / series.length) * 0.6);
  const yRev = (v: number) => padT + ih - (v / niceMax) * ih;
  const yOrd = (v: number) => padT + ih - (v / maxOrd) * ih;

  const ticks = 4;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => (i * niceMax) / ticks);
  const xEvery = Math.ceil(series.length / 7);
  const linePath = series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yOrd(d.orders).toFixed(1)}`).join(' ');
  const total = series.reduce((s, d) => s + d.revenue, 0);
  const h = hover != null ? series[hover] : null;
  const fmtK = (g: number) => (g >= 1000 ? `$${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `$${g}`);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" /> Revenue &amp; order volume</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Last {period} days · <span className="font-semibold text-foreground">{money(total)}</span> total</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Revenue</span>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><span className="h-0.5 w-3 rounded bg-amber-500" /> Orders</span>
          <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
            {PERIODS.map((p) => (
              <button key={p} type="button" onClick={() => { setPeriod(p); setHover(null); }}
                className={`rounded-md px-2 py-0.5 transition ${period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{p}d</button>
            ))}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue and order volume chart" onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yRev(g)} y2={yRev(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
            <text x={padL - 8} y={yRev(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
          </g>
        ))}
        {series.map((d, i) => (
          <rect key={`b${i}`} x={x(i) - bw / 2} y={yRev(d.revenue)} width={bw} height={padT + ih - yRev(d.revenue)} rx={2}
            fill="hsl(var(--primary))" fillOpacity={hover == null || hover === i ? 0.9 : 0.3}
            onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
        ))}
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {series.map((d, i) => (<circle key={`c${i}`} cx={x(i)} cy={yOrd(d.orders)} r={hover === i ? 3.5 : 1.8} fill="#f59e0b" />))}
        {series.map((d, i) => (i % xEvery === 0 || i === series.length - 1
          ? <text key={`x${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{d.date}</text>
          : null))}
        {h && <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + ih} stroke="hsl(var(--primary))" strokeOpacity={0.35} />}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-5 text-xs">
        {h ? (
          <>
            <span className="font-semibold">{h.date}</span>
            <span className="text-muted-foreground">Revenue <b className="text-foreground">{money(h.revenue)}</b></span>
            <span className="text-muted-foreground">Orders <b className="text-foreground">{h.orders}</b></span>
          </>
        ) : (
          <span className="text-muted-foreground">Hover a bar for daily detail</span>
        )}
      </div>
    </div>
  );
}
