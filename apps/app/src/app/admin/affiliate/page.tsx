import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AffiliateAdminClient } from '@/components/admin/affiliate/AffiliateAdminClient';
import { getAffiliates, getAffiliatePayouts, getAffiliateProgramConfig } from '@/data/adminAffiliate.server';

export const metadata: Metadata = { title: 'Affiliates' };

// Lane E inc-E3/E7 — real affiliate directory + payout queue (admin RLS) + program config (Rules tab).
export default async function AdminAffiliatePage() {
  const [partners, payouts, config] = await Promise.all([
    getAffiliates(), getAffiliatePayouts(), getAffiliateProgramConfig(),
  ]);
  return (
    <Suspense fallback={null}>
      <AffiliateAdminClient realPartners={partners} realPayouts={payouts} realConfig={config} />
    </Suspense>
  );
}
