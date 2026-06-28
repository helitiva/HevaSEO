import {
  ORDERS, CUSTOMERS, CUSTOMER_EXTRA, CUSTOMER_LEDGER, TIER, SLA_LIMIT_H,
  type AdminCustomer, type AdminTicket,
} from '@/data/adminMock';
import { mockTodayDate, mockTodayAt } from '@/lib/today';

// Fixed "now" so the mock SLA math is deterministic in the demo.
const NOW = mockTodayAt('14:00:00');
const TODAY = mockTodayDate();
const hoursSince = (iso: string) => (NOW.getTime() - new Date(iso).getTime()) / 3_600_000;
const daysSince = (iso: string) => Math.round((TODAY.getTime() - new Date(iso).getTime()) / 86_400_000);
const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };
const STATUS_RANK: Record<string, number> = { open: 0, pending: 1, resolved: 2, closed: 3 };

const fmtLeft = (h: number) => {
  if (h <= 0) return `${Math.round(-h)}h over`;
  if (h < 1) return `${Math.round(h * 60)}m left`;
  return `${Math.round(h)}h left`;
};

// Project each ticket is filed under (mirrors how orders are filed by project/folder elsewhere).
const TICKET_PROJECT: Record<string, string> = {
  t1: 'Acme · Main site',
  t2: 'Nova · Brand SEO',
  t3: 'Vertex · Q3 Entity push',
  t4: 'Peak · UK Launch',
  t5: 'Orbit · Account & billing',
  t6: 'Vértice · Web performance',
  t7: 'Lumen · New site launch',
  t8: 'Pulse · Account & billing',
  t9: 'Cobalt · Link building',
  t10: 'Acme · Content program',
};

// Full customer dossier shown in the slide-over panel.
function custFullOf(c: AdminCustomer) {
  const extra = CUSTOMER_EXTRA[c.id] ?? { phone: '—', timezone: '—', memberSince: '2025-01-01', tags: [TIER[c.tier].label] };
  const cOrders = ORDERS.filter((o) => o.customer === c.company);
  const recentOrders = cOrders.slice().sort((a, b) => b.created.localeCompare(a.created)).slice(0, 5)
    .map((o) => ({ id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status, value: o.value, created: o.created }));
  const ledger = (CUSTOMER_LEDGER[c.id] ?? cOrders.map((o) => ({ at: o.created, delta: -o.value, reason: `${o.code} confirmed` }))).slice(0, 5);
  return {
    id: c.id, name: c.name, company: c.company, email: c.email, status: c.status, tier: c.tier,
    phone: extra.phone, timezone: extra.timezone, memberSince: extra.memberSince, tags: extra.tags,
    spend: c.spend, orders: c.orders, balance: c.balance,
    aov: c.orders ? Math.round(c.spend / c.orders) : 0,
    activeOrders: cOrders.filter((o) => !['completed', 'canceled'].includes(o.status)).length,
    lastActive: c.lastActive, churnDays: daysSince(c.lastActive),
    recentOrders, ledger,
  };
}

// Shared by the admin Tickets page and the manager (pod-scoped) one.
export function buildTicketRows(tickets: readonly AdminTicket[]) {
  return tickets.map((t) => {
    const c = t.customerId ? CUSTOMERS.find((x) => x.id === t.customerId) ?? null : null;
    const order = t.orderCode ? ORDERS.find((o) => o.code === t.orderCode) ?? null : null;
    const last = t.thread[t.thread.length - 1];
    const waitingOnUs = last?.from === 'customer' && (t.status === 'open' || t.status === 'pending');
    const waited = hoursSince(t.lastReplyAt);
    const slaLeft = SLA_LIMIT_H[t.slaTier] - waited;
    const breached = waitingOnUs && slaLeft <= 0;
    return {
      ...t,
      cust: c
        ? {
            id: c.id, name: c.name, company: c.company, email: c.email, tier: c.tier,
            spend: c.spend, orders: c.orders, balance: c.balance,
            memberSince: CUSTOMER_EXTRA[c.id]?.memberSince ?? null,
          }
        : null,
      custFull: c ? custFullOf(c) : null,
      project: TICKET_PROJECT[t.id] ?? 'General',
      order: order ? { id: order.id, code: order.code, service: order.service, pkg: order.pkg, value: order.value } : null,
      waitingOnUs, breached, slaLeftLabel: fmtLeft(slaLeft),
    };
  }).sort((a, b) =>
    (Number(b.breached) - Number(a.breached)) ||
    (STATUS_RANK[a.status] - STATUS_RANK[b.status]) ||
    (PRI_RANK[a.priority] - PRI_RANK[b.priority]) ||
    new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime(),
  );
}
