'use client';
import { useState } from 'react';
import { money } from '@/data/adminMock';
import type { VolMonth } from '@/data/adminAffiliate';

const RANGES = [{ label: '1M', n: 1 }, { label: '3M', n: 3 }, { label: '6M', n: 6 }, { label: '1Y', n: 12 }] as const;
const monthLabel = (m: string) => Number(m.split('-')[1]);

// Referred-volume trend with a 1M / 3M / 6M / 1Y range toggle. Used in both the partner
// hovercard (compact) and the partner drawer (taller). `series` is the 12-month series.
export function PartnerVolumeChart({ series, defaultRange = 6, heightClass = 'h-12' }: {
  series: VolMonth[];
  defaultRange?: number;
  heightClass?: string;
}) {
  const [n, setN] = useState(defaultRange);
  const data = series.slice(-n);
  const max = Math.max(...data.map((d) => d.volume), 1);
  const total = data.reduce((s, d) => s + d.volume, 0);
  const W = 100, H = 30, gap = data.length > 1 ? 1.5 : 0;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Volume · last {n === 1 ? 'month' : n === 12 ? 'year' : `${n}mo`}</p>
        <span className="text-[11px] font-bold tabular-nums">{money(total)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${heightClass}`} preserveAspectRatio="none" role="img" aria-label="Referred volume trend">
        {data.map((d, i) => {
          const h = Math.max(1, (d.volume / max) * (H - 2));
          return <rect key={d.month} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={0.6} fill="#3b82f6" opacity={i === data.length - 1 ? 1 : 0.55} />;
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{data.length > 1 ? `mo ${monthLabel(data[0].month)}–${monthLabel(data[data.length - 1].month)}` : `mo ${monthLabel(data[0].month)}`}</span>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {RANGES.map((r) => (
            <button key={r.label} type="button" onClick={() => setN(r.n)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${n === r.n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{r.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
