import { Suspense } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { OrdersProvider } from '@/components/OrdersStore';
import { CreditProvider } from '@/components/CreditStore';
import { ProjectsProvider } from '@/components/ProjectsStore';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { QuickOrderPanel } from '@/components/QuickOrderPanel';
import { ToastProvider } from '@/components/Toast';
import { getMyCredit } from '@/data/credit.server';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { balance, transactions } = await getMyCredit(); // RLS-scoped: signed-in customer's own credit
  return (
    <ToastProvider>
      <CreditProvider initialBalance={balance} initialTransactions={transactions}>
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
    </ToastProvider>
  );
}
