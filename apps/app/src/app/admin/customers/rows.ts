import { ORDERS, TICKETS, CUSTOMER_EXTRA, TIER, type AdminCustomer } from '@/data/adminMock';
import type { CustomerRow, Health } from './CustomersClient';

const TODAY = new Date('2026-06-25T00:00:00');
const CLOSED = ['completed', 'canceled'];

// Derivation shared by the admin Customers page and the manager (pod-scoped) one.
export function buildCustomerRows(customers: readonly AdminCustomer[]): CustomerRow[] {
  return customers.map((c) => {
    const orders = ORDERS.filter((o) => o.customer === c.company);
    const activeOrders = orders.filter((o) => !CLOSED.includes(o.status)).length;
    const ticketRows = TICKETS.filter((t) => t.customer === c.company);
    const openTickets = ticketRows.filter((t) => t.status === 'open' || t.status === 'pending').length;
    const firstOrder = [...orders].sort((a, b) => a.created.localeCompare(b.created))[0];
    const source = firstOrder?.source ?? 'quick';
    const extra = CUSTOMER_EXTRA[c.id] ?? { phone: '—', timezone: '—', memberSince: '2025-01-01', tags: [TIER[c.tier].label] };
    const churnDays = Math.max(0, Math.round((TODAY.getTime() - new Date(c.lastActive).getTime()) / 86400000));
    const aov = c.orders ? Math.round(c.spend / c.orders) : 0;
    const atRisk = churnDays > 30;
    const health: Health = atRisk ? 'risk' : churnDays <= 7 && c.orders >= 5 ? 'good' : 'ok';

    const recentOrders = [...orders]
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(0, 6)
      .map((o) => ({ id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status, value: o.value, created: o.created }));
    const mix = Object.values(orders.reduce<Record<string, { service: string; count: number; value: number }>>((acc, o) => {
      acc[o.service] = acc[o.service] ?? { service: o.service, count: 0, value: 0 };
      acc[o.service].count += 1; acc[o.service].value += o.value; return acc;
    }, {})).sort((a, b) => b.value - a.value);
    const tickets = ticketRows.map((tk) => ({ id: tk.id, subject: tk.subject, status: tk.status, priority: tk.priority, age: tk.age }));

    return { ...c, ...extra, aov, activeOrders, openTickets, source, churnDays, atRisk, health, recentOrders, mix, tickets };
  });
}
