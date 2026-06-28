import { Suspense } from 'react';
import { FinanceClient } from '@/components/admin/finance/FinanceClient';

export const metadata = { title: 'Finance' };

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinanceClient />
    </Suspense>
  );
}
