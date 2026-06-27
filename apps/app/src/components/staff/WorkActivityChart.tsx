'use client';

import { useState } from 'react';
import { money } from '@/data/adminMock';
import type { ActivityBucket, Granularity } from '@/data/staffMock';

type Metric = 'tasks' | 'pay';
interface TypeMeta { service: string; label: string; icon: string; color: string; }

const GRANS: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// Fixed-height CSS bar chart (px-based) — fills width but never grows tall on wide screens the way a
// uniformly-scaled SVG does. Labels live outside the fixed plot area, so bars can't overflow upward.
const PLOT = 184;      // total plot height (px)
const BAR_AREA = 160;  // bar/gridline region — leaves room above for value labels

export function WorkActivityChart({ data, types }: { data: Record<Granularity, ActivityBucket[]>; types: TypeMeta[] }) {
  const [gran, setGran] = useState<Granularity>('month');
  const [metric, setMetric] = useState<Metric>('tasks');

  const buckets = data[gran];
  const colorOf = (service: string) => types.find((t) => t.service === service)?.color ?? '#64748b';
  const valueOf = (b: ActivityBucket) => (metric === 'tasks' ? b.tasks : b.pay);
  const sliceVal = (s: { tasks: number; pay: number }) => (metric === 'tasks' ? s.tasks : s.pay);
  const fmtVal = (v: number) => (metric === 'tasks' ? String(v) : money(v));

  const rawMax = Math.max(1, ...buckets.map(valueOf));
  const step = metric === 'tasks' ? (rawMax <= 6 ? 2 : rawMax <= 20 ? 5 : 20) : (rawMax <= 200 ? 50 : 500);
  const niceMax = Math.ceil(rawMax / step) * step;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  const totalTasks = buckets.reduce((a, b) => a + b.tasks, 0);
  const totalPay = buckets.reduce((a, b) => a + b.pay, 0);

  return (
    <div>
      {/* toggles */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented options={GRANS.map((g) => ({ key: g.key, label: g.label }))} value={gran} onChange={(k) => setGran(k as Granularity)} />
        <Segmented
          options={[{ key: 'tasks', label: 'Tasks' }, { key: 'pay', label: 'Earnings' }]}
          value={metric}
          onChange={(k) => setMetric(k as Metric)}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {metric === 'tasks' ? `${totalTasks} tasks` : money(totalPay)} <span className="opacity-70">· this {gran === 'day' ? '2 weeks' : gran === 'week' ? '12 weeks' : gran === 'month' ? '12 months' : '4 years'}</span>
        </span>
      </div>

      {/* chart */}
      <div className="flex gap-2">
        {/* y-axis */}
        <div className="relative w-10 shrink-0" style={{ height: PLOT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-1 translate-y-1/2 text-[9px] text-muted-foreground" style={{ bottom: (t / niceMax) * BAR_AREA }}>
              {metric === 'tasks' ? t : money(t)}
            </span>
          ))}
        </div>

        {/* plot */}
        <div className="relative flex-1" style={{ height: PLOT }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border/50" style={{ bottom: (t / niceMax) * BAR_AREA }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5">
            {buckets.map((b) => {
              const v = valueOf(b);
              const barH = (v / niceMax) * BAR_AREA;
              return (
                <div key={b.key} className="group flex h-full flex-1 flex-col items-center justify-end">
                  {v > 0 && <span className="mb-1 text-[10px] font-semibold tabular-nums">{fmtVal(v)}</span>}
                  <div className="flex w-full max-w-[2.4rem] flex-col-reverse overflow-hidden rounded-t-md ring-1 ring-black/5" style={{ height: barH }}>
                    {b.slices.map((s) => (
                      <div
                        key={s.service}
                        style={{ height: v > 0 ? (sliceVal(s) / v) * barH : 0, backgroundColor: colorOf(s.service) }}
                        title={`${b.full} · ${s.service}: ${metric === 'tasks' ? `${s.tasks} task${s.tasks === 1 ? '' : 's'}` : money(s.pay)}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* x-axis labels */}
      <div className="mt-1.5 flex gap-1.5 pl-12">
        {buckets.map((b) => (
          <span key={b.key} className="flex-1 truncate text-center text-[10px] text-muted-foreground" title={b.full}>{b.label}</span>
        ))}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {types.map((t) => (
          <span key={t.service} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} aria-hidden /> {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${value === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
