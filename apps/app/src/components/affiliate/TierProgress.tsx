import { money } from '@/data/adminMock';
import { AFFILIATE_TIERS, tierFor, nextTierProgress, nextTierUpside } from '@/lib/affiliate';

export function TierProgress({ lifetimeVolume }: { lifetimeVolume: number }) {
  const tier = tierFor(lifetimeVolume);
  const { next, pct, remaining } = nextTierProgress(lifetimeVolume);
  const { gapValue } = nextTierUpside(lifetimeVolume);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <i className="ph-fill ph-crown-simple text-amber-500" aria-hidden /> {tier.label} partner
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You earn <span className="font-semibold text-foreground">{Math.round(tier.rate * 100)}%</span> on every referred order.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Lifetime referred volume</p>
          <p className="text-lg font-bold tracking-tight">{money(lifetimeVolume)}</p>
        </div>
      </div>

      {/* progress bar */}
      <div className="mt-4">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {next
            ? <>+{money(remaining)} more in referred volume to reach <span className="font-semibold text-foreground">{next.label}</span> ({Math.round(next.rate * 100)}%).</>
            : <>You&apos;re at the top tier — maximum commission rate unlocked. 🎉</>}
        </p>
      </div>

      {/* loss-aversion: what staying put costs */}
      {next && gapValue > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2.5">
          <i className="ph-fill ph-warning-circle mt-0.5 text-rose-500" aria-hidden />
          <p className="text-xs text-muted-foreground">
            You&apos;ve left <span className="font-bold text-rose-600">{money(gapValue)}</span> on the table — that&apos;s what your referred volume would have paid at the <span className="font-semibold text-foreground">{next.label}</span> rate. Level up and every future order pays {Math.round(next.rate * 100)}%.
          </p>
        </div>
      )}

      {/* tier ladder */}
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {AFFILIATE_TIERS.map((t) => {
          const reached = lifetimeVolume >= t.minVolume;
          const current = t.id === tier.id;
          return (
            <div key={t.id}
              className={`rounded-xl border px-2 py-2 text-center ${
                current ? 'border-primary bg-primary/10'
                : reached ? 'border-border bg-muted/40'
                : 'border-dashed border-border opacity-60'
              }`}>
              <p className="text-xs font-bold">{t.label}</p>
              <p className="text-[11px] text-muted-foreground">{Math.round(t.rate * 100)}%</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{t.minVolume === 0 ? 'start' : `${money(t.minVolume)}+`}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
