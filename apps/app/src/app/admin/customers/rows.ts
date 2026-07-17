import { ORDERS, TICKETS, CUSTOMER_EXTRA, TIER, type AdminCustomer, type AdminOrder } from '@/data/adminMock';
import type { CustomerRow, Health } from './CustomersClient';

/**
 * Real clock. Was `mockTodayDate()` — 2026-06-24 — against customers whose last_active_at is real and
 * dated now: `churnDays` came out negative, `Math.max(0, …)` clamped it to 0, and `atRisk`
 * (churnDays > 30) could therefore NEVER be true. The At-risk KPI, the At-risk segment and the whole
 * Churn-watch panel were structurally empty — not "no one is at risk", but "we cannot detect risk".
 *
 * Server-only (both callers are server pages). Per-call so a long-lived process doesn't freeze today.
 */
const todayMs = () => Date.now();
const CLOSED = ['completed', 'canceled'];

// Derivation shared by the admin Customers page and the manager (pod-scoped) one. `allOrders`
// defaults to the mock ORDERS (manager surface, still mock); the admin page passes real orders.
export function buildCustomerRows(customers: readonly AdminCustomer[], allOrders: readonly AdminOrder[] = ORDERS): CustomerRow[] {
  return customers.map((c) => {
    const orders = allOrders.filter((o) => o.customer === c.company);
    const activeOrders = orders.filter((o) => !CLOSED.includes(o.status)).length;
    const ticketRows = TICKETS.filter((t) => t.customer === c.company);
    const openTickets = ticketRows.filter((t) => t.status === 'open' || t.status === 'pending').length;
    const firstOrder = [...orders].sort((a, b) => a.created.localeCompare(b.created))[0];
    const source = firstOrder?.source ?? 'quick';
    const extra = CUSTOMER_EXTRA[c.id] ?? { phone: '—', timezone: '—', memberSince: '2025-01-01', tags: [TIER[c.tier].label] };
    const churnDays = Math.max(0, Math.round((todayMs() - new Date(c.lastActive).getTime()) / 86400000));
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
