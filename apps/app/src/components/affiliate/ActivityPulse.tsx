import { money } from '@/data/adminMock';
import { recentActivity, type Activity } from '@/data/affiliatePulse';

const ICON: Record<Activity['kind'], string> = {
  commission: 'ph-coins',
  signup: 'ph-user-plus',
  tier: 'ph-crown-simple',
  peer: 'ph-users-three',
  payout: 'ph-arrow-line-down',
};

export function ActivityPulse() {
  const items = recentActivity();
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-sm font-semibold">Live activity</p>
      </div>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${a.mine ? 'bg-emerald-500/[0.06]' : ''}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${a.mine ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
              <i className={`ph-bold ${ICON[a.kind]}`} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate">
              {a.text}
              {a.amount != null && <span className="ml-1 font-semibold text-emerald-600">+{money(a.amount)}</span>}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{a.ago}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
