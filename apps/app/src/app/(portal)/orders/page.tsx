import { OrdersBoard } from '@/components/OrdersBoard';
import { OrdersSummary } from '@/components/OrdersSummary';
import { QuickOrderButton } from '@/components/QuickOrderButton';

export const metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all service orders · payments · invoices</p>
        </div>
        <QuickOrderButton />
      </div>
      <section className="mt-6">
        <OrdersSummary />
      </section>
      <section className="mt-5">
        <OrdersBoard />
      </section>
    </>
  );
}
