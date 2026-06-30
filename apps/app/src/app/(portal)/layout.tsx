import { Suspense } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { OrdersProvider } from '@/components/OrdersStore';
import { CreditProvider } from '@/components/CreditStore';
import { ProjectsProvider } from '@/components/ProjectsStore';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { QuickOrderPanel } from '@/components/QuickOrderPanel';
import { ToastProvider } from '@/components/Toast';
import { BroadcastProvider } from '@/components/broadcast/BroadcastProvider';
import { getMyCredit } from '@/data/credit.server';
import { getMyBroadcasts } from '@/data/broadcasts.server';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [{ balance, transactions, invoices }, broadcasts] = await Promise.all([
    getMyCredit(), // RLS-scoped: signed-in customer's own credit
    getMyBroadcasts(), // RLS-scoped: real broadcasts for the customer audience (Lane C inc-C4)
  ]);
  return (
    <ToastProvider>
      <BroadcastProvider broadcasts={broadcasts}>
      <CreditProvider initialBalance={balance} initialTransactions={transactions} initialInvoices={invoices}>
        <ProjectsProvider>
        <OrdersProvider>
          <PortalShell>{children}</PortalShell>
          <Suspense fallback={null}>
            <OrderDetailPanel />
          </Suspense>
          <Suspense fallback={null}>
            <QuickOrderPanel />
          </Suspense>
        </OrdersProvider>
        </ProjectsProvider>
      </CreditProvider>
      </BroadcastProvider>
    </ToastProvider>
  );
}
