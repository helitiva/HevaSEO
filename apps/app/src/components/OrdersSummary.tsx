'use client';

import { ORDERS, STATUSES, type Order, type OrderStatus } from '@/data/mock';
import { useOrdersStore } from './OrdersStore';

const COLS: OrderStatus[] = ['planned', 'progress', 'review', 'completed'];

/** Compact status summary above the orders board. */
export function OrdersSummary() {
  const { addedOrders, statusOverrides } = useOrdersStore();
  const all = [...addedOrders, ...ORDERS];
  const statusOf = (o: Order): OrderStatus => statusOverrides[o.id] ?? o.status;
  const count = (s: OrderStatus) => all.filter((o) => statusOf(o) === s).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="col-span-2 rounded-2xl border border-border bg-card p-4 sm:col-span-1">
        <p className="text-xs font-medium text-muted-foreground">Total orders</p>
        <p className="display mt-1 text-2xl font-semibold tracking-tight">{all.length}</p>
      </div>
      {COLS.map((s) => {
        const c = STATUSES[s].color;
        return (
          <div key={s} className="rounded-2xl border border-border bg-card p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} /> {STATUSES[s].label}</p>
            <p className="display mt-1 text-2xl font-semibold tracking-tight" style={{ color: c }}>{count(s)}</p>
          </div>
        );
      })}
    </div>
  );
}
