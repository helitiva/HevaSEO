import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkBar } from '@/components/affiliate/LinkBar';
import { KpiCards } from '@/components/affiliate/KpiCards';
import { TierProgress } from '@/components/affiliate/TierProgress';
import { EarningsChart } from '@/components/affiliate/EarningsChart';
import { ConversionFunnel } from '@/components/affiliate/ConversionFunnel';
import { ReferralsTable } from '@/components/affiliate/ReferralsTable';
import { CommissionLedger } from '@/components/affiliate/CommissionLedger';
import { AssetsGrid } from '@/components/affiliate/AssetsGrid';
import { RankCard, ChallengeCard, StreakCard } from '@/components/affiliate/MomentumCards';
import { ActivityPulse } from '@/components/affiliate/ActivityPulse';
import { HowItWorks } from '@/components/affiliate/HowItWorks';
import { rollupKpis, monthlySeries, funnelStats, earningStreak, projectMonth } from '@/lib/affiliate';
import { portalDataFor } from '@/data/affiliatePortal';
import { currentAffiliateId } from '@/lib/currentAffiliate';
import { MOCK_TODAY } from '@/lib/today';

export const metadata: Metadata = { title: 'Affiliate overview' };

// Phase-0 mock anchor for "today" so run-rate/projection reads consistently.
const TODAY = MOCK_TODAY;

// Section anchor with a "view all" link to the deeper sub-page.
function SectionHead({ title, icon, href, cta }: { title: string; icon: string; href?: string; cta?: string }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight"><i className={`ph-bold ${icon} text-primary`} /> {title}</h2>
      {href && <Link href={href} className="text-xs font-semibold text-primary hover:underline">{cta} →</Link>}
    </div>
  );
}

export default async function AffiliateOverviewPage() {
  const { affiliate: me, referrals, events, clicks, payouts } = portalDataFor(await currentAffiliateId());

  const kpis = rollupKpis(referrals, events, clicks);
  const series = monthlySeries(events);
  const funnel = funnelStats({ clicks, referrals });
  const lifetimeVolume = kpis.totalVolume;
  const streak = earningStreak(events);
  const projected = projectMonth(kpis.commissionThisMonth, TODAY);

  // Layout adapts to where the partner is: a brand-new partner (no referrals yet)
  // has no momentum to celebrate, so the share link is the hero. Once referrals
  // land, the momentum + stats earn the top spot and the link drops below.
  const hasReferrals = referrals.length > 0;
  const firstName = me.name.split(' ')[0];

  if (!hasReferrals) {
    return (
      <section>
        <PageHeader
          title={`Welcome, ${firstName} 👋`}
          subtitle="You're one share away from your first referral. Here's your link."
        />

        {/* Link is the hero until the first referral lands */}
        <LinkBar code={me.code} />

        <SectionHead title="How it works" icon="ph-path" />
        <HowItWorks />

        {/* What they can earn — the tier ladder at zero volume */}
        <SectionHead title="What you can earn" icon="ph-crown-simple" />
        <TierProgress lifetimeVolume={lifetimeVolume} />

        {/* Give them something to share right now */}
        <SectionHead title="Start promoting" icon="ph-megaphone" href="/affiliate/assets" cta="All assets" />
        <AssetsGrid limit={4} />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Share your link, grow your referrals, earn on every order they place."
      />

      {/* Momentum row — rank · time-boxed challenge · streak (FOMO, top of page) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <RankCard />
        <ChallengeCard />
        <StreakCard streak={streak} projected={projected} />
      </div>

      {/* KPIs */}
      <div className="mt-4"><KpiCards k={kpis} /></div>

      {/* Link & code — still high, but below the momentum once it exists */}
      <div className="mt-4"><LinkBar code={me.code} /></div>

      {/* Tier progress & funnel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TierProgress lifetimeVolume={lifetimeVolume} />
        <ConversionFunnel stages={funnel} />
      </div>

      {/* Earnings chart + live activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><EarningsChart data={series} /></div>
        <ActivityPulse />
      </div>

      {/* Referrals preview */}
      <SectionHead title="Your referrals" icon="ph-users-three" href="/affiliate/referrals" cta="View all" />
      <ReferralsTable referrals={referrals} lifetimeVolume={lifetimeVolume} limit={5} />

      {/* Commission & payouts summary */}
      <SectionHead title="Commission & payouts" icon="ph-wallet" href="/affiliate/payouts" cta="See ledger" />
      <CommissionLedger events={events} payouts={payouts} payoutLabel={me.payoutLabel} compact />

      {/* Marketing assets preview */}
      <SectionHead title="Promote HevaSEO" icon="ph-megaphone" href="/affiliate/assets" cta="All assets" />
      <AssetsGrid limit={4} />
    </section>
  );
}
