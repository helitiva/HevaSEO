import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AffiliateAdminClient } from '@/components/admin/affiliate/AffiliateAdminClient';
import { getAffiliates, getAffiliatePayouts } from '@/data/adminAffiliate.server';

export const metadata: Metadata = { title: 'Affiliates' };

// Lane E inc-E3 — real affiliate directory + payout queue (admin RLS); resolve via resolve_affiliate_payout.
export default async function AdminAffiliatePage() {
  const [partners, payouts] = await Promise.all([getAffiliates(), getAffiliatePayouts()]);
  return (
    <Suspense fallback={null}>
      <AffiliateAdminClient realPartners={partners} realPayouts={payouts} />
    </Suspense>
  );
}
