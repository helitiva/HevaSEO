import { PageHeader } from '@/components/shared/PageHeader';
import { FinanceClient } from '@/app/staff/finance/FinanceClient';
import {
  managerEarnings, managerEarningsHistory, managerEarningsSummary, managerFinance,
} from '@/data/managerFinance';
import { MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'Finance' };

// The manager's OWN pay: salary + an override on the pod's gig pay + commission, with a wallet and
// payout flow — mirrors /staff/finance and reuses its client. Managers have NO KPI bonus section
// (showRewards={false}) and stay money-blind to OTHERS' money (pod/customer/staff figures never show).
export default function ManagerFinancePage() {
  const mid = MANAGER_PERSONA;
  const earnings = managerEarnings(mid);

  if (!earnings) {
    return (
      <section>
        <PageHeader title="Finance" subtitle="Your salary, pod commission & payouts" />
        <p className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No compensation profile yet.
        </p>
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Finance" subtitle="Your salary, pod-override commission, and payouts — your pay only" />
      <FinanceClient
        earnings={earnings}
        history={managerEarningsHistory(mid)}
        summary={managerEarningsSummary(mid)}
        finance={managerFinance(mid)}
        firstPassRate={88}
        showRewards={false}
        payStyle="manager"
      />
    </section>
  );
}
