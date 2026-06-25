import { Suspense } from 'react';
import { FinanceClient } from '@/components/admin/finance/FinanceClient';

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinanceClient />
    </Suspense>
  );
}
