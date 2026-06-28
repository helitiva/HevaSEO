import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AffiliateAdminClient } from '@/components/admin/affiliate/AffiliateAdminClient';

export const metadata: Metadata = { title: 'Affiliates' };

export default function AdminAffiliatePage() {
  return (
    <Suspense fallback={null}>
      <AffiliateAdminClient />
    </Suspense>
  );
}
