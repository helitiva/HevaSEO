'use client';
import { useState } from 'react';
import { AUDIENCE_META } from '@/data/broadcasts';
import type { Bucket, AudStat, Summary } from '@/lib/broadcastAnalytics';

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ── Read activity over time: per-bucket bars + cumulative curve, Day/Hour toggle ──
export function ReadTimeline({ hourly, daily, total }: { hourly: Bucket[]; daily: Bucket[]; total: number }) {
  const [mode, setMode] = useState<'hour' | 'day'>('hour');
  const buckets = mode === 'hour' ? hourly : daily;
  const W = 760, H = 200, padL = 30, padR = 36, padT = 12, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxBar = Math.max(...buckets.map((b) => b.count), 1);
  const bw = iw / buckets.length;

  let run = 0;
  const cum = buckets.map((b) => (run += b.count));
  const cy = (v: number) => padT + ih - (total ? (v / total) * ih : 0);
  const cx = (i: number) => padL + bw * i + bw / 2;
  const line = cum.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  const within3h = hourly.slice(0, 3).reduce((s, b) => s + b.count, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" /> Reads over time</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{total} read{total === 1 ? '' : 's'}{total > 0 && <> · <span className="font-semibold text-foreground">{pct(within3h / Math.max(total, 1))}</span> within first 3h</>}</p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['hour', 'day'] as const).map((mo) => (
            <button key={mo} type="button" onClick={() => setMode(mo)} className={`rounded-md px-2 py-0.5 capitalize transition ${mode === mo ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{mo}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reads over time">
        <line x1={padL} x2={W - padR} y1={padT + ih} y2={padT + ih} stroke="hsl(var(--border))" />
        {buckets.map((b, i) => {
          const bh = (b.count / maxBar) * ih;
          return <rect key={i} x={padL + bw * i + bw * 0.15} y={padT + ih - bh} width={bw * 0.7} height={bh} rx={2} fill="hsl(var(--primary))" fillOpacity={0.35}><title>{b.label}: {b.count}</title></rect>;
        })}
        {total > 0 && <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {total > 0 && cum.map((v, i) => <circle key={i} cx={cx(i)} cy={cy(v)} r={2} fill="hsl(var(--primary))" />)}
        {buckets.map((b, i) => (i % every === 0 || i === buckets.length - 1
          ? <text key={`x${i}`} x={padL + bw * i + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{b.label}</text>
          : null))}
        <text x={W - padR + 4} y={cy(total) + 3} fontSize="9" fill="hsl(var(--muted-foreground))">{total}</text>
        <text x={W - padR + 4} y={padT + ih + 3} fontSize="9" fill="hsl(var(--muted-foreground))">0</text>
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" />Reads per {mode}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-primary" />Cumulative</span>
      </div>
    </div>
  );
}

// ── Funnel: Delivered → Read → Clicked → Acknowledged ──────────────────────────
export function Funnel({ s }: { s: Summary }) {
  const stages = [
    { label: 'Delivered', value: s.delivered, icon: 'ph-paper-plane-tilt', color: '#64748b', show: true },
    { label: 'Read', value: s.read, icon: 'ph-eye', color: '#3b82f6', show: true },
    { label: 'Clicked CTA', value: s.clicks, icon: 'ph-cursor-click', color: '#8b5cf6', show: s.hasCta },
    { label: 'Acknowledged', value: s.acked, icon: 'ph-seal-check', color: '#f59e0b', show: s.requireAck },
  ].filter((st) => st.show);
  const base = Math.max(s.delivered, 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-funnel text-primary" /> Engagement funnel</p>
      <div className="space-y-2.5">
        {stages.map((st, i) => {
          const prev = i > 0 ? stages[i - 1].value : st.value;
          const stepConv = i > 0 && prev > 0 ? st.value / prev : 1;
          return (
            <div key={st.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><i className={`ph-bold ${st.icon}`} style={{ color: st.color }} />{st.label}</span>
                <span className="text-muted-foreground"><span className="font-semibold text-foreground">{st.value}</span> · {pct(st.value / base)}{i > 0 && <span className="ml-1 opacity-70">({pct(stepConv)} of prev)</span>}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${(st.value / base) * 100}%`, background: st.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Read rate by audience segment ──────────────────────────────────────────────
export function AudienceBars({ stats }: { stats: AudStat[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-users-three text-primary" /> Read rate by audience</p>
      <div className="space-y-3">
        {stats.map((a) => { const am = AUDIENCE_META[a.audience]; return (
          <div key={a.audience}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: am.color }}><i className={`ph-fill ${am.icon}`} />{am.label}</span>
              <span className="text-muted-foreground"><span className="font-semibold text-foreground">{a.read}/{a.delivered}</span> · {pct(a.rate)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${a.rate * 100}%`, background: am.color }} />
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

// ── Hour-of-day heatmap strip: when do recipients read? ────────────────────────
export function HourHeatmap({ hist }: { hist: number[] }) {
  const max = Math.max(...hist, 1);
  const peak = hist.indexOf(max);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clock text-primary" /> When they read</p>
        <p className="text-xs text-muted-foreground">Peak <span className="font-semibold text-foreground">{String(peak).padStart(2, '0')}:00</span></p>
      </div>
      <div className="flex gap-[3px]">
        {hist.map((c, h) => (
          <div key={h} className="flex-1 rounded-sm" style={{ height: 28, background: c ? `hsl(var(--primary) / ${0.18 + 0.82 * (c / max)})` : 'hsl(var(--muted))' }} title={`${String(h).padStart(2, '0')}:00 — ${c} read`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </div>
  );
}
