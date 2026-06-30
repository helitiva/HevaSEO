import { Suspense } from 'react';
import { FinanceClient } from '@/components/admin/finance/FinanceClient';
import { getPayoutRequests } from '@/data/adminPayouts.server';
import { getPenalties, getWalletStaff } from '@/data/adminPenalties.server';

export const metadata = { title: 'Finance' };

export default async function FinancePage() {
  // real staff money-ops (Lane D inc-D4/D5): withdrawal requests + penalties + workers who have a wallet
  const [payoutRequests, penalties, walletStaff] = await Promise.all([
    getPayoutRequests(), getPenalties(), getWalletStaff(),
  ]);
  return (
    <Suspense fallback={null}>
      <FinanceClient payoutRequests={payoutRequests} penalties={penalties} walletStaff={walletStaff} />
    </Suspense>
  );
}
