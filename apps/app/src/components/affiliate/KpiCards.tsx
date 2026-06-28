import { money } from '@/data/adminMock';
import { pctDelta, type AffiliateKpis } from '@/lib/affiliate';

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] font-semibold text-emerald-600">new</span>;
  if (value === 0) return <span className="text-[11px] font-medium text-muted-foreground">no change</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      <i className={`ph-bold ${up ? 'ph-trend-up' : 'ph-trend-down'}`} aria-hidden />
      {up ? '+' : ''}{value}% MoM
    </span>
  );
}

function Card({ icon, label, value, foot }: { icon: string; label: string; value: string; foot: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <i className={`ph-bold ${icon} text-primary`} aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-1">{foot}</div>
    </div>
  );
}

export function KpiCards({ k }: { k: AffiliateKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Card icon="ph-cursor-click" label="Link clicks" value={k.clicks.toLocaleString('en-US')}
        foot={<span className="text-[11px] text-muted-foreground">all time</span>} />
      <Card icon="ph-user-plus" label="Referred signups" value={String(k.signups)}
        foot={<span className="text-[11px] text-muted-foreground">{k.signupsThisMonth} this month</span>} />
      <Card icon="ph-users-three" label="Active customers" value={String(k.activeCustomers)}
        foot={<span className="text-[11px] text-muted-foreground">still ordering</span>} />
      <Card icon="ph-chart-bar" label="Referred volume" value={money(k.totalVolume)}
        foot={<Delta value={pctDelta(k.volumeThisMonth, k.volumeLastMonth)} />} />
      <Card icon="ph-coins" label="Commission (lifetime)" value={money(k.commissionLifetime)}
        foot={<span className="text-[11px] text-muted-foreground">earned to date</span>} />
      <Card icon="ph-trend-up" label="Commission (this mo.)" value={money(k.commissionThisMonth)}
        foot={<Delta value={pctDelta(k.commissionThisMonth, k.commissionLastMonth)} />} />
    </div>
  );
}
