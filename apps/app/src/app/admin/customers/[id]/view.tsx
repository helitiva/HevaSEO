import { notFound } from 'next/navigation';
import { CUSTOMERS, ORDERS, TICKETS, CUSTOMER_EXTRA, CUSTOMER_PROJECTS, CUSTOMER_LEDGER, TIER, money } from '@/data/adminMock';
import { CustomerProfileClient } from './CustomerProfileClient';

// Shared by the admin and manager customer detail pages. `showMoney` defaults to
// true (admin); the manager page passes false so the server-rendered activity
// feed (which bakes order/ledger amounts into plain text) is redacted too — the
// ViewerProvider only reaches the client component, not this server derivation.
export async function CustomerDetailView({ id, showMoney = true }: { id: string; showMoney?: boolean }) {
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) notFound();

  const orders = ORDERS.filter((o) => o.customer === c.company)
    .map((o) => ({ id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status, value: o.value, created: o.created }));
  const extra = CUSTOMER_EXTRA[id] ?? { phone: '—', timezone: '—', memberSince: '2025-01-01', tags: [TIER[c.tier].label] };
  const today = new Date('2026-06-24T00:00:00');
  const churnDays = Math.round((today.getTime() - new Date(c.lastActive).getTime()) / 86400000);
  const aov = c.orders ? Math.round(c.spend / c.orders) : 0;
  const active = orders.filter((o) => !['completed', 'canceled'].includes(o.status)).length;
  const site = c.email.split('@')[1] ?? `${c.company.toLowerCase().replace(/\s+/g, '')}.com`;

  const folderCounts = orders.reduce<Record<string, number>>((a, o) => { a[o.service] = (a[o.service] ?? 0) + 1; return a; }, {});
  const projects = CUSTOMER_PROJECTS[id] ?? [{ name: 'Main site', site, folders: Object.entries(folderCounts).map(([name, n]) => ({ name, orders: n })) }];

  const mix = Object.values(orders.reduce<Record<string, { service: string; count: number; value: number }>>((a, o) => {
    a[o.service] = a[o.service] ?? { service: o.service, count: 0, value: 0 };
    a[o.service].count += 1; a[o.service].value += o.value; return a;
  }, {})).sort((a, b) => b.value - a.value);

  const ledger = CUSTOMER_LEDGER[id] ?? [
    { at: extra.memberSince, delta: c.spend + c.balance, reason: 'Top-up · Stripe' },
    ...orders.map((o) => ({ at: o.created, delta: -o.value, reason: `${o.code} confirmed` })),
  ];
  const tickets = TICKETS.filter((tk) => tk.customer === c.company).map((tk) => ({ id: tk.id, subject: tk.subject, status: tk.status, priority: tk.priority, age: tk.age }));
  const activity = [
    { id: 'login', at: c.lastActive, type: 'login', text: 'Logged into the dashboard' },
    ...orders.map((o) => ({ id: `o-${o.id}`, at: o.created, type: 'order', text: `Placed ${o.code} · ${o.service} · ${o.pkg}${showMoney ? ` · ${money(o.value)}` : ''}` })),
    ...(showMoney ? ledger.map((l, i) => ({ id: `l-${i}`, at: l.at, type: l.delta >= 0 ? 'payment' : 'debit', text: `${l.reason} · ${l.delta >= 0 ? '+' : ''}${money(l.delta)}` })) : []),
    { id: 'claim', at: extra.memberSince, type: 'account', text: 'Created account & claimed dashboard' },
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  return (
    <CustomerProfileClient
      cust={{ id: c.id, name: c.name, company: c.company, email: c.email, status: c.status, tier: c.tier, spend: c.spend, orders: c.orders, balance: c.balance, lastActive: c.lastActive }}
      contact={extra} churnDays={churnDays} aov={aov} active={active}
      orders={orders} projects={projects} mix={mix} ledger={ledger} tickets={tickets} activity={activity}
    />
  );
}
