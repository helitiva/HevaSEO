'use client';

import { useMemo, useState } from 'react';
import { money, type CashflowPoint } from '@/data/adminMock';

const PRESETS = [7, 14, 30] as const;

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const [period, setPeriod] = useState<number>(30);
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => data.slice(-period), [data, period]);
  const safe = series.length ? series : data.slice(-7);

  const totalIn = safe.reduce((s, d) => s + d.in, 0);
  const totalOut = safe.reduce((s, d) => s + d.out, 0);
  const net = totalIn - totalOut;

  const W = 760, H = 240, padL = 46, padR = 14, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const niceMax = Math.ceil(Math.max(...safe.map((d) => Math.max(d.in, d.out)), 1) / 500) * 500 || 500;
  const x = (i: number) => padL + (safe.length === 1 ? iw / 2 : (i / (safe.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / niceMax) * ih;
  const grid = Array.from({ length: 5 }, (_, i) => (i * niceMax) / 4);
  const xEvery = Math.max(1, Math.ceil(safe.length / 7));
  const fmtK = (g: number) => (g >= 1000 ? `$${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `$${g}`);

  const area = (key: 'in' | 'out') => {
    const top = safe.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
    return `${top} L${x(safe.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  };
  const line = (key: 'in' | 'out') => safe.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const h = hover != null ? safe[hover] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-wave-sine text-primary" /> Cashflow · in vs out</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last {period} days · <span className="font-semibold text-emerald-600">+{money(totalIn)}</span> in · <span className="font-semibold text-rose-500">−{money(totalOut)}</span> out · net <span className={`font-semibold ${net >= 0 ? 'text-foreground' : 'text-rose-500'}`}>{money(net)}</span>
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => { setPeriod(p); setHover(null); }}
              className={`rounded-md px-2 py-0.5 transition ${period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{p}d</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cashflow in versus out" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="cf-in" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cf-out" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.22} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
            <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
          </g>
        ))}
        <path d={area('in')} fill="url(#cf-in)" />
        <path d={area('out')} fill="url(#cf-out)" />
        <path d={line('in')} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={line('out')} fill="none" stroke="#f43f5e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {safe.map((d, i) => (
          <rect key={`hit${i}`} x={x(i) - iw / safe.length / 2} y={padT} width={iw / safe.length} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }} />
        ))}
        {h && (
          <g>
            <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + ih} stroke="hsl(var(--foreground))" strokeOpacity={0.25} />
            <circle cx={x(hover!)} cy={y(h.in)} r={3.5} fill="#10b981" />
            <circle cx={x(hover!)} cy={y(h.out)} r={3.5} fill="#f43f5e" />
          </g>
        )}
        {safe.map((d, i) => (i % xEvery === 0 || i === safe.length - 1
          ? <text key={`x${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{d.date}</text>
          : null))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-emerald-500" />Money in</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-rose-500" />Money out</span>
        </div>
        <div className="text-xs">
          {h
            ? <span><span className="font-semibold">{h.date}</span> · <span className="text-emerald-600">+{money(h.in)}</span> · <span className="text-rose-500">−{money(h.out)}</span></span>
            : <span className="text-muted-foreground">Hover for daily detail</span>}
        </div>
      </div>
    </div>
  );
}
