// Admin-facing customer signals — the lean dossier shown in the CustomerHoverCard wherever a
// customer name/company appears across admin. Resolves by customer id, company, or contact name
// (orders/tickets store the company string, not the id).
import { CUSTOMERS, CUSTOMER_EXTRA, ORDERS, TICKETS, TIER, type Tier, type OrderStatus } from './adminMock';

const ACTIVE_ORDER = new Set<OrderStatus>(['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);

export function resolveCustomerId(idOrName: string): string | null {
  return CUSTOMERS.find((c) => c.id === idOrName || c.company === idOrName || c.name === idOrName)?.id ?? null;
}

export interface CustomerRecentOrder {
  id: string; code: string; service: string; status: OrderStatus; value: number; created: string;
}
// Share of a customer's orders taken by one service — by BOTH order count and order value.
export interface ServiceMixRow {
  service: string; count: number; value: number; pctCount: number; pctValue: number;
}
// A staffer who handles this customer's work, and which services they cover for them.
export interface StaffCareRow {
  staff: string; count: number; pctCount: number;
  services: { service: string; count: number }[];
}
export interface CustomerSignals {
  id: string; name: string; company: string; email: string;
  status: 'shadow' | 'claimed'; tier: Tier; tierLabel: string;
  orders: number; spend: number; balance: number; lastActive: string;
  phone: string | null; timezone: string | null; memberSince: string | null; tags: string[];
  activeOrders: number; openTickets: number; recent: CustomerRecentOrder[];
  orderCount: number; orderValue: number;     // totals across the order book (not the stored c.orders)
  serviceMix: ServiceMixRow[];
  staffCare: StaffCareRow[];
}

export function customerSignals(idOrName: string): CustomerSignals | null {
  const c = CUSTOMERS.find((x) => x.id === idOrName || x.company === idOrName || x.name === idOrName);
  if (!c) return null;
  const extra = CUSTOMER_EXTRA[c.id];
  const orders = ORDERS.filter((o) => o.customer === c.company);
  const activeOrders = orders.filter((o) => ACTIVE_ORDER.has(o.status)).length;
  const openTickets = TICKETS.filter((t) => (t.customerId === c.id || t.customer === c.company) && (t.status === 'open' || t.status === 'pending')).length;
  const recent = [...orders]
    .sort((a, b) => b.created.localeCompare(a.created))
    .slice(0, 4)
    .map((o) => ({ id: o.id, code: o.code, service: o.service, status: o.status, value: o.value, created: o.created }));

  // ---- Service mix (by order count and by value) ----
  const orderCount = orders.length;
  const orderValue = orders.reduce((a, o) => a + o.value, 0);
  const byService = new Map<string, { count: number; value: number }>();
  for (const o of orders) {
    const cur = byService.get(o.service) ?? { count: 0, value: 0 };
    byService.set(o.service, { count: cur.count + 1, value: cur.value + o.value });
  }
  const serviceMix: ServiceMixRow[] = [...byService.entries()]
    .map(([service, v]) => ({
      service, count: v.count, value: v.value,
      pctCount: orderCount ? Math.round((v.count / orderCount) * 100) : 0,
      pctValue: orderValue ? Math.round((v.value / orderValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || b.count - a.count);

  // ---- Who handles their work (staff + the services they cover for this customer) ----
  const byStaff = new Map<string, Map<string, number>>();
  for (const o of orders) {
    if (!o.staff) continue;
    const svc = byStaff.get(o.staff) ?? new Map<string, number>();
    svc.set(o.service, (svc.get(o.service) ?? 0) + 1);
    byStaff.set(o.staff, svc);
  }
  const assignedCount = orders.filter((o) => o.staff).length;
  const staffCare: StaffCareRow[] = [...byStaff.entries()]
    .map(([staff, svcMap]) => {
      const count = [...svcMap.values()].reduce((a, n) => a + n, 0);
      const services = [...svcMap.entries()]
        .map(([service, n]) => ({ service, count: n }))
        .sort((a, b) => b.count - a.count);
      return { staff, count, pctCount: assignedCount ? Math.round((count / assignedCount) * 100) : 0, services };
    })
    .sort((a, b) => b.count - a.count);

  return {
    id: c.id, name: c.name, company: c.company, email: c.email,
    status: c.status, tier: c.tier, tierLabel: TIER[c.tier].label,
    orders: c.orders, spend: c.spend, balance: c.balance, lastActive: c.lastActive,
    phone: extra?.phone ?? null, timezone: extra?.timezone ?? null, memberSince: extra?.memberSince ?? null, tags: extra?.tags ?? [],
    activeOrders, openTickets, recent,
    orderCount, orderValue, serviceMix, staffCare,
  };
}
