'use client';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { money } from '@/data/adminMock';
import { pctDelta, type PayoutStatus } from '@/lib/affiliate';
import { EarningsChart } from '@/components/affiliate/EarningsChart';
import {
  adminAffiliates, adminPayouts, programSeries,
  DEFAULT_RULES, defaultTierRows, tierRowFor, newlyPaidTotal,
  type PartnerStatus, type ProgramRules, type EditableTier,
} from '@/data/adminAffiliate';
import { Kpi, TierBadge, usePersistedState } from './shared';
import { PartnersTab } from './PartnersTab';
import { PayoutsTab } from './PayoutsTab';
import { RulesTab } from './RulesTab';
import { PartnerDrawer } from './PartnerDrawer';

type TabKey = 'overview' | 'partners' | 'payouts' | 'rules';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ph-gauge' },
  { key: 'partners', label: 'Partners', icon: 'ph-users-three' },
  { key: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' },
  { key: 'rules', label: 'Rules & tiers', icon: 'ph-sliders' },
];

export function AffiliateAdminClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'overview';
  const setTab = (k: TabKey) => {
    const next = new URLSearchParams(params.toString());
    if (k === 'overview') next.delete('tab'); else next.set('tab', k);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  // In-session admin actions (mock; localStorage-backed).
  const [statusOverride, setStatusOverride] = usePersistedState<Record<string, PartnerStatus>>('partnerStatus', {});
  const [payoutOverride, setPayoutOverride] = usePersistedState<Record<string, PayoutStatus>>('payoutStatus', {});
  const [rules, setRules] = usePersistedState<ProgramRules>('rules', DEFAULT_RULES);
  const [tierRows, setTierRows] = usePersistedState<EditableTier[]>('tiers', defaultTierRows());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Base payout statuses, to tell which requests the admin newly marked paid this session.
  const basePayoutStatus = useMemo(
    () => Object.fromEntries(adminPayouts().map((p) => [p.id, p.status])) as Record<string, PayoutStatus>,
    [],
  );
  const payouts = useMemo(
    () => adminPayouts().map((p) => ({ ...p, status: payoutOverride[p.id] ?? p.status })),
    [payoutOverride],
  );
  // Partner balances reconcile with the payout queue: a request marked PAID raises the
  // partner's `claimed` (and lowers unclaimed), so headline, table and drawer all agree.
  const partners = useMemo(
    () => adminAffiliates().map((p) => ({
      ...p,
      status: statusOverride[p.id] ?? p.status,
      claimed: p.claimed + newlyPaidTotal(p.id, payouts, basePayoutStatus),
    })),
    [statusOverride, payouts, basePayoutStatus],
  );

  const setPartnerStatus = (id: string, next: PartnerStatus) => setStatusOverride({ ...statusOverride, [id]: next });
  const setPayoutStatus = (id: string, next: PayoutStatus) => setPayoutOverride({ ...payoutOverride, [id]: next });

  // Money reflects everyone who ever earned (active + suspended) — suspending a partner
  // doesn't un-drive the revenue they brought or erase commission still owed to them.
  // Only the partner COUNT distinguishes active from suspended.
  const counted = partners.filter((p) => p.status !== 'pending');
  const pending = partners.filter((p) => p.status === 'pending');
  const activeCount = partners.filter((p) => p.status === 'active').length;
  const totalCommission = counted.reduce((s, p) => s + p.commission, 0);
  const totalClaimed = counted.reduce((s, p) => s + p.claimed, 0);
  const totalVolume = counted.reduce((s, p) => s + p.volume, 0);
  const totalRefs = counted.reduce((s, p) => s + p.refs, 0);
  const totalUnclaimed = totalCommission - totalClaimed;
  const owed = payouts.filter((p) => p.status === 'requested' || p.status === 'approved').reduce((s, p) => s + p.amount, 0);
  const newRequests = payouts.filter((p) => p.status === 'requested').length;

  const leaders = partners
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5)
    .map((p) => ({ ...p, tier: tierRowFor(tierRows, p.volume) }));
  const selected = partners.find((p) => p.id === selectedId) ?? null;

  // MoM deltas from the program trend, to match the partner dashboard's polish.
  const series = programSeries();
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const volumeDelta = prev ? pctDelta(cur.volume, prev.volume) : null;
  const netDelta = prev ? pctDelta(cur.volume - cur.commission, prev.volume - prev.commission) : null;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="display text-2xl font-bold tracking-tight">Affiliate program</h1>
        <p className="text-sm text-muted-foreground">Partners, tiers, rules &amp; payouts — who&apos;s driving revenue and what you owe them.</p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <i className={`ph-bold ${t.icon}`} /> {t.label}
            {t.key === 'payouts' && newRequests > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-600">{newRequests}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi icon="ph-users-three" label="Active partners" value={String(activeCount)} hint={`${pending.length} pending`} />
            <Kpi icon="ph-user-plus" label="Referred customers" value={String(totalRefs)} hint="via partner links" />
            <Kpi icon="ph-chart-bar" label="Referred volume" value={money(totalVolume)} hint="revenue driven" tone="good" delta={volumeDelta} />
            <Kpi icon="ph-scales" label="Program net" value={money(totalVolume - totalCommission)} hint="after commission" tone="good" delta={netDelta} />
            <Kpi icon="ph-check-circle" label="Commission paid" value={money(totalClaimed)} hint="claimed" />
            <Kpi icon="ph-warning-circle" label="Commission owed" value={money(totalUnclaimed)} hint="unclaimed liability" tone="warn" />
          </div>

          <EarningsChart data={programSeries()} />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* leaderboard */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-trophy text-amber-500" /> Top partners</p>
              <div className="mt-3 space-y-1.5">
                {leaders.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted/50">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white">{p.avatarInitials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.refs} refs · {money(p.volume)} volume</p>
                    </div>
                    <TierBadge tier={p.tier.id} rate={p.tier.rate} />
                    <span className="w-20 text-right font-semibold tabular-nums text-emerald-600">{money(p.commission)}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setTab('partners')} className="mt-3 text-xs font-semibold text-primary hover:underline">All partners →</button>
            </section>

            {/* payout queue + applications */}
            <section className="space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-hand-coins text-amber-600" /> Payout queue</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600">{money(owed)}</p>
                <p className="text-xs text-muted-foreground">{newRequests} request{newRequests === 1 ? '' : 's'} awaiting your review</p>
                <button type="button" onClick={() => setTab('payouts')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                  Review payouts <i className="ph-bold ph-arrow-right" />
                </button>
              </div>
              {pending.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user-list text-primary" /> {pending.length} pending application{pending.length === 1 ? '' : 's'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">New partners waiting for approval.</p>
                  <button type="button" onClick={() => setTab('rules')} className="mt-3 text-xs font-semibold text-primary hover:underline">Review applications →</button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'partners' && <PartnersTab partners={partners} tierRows={tierRows} onToggle={setPartnerStatus} onSelect={setSelectedId} />}
      {tab === 'payouts' && <PayoutsTab payouts={payouts} onAction={setPayoutStatus} />}
      {tab === 'rules' && (
        <RulesTab rules={rules} setRules={setRules} tierRows={tierRows} setTierRows={setTierRows} applications={pending} onToggle={setPartnerStatus} />
      )}

      <PartnerDrawer partner={selected} payouts={payouts} tierRows={tierRows} onToggle={setPartnerStatus} onClose={() => setSelectedId(null)} />
    </section>
  );
}
