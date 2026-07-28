import {
  ORDERS, AUDIT, STAFF, ORDER_EXTRA, SERVICE_INCLUDED, customerByCompany, type AdminOrder,
} from '@/data/adminMock';
import type { OrderDetailProps } from '@/app/admin/orders/[id]/OrderDetailClient';

const seqMap = new Map(
  [...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const),
);
const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize' };

/** Real order_details (inc-5b) + order_addons (inc-5c) read RLS-scoped from the DB and passed in.
 *  addons are money → empty for money-blind viewers (RLS), so the upsell block won't render for them. */
export type OrderDetailExtra = {
  project: string | null; folder: string | null;
  brief: { label: string; value: string; full?: boolean }[]; included: string[];
  addons: { name: string; tier: string; price: number }[];
};

/**
 * Build the full prop set the order-detail surface needs.
 * Accepts either a mock order id (legacy/mock surfaces still pass a string → looked up in ORDERS) or
 * a real AdminOrder object (Lane A inc-3). `detail` is the real order_details row (inc-5b) when the
 * caller fetched it (server pages); when absent (mock surfaces, slide-overs) the brief/project/folder/
 * included fall back to mock ORDER_EXTRA then derived defaults. addons/bundle stay mock (deferred —
 * addons carry money). Returns null when a string id is unknown.
 */
// Pull the first real domain the customer submitted from their brief — prefer an explicit
// website/URL/target/domain/project field, else scan any field's value for a domain token. Shared so the
// review board + assignment queue derive the same real site (not the customer's email host).
export function domainFromBrief(brief: { label: string; value: string }[]): string | null {
  const preferred = brief.filter((b) => /website|url|target|site|domain|project/i.test(b.label));
  for (const b of [...preferred, ...brief]) {
    const m = b.value.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
    if (m && /\.[a-z]{2,}$/i.test(m[1])) return m[1].toLowerCase();
  }
  return null;
}

/** Position of this order in the real, newest-first list — supplied by callers that have it. */
export type OrderNav = { seq: number; prev?: { id: string; code: string }; next?: { id: string; code: string } };

/** Build the real nav for `orderId` from the real order list. Callers with getOrders() should use this. */
export function orderNavFrom(allOrders: readonly AdminOrder[], orderId: string): OrderNav | undefined {
  const asc = [...allOrders].sort((a, b) => a.created.localeCompare(b.created));
  const seq = asc.findIndex((o) => o.id === orderId) + 1; // 0 when absent
  const desc = [...allOrders].sort((a, b) => b.created.localeCompare(a.created));
  const i = desc.findIndex((o) => o.id === orderId);
  if (i < 0) return undefined;
  return {
    seq,
    prev: i > 0 ? { id: desc[i - 1].id, code: desc[i - 1].code } : undefined,
    next: i < desc.length - 1 ? { id: desc[i + 1].id, code: desc[i + 1].code } : undefined,
  };
}

export function buildOrderDetailProps(orderOrId: string | AdminOrder, detail?: OrderDetailExtra | null, nav?: OrderNav): OrderDetailProps | null {
  const order = typeof orderOrId === 'string' ? ORDERS.find((o) => o.id === orderOrId) : orderOrId;
  if (!order) return null;

  // Real seq when the caller supplied nav. seqMap is keyed by the adminMock order ids, so a real UUID
  // always missed and every real order rendered as "#0" — while /admin/orders, which builds its own seq
  // from the real list, showed the same order as "#5".
  const seq = nav?.seq ?? seqMap.get(order.id) ?? 0;
  const c = customerByCompany(order.customer);
  const extra = ORDER_EXTRA[order.id];
  const emailSite = c?.email.split('@')[1] ?? `${order.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const project = detail?.project ?? extra?.project ?? `${order.customer} — SEO program`;
  const folder = detail?.folder ?? extra?.folder ?? 'General';
  const included = (detail?.included?.length ? detail.included : undefined) ?? extra?.included ?? SERVICE_INCLUDED[order.service] ?? [];
  const brief = (detail?.brief?.length ? detail.brief : undefined) ?? extra?.brief ?? [
    { label: 'Website', value: `https://${emailSite}` },
    { label: 'Goal', value: 'Improve organic visibility' },
    { label: 'Market', value: 'US · English' },
  ];
  // The site/target-URL come from what the CUSTOMER actually submitted (their website / target URL /
  // project domain in the brief), not their email domain — only fall back to the email host if the brief
  // carries no domain.
  const site = domainFromBrief(brief) ?? emailSite;
  // Real addons when the detail was fetched (admin/customer; empty for money-blind via RLS); else mock.
  const addons = detail ? detail.addons : (extra?.addons ?? []);
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
  //
  // The mock fallback below is guarded on idx >= 0 now. It wasn't: findIndex on the adminMock ORDERS
  // with a real UUID returns -1, and `-1 < ordered.length - 1` is TRUE — so `next` became ordered[0],
  // the newest MOCK order, and the '›' caret on every real order linked to /admin/orders/o8, which the
  // real getOrderById rejects → 404. Callers that can pass real nav (they have getOrders()) should.
  const ordered = [...ORDERS].sort((a, b) => b.created.localeCompare(a.created));
  const idx = ordered.findIndex((o) => o.id === order.id);
  const prev = nav ? nav.prev : idx > 0 ? { id: ordered[idx - 1].id, code: ordered[idx - 1].code } : undefined;
  const next = nav ? nav.next : idx >= 0 && idx < ordered.length - 1 ? { id: ordered[idx + 1].id, code: ordered[idx + 1].code } : undefined;

  const cust = c ? { id: c.id, name: c.name, email: c.email, status: c.status, tier: c.tier, spend: c.spend, orders: c.orders, balance: c.balance } : undefined;

  return {
    order: { id: order.id, seq, code: order.code, customer: order.customer, service: order.service, pkg: order.pkg, status: order.status, priority: order.priority, source: order.source, value: order.value, staff: order.staff, deadline: order.deadline, created: order.created },
    cust, site, today: new Date().toISOString().slice(0, 10),
    project, folder,
    included, brief, addons, addonsTotal, bundle,
    eligibleStaff, initialActivity, prev, next,
  };
}
