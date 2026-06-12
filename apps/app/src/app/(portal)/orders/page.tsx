import { OrdersBoard } from '@/components/OrdersBoard';

export const metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      <div>
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage all service orders · payments · invoices</p>
      </div>
      <section className="mt-6">
        <OrdersBoard />
      </section>
    </>
  );
}
