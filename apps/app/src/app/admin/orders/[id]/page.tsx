import { notFound } from 'next/navigation';
import {
  ORDERS, AUDIT, STAFF, ORDER_EXTRA, SERVICE_INCLUDED, customerByCompany,
} from '@/data/adminMock';
import { OrderDetailClient } from './OrderDetailClient';

const seqMap = new Map([...ORDERS].sort((a, b) => a.created.localeCompare(b.created)).map((o, i) => [o.id, i + 1] as const));
const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize' };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === id);
  if (!order) notFound();

  const seq = seqMap.get(order.id) ?? 0;
  const c = customerByCompany(order.customer);
  const site = c?.email.split('@')[1] ?? `${order.customer.toLowerCase().replace(/\s+/g, '')}.com`;
  const extra = ORDER_EXTRA[order.id];
  const project = extra?.project ?? `${order.customer} — SEO program`;
  const folder = extra?.folder ?? 'General';
  const included = extra?.included ?? SERVICE_INCLUDED[order.service] ?? [];
  const brief = extra?.brief ?? [{ label: 'Website', value: `https://${site}` }, { label: 'Goal', value: 'Improve organic visibility' }, { label: 'Market', value: 'US · English' }];
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

  return (
    <OrderDetailClient
      order={{ id: order.id, seq, code: order.code, customer: order.customer, service: order.service, pkg: order.pkg, status: order.status, priority: order.priority, source: order.source, value: order.value, staff: order.staff, deadline: order.deadline, created: order.created }}
      cust={cust} site={site} today={new Date().toISOString().slice(0, 10)}
      project={project} folder={folder}
      included={included} brief={brief} addons={addons} addonsTotal={addonsTotal} bundle={bundle}
      eligibleStaff={eligibleStaff} initialActivity={initialActivity} prev={prev} next={next}
    />
  );
}
