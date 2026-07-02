import { OrdersBoard } from '@/components/OrdersBoard';
import { OrdersSummary } from '@/components/OrdersSummary';
import { QuickOrderButton } from '@/components/QuickOrderButton';
import { DeliveredReview } from '@/components/DeliveredReview';
import { getMyDeliveredOrders } from '@/data/orders.server';

export const metadata = { title: 'Orders' };

export default async function OrdersPage() {
  const delivered = await getMyDeliveredOrders(); // RLS-scoped to the signed-in customer's own orders

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all service orders · payments · invoices</p>
        </div>
        <QuickOrderButton />
      </div>
      {delivered.length > 0 && (
        <section className="mt-6">
          <DeliveredReview orders={delivered} />
        </section>
      )}
      <section className="mt-6">
        <OrdersSummary />
      </section>
      <section className="mt-5">
        <OrdersBoard />
      </section>
    </>
  );
}
