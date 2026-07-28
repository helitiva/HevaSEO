// Presentational pieces for the Manager Score, shared by the manager self-view
// (/manager/performance, a server component) and the admin oversight view
// (/admin/managers, a client component). Pure + hook-free so both can import it.
import type { ManagerLever, MgrLeverKey } from '@/lib/managerPerf';

// One colour per lever — used by the stacked bar, the per-lever rows and the
// compact strip so the whole score reads as a single chart.
export const LEVER_BAR: Record<MgrLeverKey, string> = {
  delivery: 'bg-primary',
  quality: 'bg-emerald-500',
  responsiveness: 'bg-amber-500',
  'team-health': 'bg-sky-500',
  growth: 'bg-violet-500',
};
export const LEVER_TEXT: Record<MgrLeverKey, string> = {
  delivery: 'text-primary',
  quality: 'text-emerald-500',
  responsiveness: 'text-amber-500',
  'team-health': 'text-sky-500',
  growth: 'text-violet-500',
};

// Stacked contribution bar — coloured chunks sum to the composite, grey = headroom to 100.
export function MgrScoreBar({ levers, composite }: { levers: ManagerLever[]; composite: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Manager score ${composite} of 100`}>
      {levers.map((l) => (
        <span key={l.key} className={LEVER_BAR[l.key]} style={{ width: `${l.points}%` }} title={`${l.label}: ${l.points} of ${composite} pts`} />
      ))}
    </div>
  );
}

// Per-lever rows: score vs its goal, weighted points, and remaining headroom. When a
// company benchmark is passed, each row also shows where this manager sits vs the pod average.
export function MgrLeverRows({ levers, bench, weakestKey }: {
  levers: ManagerLever[]; bench?: Record<MgrLeverKey, number>; weakestKey?: MgrLeverKey | null;
}) {
  return (
    <ul className="space-y-2.5">
      {levers.map((l) => {
        const avg = bench?.[l.key];
        const delta = avg !== undefined ? l.score - avg : null;
        const pct = Math.min(100, l.score);
        const goalPct = Math.min(100, l.goal);
        return (
          <li key={l.key} className="text-sm">
            <div className="mb-1 flex items-center gap-2">
              <i className={`ph-fill ${l.icon} ${LEVER_TEXT[l.key]}`} aria-hidden />
              <span className="font-medium">{l.label}</span>
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">{Math.round(l.weight * 100)}%</span>
              {weakestKey === l.key && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">Focus</span>}
              <span className="ml-auto flex items-center gap-2 text-xs">
                {delta !== null && (
                  <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-500' : 'text-amber-500'}`} title="vs company average">
                    <i className={`ph-bold ${delta >= 0 ? 'ph-arrow-up' : 'ph-arrow-down'}`} aria-hidden />{delta >= 0 ? '+' : ''}{delta}
                  </span>
                )}
                <span className="font-semibold text-foreground">{l.score}</span>
              </span>
            </div>
            {/* score bar with a goal marker + optional benchmark tick */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${LEVER_BAR[l.key]}`} style={{ width: `${pct}%` }} />
              <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/40" style={{ left: `calc(${goalPct}% - 1px)` }} title={`Goal ${l.goal}`} />
              {avg !== undefined && (
                <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-muted-foreground/70" style={{ left: `calc(${Math.min(100, avg)}% - 1px)` }} title={`Company avg ${avg}`} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// The single weakest lever, phrased as a coaching action ("what to improve next").
export function WeakestCallout({ weakest }: { weakest: ManagerLever | null }) {
  if (!weakest) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-fill ph-trophy text-emerald-500" aria-hidden />Every lever is at goal</p>
        <p className="mt-1 text-sm text-muted-foreground">Hold the standard — consistency is what keeps the pod scoring high.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-fill ${weakest.icon} text-primary`} aria-hidden />{weakest.label} is the biggest lever</p>
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary" title="Manager-score points gainable by hitting this lever's goal">+{weakest.headroom} pts</span>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <i className="ph-bold ph-arrow-bend-down-right mt-0.5 text-primary" aria-hidden />
        <span><span className="font-semibold text-foreground">Do next:</span> {weakest.action}</span>
      </p>
    </div>
  );
}

// Compact 5-segment strip for dense list cards — each lever tinted by its score.
// Color alone isn't accessible, so each segment carries a label+score for SR/hover.
export function MgrLeverStrip({ levers }: { levers: ManagerLever[] }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Score levers — ${levers.map((l) => `${l.label} ${l.score}`).join(', ')}`}>
      {levers.map((l) => (
        <span key={l.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" title={`${l.label}: ${l.score}`}>
          <span className={`block h-full rounded-full ${LEVER_BAR[l.key]}`} style={{ width: `${Math.min(100, l.score)}%` }} />
        </span>
      ))}
    </div>
  );
}
