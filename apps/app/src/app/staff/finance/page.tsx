import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { ViewOnlyGuard } from '@/components/staff/ViewOnlyGuard';
import { FinanceClient } from './FinanceClient';
import { myEarnings, earningsHistory, myEarningsSummary, myFinance, myRewards } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { getMyStaffWallet } from '@/data/staffWallet.server';
import { payslipsToEarnings } from '@/data/staffPayroll';

export const metadata = { title: 'Finance' };

// The staffer's own money: commission wallet, payout requests, and penalties — built on the
// money-leak-safe staffMock layer (commission/base/bonus only; customer pricing never crosses).
// Renders for the impersonated staffer when an admin is impersonating (else the demo staffer).
export default async function FinancePage() {
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  // Real DB wallet for the signed-in staffer (null → mock fallback for demo/impersonation/never-paid).
  const realWallet = await getMyStaffWallet();
  // Payroll is the source of truth for staff pay. When the signed-in staffer has real payroll runs, the
  // hero card + earnings chart + YTD come from them (the same runs the Payslips tab already shows), so
  // every number on the page is real and consistent. No commission is minted into the wallet.
  const realPay = realWallet ? payslipsToEarnings(realWallet.payslips) : null;
  const earnings = realPay?.earnings ?? myEarnings(sid);

  if (!earnings || !me) {
    return (
      <section>
        <PageHeader title="Finance" subtitle="Your wallet, payouts & penalties" />
        <EmptyState kind="new-hire" />
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Finance" subtitle="Your commission wallet, payouts, and penalties — your pay only" />
      <ViewOnlyGuard>
        <FinanceClient
          earnings={earnings}
          history={realPay?.history ?? earningsHistory(sid)}
          summary={realPay?.summary ?? myEarningsSummary(sid)}
          finance={myFinance(sid)}
          rewards={myRewards(sid)}
          firstPassRate={me.quality}
          realWallet={realWallet}
        />
      </ViewOnlyGuard>
    </section>
  );
}
