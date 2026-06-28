'use client';
import { useState } from 'react';
import { money } from '@/data/adminMock';
import type { MonthPoint } from '@/lib/affiliate';

const MONTH_LABEL = (m: string) => {
  const [, mm] = m.split('-').map(Number);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mm - 1];
};

export function EarningsChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const safe = data.length ? data : [{ month: '2026-01', commission: 0, volume: 0 }];

  const W = 760, H = 240, padL = 46, padR = 46, padT = 16, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;

  const maxC = Math.max(...safe.map((d) => d.commission), 1);
  const maxV = Math.max(...safe.map((d) => d.volume), 1);
  const niceC = Math.ceil(maxC / 200) * 200 || 200;
  const niceV = Math.ceil(maxV / 1000) * 1000 || 1000;

  const band = iw / safe.length;
  const barW = Math.min(34, band * 0.5);
  const cx = (i: number) => padL + band * i + band / 2;
  const yC = (v: number) => padT + ih - (v / niceC) * ih;
  const yV = (v: number) => padT + ih - (v / niceV) * ih;
  const grid = Array.from({ length: 5 }, (_, i) => (i * niceC) / 4);
  const fmtK = (g: number) => (g >= 1000 ? `$${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `$${g}`);

  const volLine = safe.map((d, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${yV(d.volume).toFixed(1)}`).join(' ');
  const h = hover != null ? safe[hover] : null;

  const totalC = safe.reduce((s, d) => s + d.commission, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" aria-hidden /> Earnings over time</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{money(totalC)}</span> commission across {safe.length} months
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Commission</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-amber-500" /> Referred volume</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly commission and referred volume" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="aff-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yC(g)} y2={yC(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
            <text x={padL - 8} y={yC(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
          </g>
        ))}

        {safe.map((d, i) => (
          <g key={d.month} onMouseEnter={() => setHover(i)}>
            <rect x={cx(i) - band / 2} y={padT} width={band} height={ih} fill="transparent" />
            <rect x={cx(i) - barW / 2} y={yC(d.commission)} width={barW} height={Math.max(0, padT + ih - yC(d.commission))}
              rx={4} fill="url(#aff-bar)" opacity={hover === null || hover === i ? 1 : 0.45} />
            <text x={cx(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{MONTH_LABEL(d.month)}</text>
          </g>
        ))}

        <path d={volLine} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {safe.map((d, i) => (
          <circle key={d.month} cx={cx(i)} cy={yV(d.volume)} r={hover === i ? 4 : 2.5} fill="#f59e0b" />
        ))}

        {h && (
          <g>
            <line x1={cx(hover!)} x2={cx(hover!)} y1={padT} y2={padT + ih} stroke="hsl(var(--border))" />
          </g>
        )}
      </svg>

      {h && (
        <div className="mt-1 flex items-center justify-center gap-4 text-xs">
          <span className="font-semibold">{MONTH_LABEL(h.month)} {h.month.slice(0, 4)}</span>
          <span className="text-brand-600">Commission <b>{money(h.commission)}</b></span>
          <span className="text-amber-600">Volume <b>{money(h.volume)}</b></span>
        </div>
      )}
    </section>
  );
}
