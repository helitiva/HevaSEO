import Link from 'next/link';
import { OrdersBoard } from '@/components/OrdersBoard';
import { DashboardTop } from '@/components/DashboardTop';
import { SpecialistChat } from '@/components/SpecialistChat';
import { QuickOrderButton } from '@/components/QuickOrderButton';
import { DeliveredReview } from '@/components/DeliveredReview';
import { ACTIVITY } from '@/data/mock';
import { getMyOrders, getMyDeliveredOrders } from '@/data/orders.server';
import { getMyActivity } from '@/data/activity.server';

export const metadata = { title: 'Overview' };

export default async function DashboardPage() {
  const [orders, delivered, realActivity] = await Promise.all([getMyOrders(), getMyDeliveredOrders(), getMyActivity()]); // RLS-scoped
  const activity = realActivity.length ? realActivity : ACTIVITY; // real feed; mock only when there's none yet

  return (
    <>
      <DashboardTop realOrders={orders} today={new Date().toISOString()} />

      {delivered.length > 0 && (
        <section className="mt-5">
          <DeliveredReview orders={delivered} />
        </section>
      )}

      {/* ORDERS */}
      <section className="mt-5">
        <OrdersBoard orders={orders} />
      </section>

      {/* ACTIVITY + SPECIALIST */}
      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg font-semibold tracking-tight">Recent activity</h2>
            <button className="text-xs font-semibold text-primary hover:underline">All</button>
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {activity.map((a, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><i className={`ph-bold ${a.icon}`} /></span>
                <div>
                  <p className="text-sm" dangerouslySetInnerHTML={{ __html: a.html }} />
                  <p className="text-[11px] text-muted-foreground">{a.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="display text-lg font-semibold tracking-tight">Your specialist</h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">OC</span>
            <div>
              <p className="font-semibold">Olivia Chen</p>
              <p className="text-xs text-muted-foreground">SEO Lead · replies &lt; 2h</p>
            </div>
          </div>
          <SpecialistChat className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90" />
          <div className="mt-3 grid gap-2">
            <QuickOrderButton label="Create new order" icon="ph-plus text-primary" className="flex items-center gap-2 rounded-lg border border-border py-2 pl-3 text-sm font-medium transition hover:bg-accent" />
            <Link href="/credit" className="flex items-center gap-2 rounded-lg border border-border py-2 pl-3 text-sm font-medium transition hover:bg-accent"><i className="ph-bold ph-wallet text-primary" aria-hidden /> Top up credits</Link>
          </div>
        </div>
      </section>
    </>
  );
}
