import {
  ORDERS, AUDIT, STAFF, ORDER_EXTRA, SERVICE_INCLUDED, customerByCompany, type AdminOrder,
} from '@/data/adminMock';
import type { OrderDetailProps } from '@/app/admin/orders/[id]/OrderDetailClient';

const seqMap = new Map(
  [...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
);
const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize' };

/**
 * Build the full prop set the order-detail surface needs.
 * Accepts either a mock order id (legacy/mock surfaces still pass a string → looked up in ORDERS) or
 * a real AdminOrder object (Lane A inc-3: the order is fetched RLS-scoped, then passed in). For real
 * orders the mock-keyed enrichment (ORDER_EXTRA, AUDIT, bundle, prev/next) gracefully falls back to
 * derived defaults until those companion tables are seeded. Returns null when a string id is unknown.
 * Shared by /admin/orders/[id] and any inline preview (slide-over) so both render identical detail.
 */
export function buildOrderDetailProps(orderOrId: string | AdminOrder): OrderDetailProps | null {
  const order = typeof orderOrId === 'string' ? ORDERS.find((o) => o.id === orderOrId) : orderOrId;
  if (!order) return null;

  const seq = seqMap.get(order.id) ?? 0;
  const c = customerByCompany(order.customer);
  const site = c?.email.split('@')[1] ?? `${order.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const extra = ORDER_EXTRA[order.id];
  const project = extra?.project ?? `${order.customer} — SEO program`;
  const folder = extra?.folder ?? 'General';
  const included = extra?.included ?? SERVICE_INCLUDED[order.service] ?? [];
  const brief = extra?.brief ?? [
    { label: 'Website', value: `https://${site}` },
    { label: 'Goal', value: 'Improve organic visibility' },
    { label: 'Market', value: 'US · English' },
  ];
  const addons = extra?.addons ?? [];
  const addonsTotal = addons.reduce((s, a) => s + a.price, 0);
  const bundle = (extra?.bundle ?? [])
    .map((bid) => ORDERS.find((o) => o.id === bid))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((b) => ({ id: b.id, code: b.code, service: b.service, pkg: b.pkg, customer: b.customer, value: b.value, status: b.status }));

  // Routing-style suggestion: staff whose skills match the service, ranked by score then lightest load.
  const skill = SKILL_OF[order.service];
  const pool = skill ? STAFF.filter((s) => s.skills.includes(skill)) : [];
  const eligibleStaff = (pool.length ? pool : STAFF)
    .slice()
    .sort((a, b) => b.composite - a.composite || a.openLoad - b.openLoad)
    .map((s) => ({ name: s.name, composite: s.composite, quality: s.quality, onTime: s.onTime, openLoad: s.openLoad, capacity: s.capacity, skills: s.skills }));

  const initialActivity = AUDIT.filter((a) => a.change.startsWith(order.code)).length
    ? AUDIT.filter((a) => a.change.startsWith(order.code))
    : [{ id: 'c', at: `${order.created} 00:00`, action: 'created', change: `${order.code} created` }];

  // Prev / next in the default (newest-first) list order.
  const ordered = [...ORDERS].sort((a, b) => b.created.localeCompare(a.created));
  const idx = ordered.findIndex((o) => o.id === order.id);
  const prev = idx > 0 ? { id: ordered[idx - 1].id, code: ordered[idx - 1].code } : undefined;
  const next = idx < ordered.length - 1 ? { id: ordered[idx + 1].id, code: ordered[idx + 1].code } : undefined;

  const cust = c ? { id: c.id, name: c.name, email: c.email, status: c.status, tier: c.tier, spend: c.spend, orders: c.orders, balance: c.balance } : undefined;

  return {
    order: { id: order.id, seq, code: order.code, customer: order.customer, service: order.service, pkg: order.pkg, status: order.status, priority: order.priority, source: order.source, value: order.value, staff: order.staff, deadline: order.deadline, created: order.created },
    cust, site, today: new Date().toISOString().slice(0, 10),
    project, folder,
    included, brief, addons, addonsTotal, bundle,
    eligibleStaff, initialActivity, prev, next,
  };
}
