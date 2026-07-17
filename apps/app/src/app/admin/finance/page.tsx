import { Suspense } from 'react';
import { FinanceClient } from '@/components/admin/finance/FinanceClient';
import { getPayoutRequests } from '@/data/adminPayouts.server';
import { getPenalties, getWalletStaff } from '@/data/adminPenalties.server';
import { getPayrollRuns } from '@/data/adminPayroll.server';
import { getPayrollPreview } from '@/data/adminComp.server';

export const metadata = { title: 'Finance' };

export default async function FinancePage() {
  // real staff money-ops (Lane D inc-D4/D5/D7): withdrawals + penalties + payroll runs + wallet-holders,
  // plus the real comp config + what this period owes (commission on ASC 606 delivered value).
  const [payoutRequests, penalties, walletStaff, payrollRuns, compPreview] = await Promise.all([
    getPayoutRequests(), getPenalties(), getWalletStaff(), getPayrollRuns(), getPayrollPreview(),
  ]);
  return (
    <Suspense fallback={null}>
      <FinanceClient payoutRequests={payoutRequests} penalties={penalties} walletStaff={walletStaff}
        payrollRuns={payrollRuns} compPreview={compPreview} />
    </Suspense>
  );
}
