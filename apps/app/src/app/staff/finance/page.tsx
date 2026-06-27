import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/staff/EmptyState';
import { FinanceClient } from './FinanceClient';
import { myEarnings, earningsHistory, myEarningsSummary, myFinance, myRewards, CURRENT_STAFF } from '@/data/staffMock';
import { STAFF } from '@/data/adminMock';

// The staffer's own money: commission wallet, payout requests, and penalties — built on the
// money-leak-safe staffMock layer (commission/base/bonus only; customer pricing never crosses).
export default function FinancePage() {
  const earnings = myEarnings();
  const me = STAFF.find((s) => s.id === CURRENT_STAFF.id);

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
        history={earningsHistory()}
        summary={myEarningsSummary()}
        finance={myFinance()}
        rewards={myRewards()}
        firstPassRate={me.quality}
      />
    </section>
  );
}
