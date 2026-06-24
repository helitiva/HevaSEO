'use client';

import { useMemo, useState } from 'react';
import { money, type RevenuePoint, type ServiceMixRow } from '@/data/adminMock';

const PRESETS = [7, 14, 30, 90] as const;

export function RevenueChart({ data, services }: { data: RevenuePoint[]; services: ServiceMixRow[] }) {
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

  const shareTotal = services.reduce((s, x) => s + x.value, 0) || 1;
  const shares = services.map((s) => ({ service: s.service, color: s.color, frac: s.value / shareTotal }));

  const W = 760, H = 264, padL = 46, padR = 14, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const safe = series.length ? series : data.slice(-7);
  const niceMax = Math.ceil(Math.max(...safe.map((d) => d.revenue), 1) / 500) * 500 || 500;
  const maxOrd = Math.ceil(Math.max(...safe.map((d) => d.orders), 1) / 5) * 5 || 5;
  const x = (i: number) => padL + (safe.length === 1 ? iw / 2 : (i / (safe.length - 1)) * iw);
  const bw = Math.max(2, (iw / safe.length) * 0.62);
  const yRev = (v: number) => padT + ih - (v / niceMax) * ih;
  const yOrd = (v: number) => padT + ih - (v / maxOrd) * ih;
  const grid = Array.from({ length: 5 }, (_, i) => (i * niceMax) / 4);
  const xEvery = Math.max(1, Math.ceil(safe.length / 7));
  const linePath = safe.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yOrd(d.orders).toFixed(1)}`).join(' ');
  const total = safe.reduce((s, d) => s + d.revenue, 0);
  const fmtK = (g: number) => (g >= 1000 ? `$${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `$${g}`);
  const h = hover != null ? safe[hover] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" /> Revenue &amp; order volume</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{period === 'custom' ? `${from} → ${to}` : `Last ${period} days`} · <span className="font-semibold text-foreground">{money(total)}</span> · stacked by service</p>
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

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue by service and order volume" onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yRev(g)} y2={yRev(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
            <text x={padL - 8} y={yRev(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
          </g>
        ))}
        {safe.map((d, i) => {
          let cum = 0;
          const dim = hover != null && hover !== i;
          return (
            <g key={`bar${i}`} onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }}>
              {shares.map((sh, si) => {
                const segVal = d.revenue * sh.frac;
                const y0 = yRev(cum + segVal);
                const y1 = yRev(cum);
                cum += segVal;
                return <rect key={si} x={x(i) - bw / 2} y={y0} width={bw} height={Math.max(0, y1 - y0)} fill={sh.color} fillOpacity={dim ? 0.3 : 0.92} rx={si === shares.length - 1 ? 2 : 0} />;
              })}
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
        {shares.map((s) => <span key={s.service} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="legend-dot" style={{ background: s.color }} />{s.service}</span>)}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-0.5 w-3 rounded bg-amber-500" />Orders</span>
      </div>
      <div className="mt-1 text-center text-xs">
        {h
          ? <span><span className="font-semibold">{h.date}</span> · <span className="text-muted-foreground">Revenue</span> <b>{money(h.revenue)}</b> · <span className="text-muted-foreground">Orders</span> <b>{h.orders}</b></span>
          : <span className="text-muted-foreground">Hover a bar for daily detail</span>}
      </div>
    </div>
  );
}
