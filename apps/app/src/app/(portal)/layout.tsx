import { Suspense } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { OrdersProvider } from '@/components/OrdersStore';
import { OrderDetailPanel } from '@/components/OrderDetailPanel';
import { ToastProvider } from '@/components/Toast';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <OrdersProvider>
        <PortalShell>{children}</PortalShell>
        <Suspense fallback={null}>
          <OrderDetailPanel />
        </Suspense>
      </OrdersProvider>
    </ToastProvider>
  );
}
