import type { FunnelStage } from '@/lib/affiliate';

const ICON: Record<FunnelStage['key'], string> = {
  clicks: 'ph-cursor-click',
  signups: 'ph-user-plus',
  firstOrder: 'ph-shopping-bag-open',
  repeat: 'ph-repeat',
};

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-funnel text-primary" /> Conversion funnel</p>
      <p className="mt-0.5 text-xs text-muted-foreground">From a click to a repeat buyer</p>

      <div className="mt-4 space-y-2.5">
        {stages.map((s, i) => {
          const w = Math.max(8, Math.round((s.value / max) * 100));
          return (
            <div key={s.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium"><i className={`ph-bold ${ICON[s.key]} text-muted-foreground`} /> {s.label}</span>
                <span className="text-muted-foreground">
                  <b className="text-foreground">{s.value.toLocaleString('en-US')}</b>
                  {i > 0 && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{s.rate}%</span>}
                </span>
              </div>
              <div className="h-7 overflow-hidden rounded-lg bg-muted/50">
                <div className="flex h-full items-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 transition-all" style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
