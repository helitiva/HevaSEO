import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReferralsTable } from '@/components/affiliate/ReferralsTable';
import { portalDataFor } from '@/data/affiliatePortal';
import { getAffiliatePortalData } from '@/data/affiliate.server';
import { currentAffiliateId } from '@/lib/currentAffiliate';

export const metadata: Metadata = { title: 'Referrals' };

export default async function ReferralsPage() {
  // Lane E inc-E11 — real referrals (RLS-scoped) with mock fallback for impersonation/demo personas,
  // matching the dash + payouts pages (was mock-only).
  const real = await getAffiliatePortalData();
  const { referrals } = real ?? portalDataFor(await currentAffiliateId());
  const lifetimeVolume = referrals.reduce((s, r) => s + r.volume, 0);
  const slipping = referrals.filter((r) => r.status === 'churned');

  return (
    <section>
      <PageHeader
        title="Referrals"
        subtitle="Every customer who signed up through your link — and what they've earned you."
      />

      {slipping.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
            <i className="ph-fill ph-warning-octagon" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">{slipping.length} referral{slipping.length > 1 ? 's are' : ' is'} slipping away</p>
            <p className="text-xs text-muted-foreground">
              {slipping.map((r) => r.customer).join(', ')} signed up but {slipping.length > 1 ? "haven't" : "hasn't"} ordered.
              A quick nudge now protects the commission you&apos;d earn for life — every order they place pays you, forever.
            </p>
          </div>
        </div>
      )}

      <ReferralsTable referrals={referrals} lifetimeVolume={lifetimeVolume} tiers={real?.tiers} />
    </section>
  );
}
