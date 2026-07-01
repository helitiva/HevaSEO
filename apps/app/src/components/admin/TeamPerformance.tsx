import Link from 'next/link';
import { STAFF, type AdminStaff } from '@/data/adminMock';

const scoreColor = (n: number) => (n >= 90 ? '#10b981' : n >= 80 ? '#f59e0b' : '#ef4444');

// `staff` (real, getStaff — computed perf inc-E32) overrides the mock roster when provided.
export function TeamPerformance({ staff }: { staff?: AdminStaff[] } = {}) {
  const roster = staff && staff.length ? staff : STAFF;
  const n = roster.length || 1;
  const avg = (k: 'composite' | 'quality' | 'onTime') => Math.round(roster.reduce((s, x) => s + x[k], 0) / n);
  const ranked = [...roster].sort((a, b) => b.composite - a.composite);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-medal text-primary" aria-hidden /> Team performance</p>
        <Link href="/admin/staff" className="text-xs font-semibold text-primary hover:underline">All staff →</Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {([['Avg score', avg('composite')], ['Avg quality', avg('quality')], ['Avg on-time', avg('onTime')]] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-border bg-background/40 p-3 text-center">
            <p className="display text-2xl font-bold tracking-tight" style={{ color: scoreColor(v) }}>{v}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {ranked.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{s.name.split(' ').map((p) => p[0]).join('')}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{s.name}</span>
                {i === 0 && <span className="pill pill-live">top</span>}
                <span className="ml-auto text-xs text-muted-foreground">Q {s.quality} · OT {s.onTime}% · {s.throughput} done</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${s.composite}%`, background: scoreColor(s.composite) }} />
              </div>
            </div>
            <span className="display w-8 shrink-0 text-right text-lg font-bold" style={{ color: scoreColor(s.composite) }}>{s.composite}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
