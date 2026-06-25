import { Suspense } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { OrdersProvider } from '@/components/OrdersStore';
import { CreditProvider } from '@/components/CreditStore';
import { ProjectsProvider } from '@/components/ProjectsStore';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { QuickOrderPanel } from '@/components/QuickOrderPanel';
import { ToastProvider } from '@/components/Toast';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CreditProvider>
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
