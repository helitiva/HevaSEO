'use client';

import { useState } from 'react';
import { money, type ServiceMixRow } from '@/data/adminMock';

export function ServiceMix({ data }: { data: ServiceMixRow[] }) {
  const [by, setBy] = useState<'value' | 'orders'>('value');
  const metric = (r: ServiceMixRow) => (by === 'value' ? r.value : r.orders);
  const rows = [...data].sort((a, b) => metric(b) - metric(a));
  const total = rows.reduce((s, r) => s + metric(r), 0) || 1;

  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = rows.map((r) => {
    const frac = metric(r) / total;
    const seg = { color: r.color, dash: frac * C, offset: acc * C };
    acc += frac;
    return seg;
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-donut text-primary" aria-hidden /> Service mix</p>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['value', 'orders'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setBy(k)}
              className={`rounded-md px-2 py-0.5 transition ${by === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {k === 'value' ? 'By value' : 'By orders'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <svg width={140} height={140} viewBox="0 0 140 140" aria-hidden>
            <circle cx={70} cy={70} r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth={16} />
            {segs.map((s, i) => (
              <circle key={i} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={16}
                strokeDasharray={`${s.dash.toFixed(2)} ${(C - s.dash).toFixed(2)}`} strokeDashoffset={(-s.offset).toFixed(2)}
                transform="rotate(-90 70 70)" />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="display text-lg font-bold leading-none">{by === 'value' ? money(total) : total}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{by === 'value' ? 'total value' : 'total orders'}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {rows.map((r) => {
            const pct = Math.round((metric(r) / total) * 100);
            return (
              <div key={r.service}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium"><span className="legend-dot" style={{ background: r.color }} />{r.service}</span>
                  <span className="text-muted-foreground">{by === 'value' ? money(r.value) : `${r.orders} orders`} · <b className="text-foreground">{pct}%</b></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
