import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/PageHeader';
import { CommissionLedger } from '@/components/affiliate/CommissionLedger';
import { portalDataFor } from '@/data/affiliatePortal';
import { getAffiliatePortalData } from '@/data/affiliate.server';
import { currentAffiliateId } from '@/lib/currentAffiliate';
import { nextTierUpside, tierFor } from '@/lib/affiliate';
import { money } from '@/data/adminMock';

export const metadata: Metadata = { title: 'Payouts' };

export default async function PayoutsPage() {
  // Lane E inc-E2 — real affiliate data (+ withdrawable balance) with mock fallback for impersonation.
  const real = await getAffiliatePortalData(); // own, or the impersonated partner (admin), else null
  const { affiliate: me, referrals, events, payouts } = real ?? portalDataFor(await currentAffiliateId());
  const lifetimeVolume = referrals.reduce((s, r) => s + r.volume, 0);
  const pending = events.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const { next } = nextTierUpside(lifetimeVolume);
  const rate = tierFor(lifetimeVolume).rate;

  return (
    <section>
      <PageHeader
        title="Commission & payouts"
        subtitle="Your full commission ledger and withdrawal history."
      />

      {next && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-sm">
          <i className="ph-fill ph-rocket-launch text-emerald-600" aria-hidden />
          <span>
            <b>{money(pending)}</b> is clearing now. Reach <b>{next.label}</b> and your next orders pay{' '}
            <b className="text-emerald-600">{Math.round(next.rate * 100)}%</b> instead of {Math.round(rate * 100)}% — bigger payouts, same effort.
          </span>
        </div>
      )}

      <CommissionLedger events={events} payouts={payouts} payoutLabel={me.payoutLabel} balance={real?.balance} />
    </section>
  );
}
