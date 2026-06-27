import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { FinanceClient } from './FinanceClient';
import { myEarnings, earningsHistory, myEarningsSummary, myFinance, myRewards } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';

// The staffer's own money: commission wallet, payout requests, and penalties — built on the
// money-leak-safe staffMock layer (commission/base/bonus only; customer pricing never crosses).
// Renders for the impersonated staffer when an admin is impersonating (else the demo staffer).
export default async function FinancePage() {
  const sid = await currentStaffId();
  const earnings = myEarnings(sid);
  const me = STAFF.find((s) => s.id === sid);

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
      <FinanceClient
        earnings={earnings}
        history={earningsHistory(sid)}
        summary={myEarningsSummary(sid)}
        finance={myFinance(sid)}
        rewards={myRewards(sid)}
        firstPassRate={me.quality}
      />
    </section>
  );
}
