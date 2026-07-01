'use client';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { money } from '@/data/adminMock';
import { pctDelta, type PayoutStatus } from '@/lib/affiliate';
import { EarningsChart } from '@/components/affiliate/EarningsChart';
import {
  adminPayouts, programSeries,
  DEFAULT_RULES, defaultTierRows, newlyPaidTotal, tierRowFor,
  type PartnerStatus, type ProgramRules, type EditableTier, type AdminAffiliate, type AdminPayout,
} from '@/data/adminAffiliate';
import { useAdminAffiliates, setPartnerTier as mockSetPartnerTier, type AdminAffiliateWithTier } from '@/data/affiliateAdminStore';
import { resolveAffiliatePayoutAction, setAffiliateStatusAction, setAffiliateTierAction, saveAffiliateRulesAction, saveAffiliateTiersAction } from '@/app/admin/affiliate/payout.actions';
import { AFFILIATE_TIERS, type TierId } from '@/lib/affiliate';
import { Kpi, TierBadge, usePersistedState } from './shared';
import { PartnersTab } from './PartnersTab';
import { PayoutsTab } from './PayoutsTab';
import { RulesTab } from './RulesTab';
import { PartnerDrawer } from './PartnerDrawer';
import { PartnerCreateModal } from './PartnerCreateModal';
import { OutboxButton } from '@/components/admin/accounts/OutboxDrawer';

type TabKey = 'overview' | 'partners' | 'payouts' | 'rules';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ph-gauge' },
  { key: 'partners', label: 'Partners', icon: 'ph-users-three' },
  { key: 'payouts', label: 'Payouts', icon: 'ph-hand-coins' },
  { key: 'rules', label: 'Rules & tiers', icon: 'ph-sliders' },
];

// Lane E inc-E3 — when realPartners/realPayouts are passed (server-fed), the console renders real data
// and payout resolve goes through resolve_affiliate_payout; otherwise it's the localStorage mock.
export function AffiliateAdminClient({ realPartners, realPayouts, realConfig }: {
  realPartners?: AdminAffiliate[];
  realPayouts?: AdminPayout[];
  realConfig?: { rules: ProgramRules; tiers: EditableTier[] } | null;
} = {}) {
  const realMode = Boolean(realPayouts);
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
  // Program rules/tiers: mock persists to localStorage on every change; real edits buffer in local
  // state and commit via an explicit Save (upsert fn) — the server config is the saved baseline.
  const savedRules = realConfig?.rules ?? DEFAULT_RULES;
  const savedTiers = realConfig?.tiers ?? defaultTierRows();
  const [rulesMock, setRulesMock] = usePersistedState<ProgramRules>('rules', DEFAULT_RULES);
  const [tiersMock, setTiersMock] = usePersistedState<EditableTier[]>('tiers', defaultTierRows());
  const [rulesReal, setRulesReal] = useState<ProgramRules>(savedRules);
  const [tiersReal, setTiersReal] = useState<EditableTier[]>(savedTiers);
  const rules = realMode ? rulesReal : rulesMock;
  const setRules = realMode ? setRulesReal : setRulesMock;
  const tierRows = realMode ? tiersReal : tiersMock;
  const setTierRows = realMode ? setTiersReal : setTiersMock;
  const rulesDirty = realMode && JSON.stringify(rulesReal) !== JSON.stringify(savedRules);
  const tiersDirty = realMode && JSON.stringify(tiersReal) !== JSON.stringify(savedTiers);
  const saveRules = () => { void saveAffiliateRulesAction(rulesReal).then((r) => { if (r.ok) router.refresh(); }); };
  const saveTiers = () => { void saveAffiliateTiersAction(tiersReal).then((r) => { if (r.ok) router.refresh(); }); };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Merged seed + admin-created partners, each carrying its effectiveTier (override
  // wins over volume-derived). The overrides map is read so we can flag pinned tiers.
  const { partners: mergedPartners, overrides } = useAdminAffiliates();
  const basePartners = realPartners ?? mergedPartners;

  // Base payout statuses, to tell which requests the admin newly marked paid this session (mock only).
  const basePayoutStatus = useMemo(
    () => Object.fromEntries(adminPayouts().map((p) => [p.id, p.status])) as Record<string, PayoutStatus>,
    [],
  );
  // Real: DB statuses are authoritative (router.refresh after resolve). Mock: apply session overrides.
  const payouts = useMemo(
    () => realPayouts ?? adminPayouts().map((p) => ({ ...p, status: payoutOverride[p.id] ?? p.status })),
    [realPayouts, payoutOverride],
  );
  // Partner balances reconcile with the payout queue: (mock) a request marked PAID raises the partner's
  // `claimed`; (real) `claimed` already comes from the reader (Σ paid payouts).
  const partners = useMemo(
    () => basePartners.map((p) => ({
      ...p,
      // real: a pinned tier (inc-E6) overrides; else derive from volume via the CONFIG tier thresholds
      // (inc-E8b) so the badge matches the Rules-tab tiers, not the lib ladder. mock carries effectiveTier.
      effectiveTier: realMode ? (p.tierPinned && p.pinnedTier ? p.pinnedTier : tierRowFor(tierRows, p.volume).id) : (p as AdminAffiliateWithTier).effectiveTier,
      status: realMode ? p.status : (statusOverride[p.id] ?? p.status),
      claimed: realMode ? p.claimed : p.claimed + newlyPaidTotal(p.id, payouts, basePayoutStatus),
    })),
    [basePartners, realMode, statusOverride, payouts, basePayoutStatus, tierRows],
  );

  const setPartnerStatus = (id: string, next: PartnerStatus) => {
    if (realMode) {
      void setAffiliateStatusAction(id, next).then((r) => { if (r.ok) router.refresh(); });
      return;
    }
    setStatusOverride({ ...statusOverride, [id]: next });
  };
  // Tier pins: real (inc-E6) come from the affiliates row (tier_pinned); mock from localStorage `overrides`.
  const tierOverrides = useMemo(
    () => realMode
      ? Object.fromEntries(partners.filter((p) => p.tierPinned && p.pinnedTier).map((p) => [p.id, p.pinnedTier as TierId]))
      : overrides,
    [realMode, partners, overrides],
  );
  const setPartnerTier = (id: string, tier: TierId | null) => {
    if (realMode) {
      void setAffiliateTierAction(id, tier).then((r) => { if (r.ok) router.refresh(); });
      return;
    }
    mockSetPartnerTier(id, tier);
  };
  const setPayoutStatus = (id: string, next: PayoutStatus) => {
    if (realMode) {
      const action = next === 'approved' ? 'approve' : next === 'paid' ? 'pay' : next === 'rejected' ? 'reject' : null;
      if (!action) return;
      void resolveAffiliatePayoutAction(id, action).then((r) => { if (r.ok) router.refresh(); });
      return;
    }
    setPayoutOverride({ ...payoutOverride, [id]: next });
  };

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

  // Resolve a partner's display tier: the override id if pinned, else volume-derived.
  // Rate follows the admin-edited tier rows so the leaderboard matches the Rules tab.
  const rateForTier = (id: string) =>
    tierRows.find((t) => t.id === id)?.rate ?? AFFILIATE_TIERS.find((t) => t.id === id)?.rate ?? 0;
  const leaders = partners
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5)
    .map((p) => ({ ...p, tier: { id: p.effectiveTier, rate: rateForTier(p.effectiveTier) } }));
  const selected = partners.find((p) => p.id === selectedId) ?? null;

  // MoM deltas from the program trend, to match the partner dashboard's polish.
  const series = programSeries();
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const volumeDelta = prev ? pctDelta(cur.volume, prev.volume) : null;
  const netDelta = prev ? pctDelta(cur.volume - cur.commission, prev.volume - prev.commission) : null;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Affiliate program</h1>
          <p className="text-sm text-muted-foreground">Partners, tiers, rules &amp; payouts — who&apos;s driving revenue and what you owe them.</p>
        </div>
        <div className="flex items-center gap-2">
          <OutboxButton />
          <button onClick={() => setCreateOpen(true)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-user-plus mr-1" aria-hidden />New partner</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <i className={`ph-bold ${t.icon}`} aria-hidden /> {t.label}
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
              <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-trophy text-amber-500" aria-hidden /> Top partners</p>
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
                <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-hand-coins text-amber-600" aria-hidden /> Payout queue</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600">{money(owed)}</p>
                <p className="text-xs text-muted-foreground">{newRequests} request{newRequests === 1 ? '' : 's'} awaiting your review</p>
                <button type="button" onClick={() => setTab('payouts')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                  Review payouts <i className="ph-bold ph-arrow-right" aria-hidden />
                </button>
              </div>
              {pending.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user-list text-primary" aria-hidden /> {pending.length} pending application{pending.length === 1 ? '' : 's'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">New partners waiting for approval.</p>
                  <button type="button" onClick={() => setTab('rules')} className="mt-3 text-xs font-semibold text-primary hover:underline">Review applications →</button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'partners' && <PartnersTab partners={partners} tierRows={tierRows} overrides={tierOverrides} onToggle={setPartnerStatus} onSelect={setSelectedId} onSetTier={setPartnerTier} />}
      {tab === 'payouts' && <PayoutsTab payouts={payouts} onAction={setPayoutStatus} />}
      {tab === 'rules' && (
        <RulesTab rules={rules} setRules={setRules} tierRows={tierRows} setTierRows={setTierRows} applications={pending} onToggle={setPartnerStatus}
          onSaveRules={realMode ? saveRules : undefined} onSaveTiers={realMode ? saveTiers : undefined}
          rulesDirty={rulesDirty} tiersDirty={tiersDirty} />
      )}

      <PartnerDrawer partner={selected} payouts={payouts} tierRows={tierRows} onToggle={setPartnerStatus} onClose={() => setSelectedId(null)} />
      {createOpen && <PartnerCreateModal realMode={realMode} onCreated={() => router.refresh()} onClose={() => setCreateOpen(false)} />}
    </section>
  );
}
