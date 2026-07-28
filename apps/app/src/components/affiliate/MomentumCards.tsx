import { money } from '@/data/adminMock';
import { Countdown } from './Countdown';
import { myRank, monthlyChallenge } from '@/data/affiliatePulse';

// The "momentum row": three urgency cards shown high on the dashboard.
// Rank (status/competition) · Challenge (time-boxed bonus) · Streak (loss aversion).

export function RankCard() {
  const r = myRank();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-trophy text-amber-500" aria-hidden /> Leaderboard</p>
        {r.trend > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
            <i className="ph-bold ph-arrow-up" aria-hidden />{r.trend}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">#{r.rank} <span className="text-sm font-medium text-muted-foreground">/ {r.total}</span></p>
      <p className="text-[11px] font-semibold text-amber-600">Top {r.percentile}% of partners</p>
      <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
        Just <span className="font-bold text-foreground">{money(r.aheadGap)}</span> behind <span className="font-mono">{r.aheadName}</span> at #{r.rank - 1}.
      </p>
    </div>
  );
}

export function ChallengeCard() {
  const c = monthlyChallenge();
  const left = Math.max(0, c.goal - c.current);
  const pct = Math.min(100, Math.round((c.current / c.goal) * 100));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/[0.12] via-card to-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600"><i className="ph-fill ph-lightning" aria-hidden /> {c.label}</p>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">+{money(c.reward)} bonus</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold">
        {left > 0 ? <>Just <span className="text-amber-600">{left} more {c.unit}</span> to unlock {money(c.reward)}.</> : <>Challenge complete — {money(c.reward)} unlocked! 🎉</>}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ends in</span>
        <Countdown to={c.endsAt} />
      </div>
    </div>
  );
}

export function StreakCard({ streak, projected }: { streak: number; projected: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-fill ph-flame text-orange-500" aria-hidden /> Earning streak</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{streak} mo <span className="text-base">🔥</span></p>
      <p className="text-[11px] font-semibold text-orange-600">Keep it alive — earn before month end</p>
      <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
        On pace for <span className="font-bold text-foreground">{money(projected)}</span> this month.
      </p>
    </div>
  );
}
