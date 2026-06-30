import { Suspense } from 'react';
import { FinanceClient } from '@/components/admin/finance/FinanceClient';
import { getPayoutRequests } from '@/data/adminPayouts.server';

export const metadata = { title: 'Finance' };

export default async function FinancePage() {
  const payoutRequests = await getPayoutRequests(); // real staff withdrawal requests (Lane D inc-D4)
  return (
    <Suspense fallback={null}>
      <FinanceClient payoutRequests={payoutRequests} />
    </Suspense>
  );
}
