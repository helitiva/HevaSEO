import { ORDERS, STAFF, SKILL_META, SERVICE_SKILL, customerByCompany } from '@/data/adminMock';
import { StaffClient, type StaffVM, type ActiveOrder } from './StaffClient';

const TODAY = new Date('2026-06-24T00:00:00');
// Orders that still sit on a staff member's plate (i.e. real current workload).
const ACTIVE = new Set(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);

function daysToDue(deadline: string | null): number {
  return deadline ? Math.round((new Date(deadline).getTime() - TODAY.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
}

export default function StaffPage() {
  const staff: StaffVM[] = STAFF.map((s) => {
    const mine = ORDERS.filter((o) => o.staff === s.name);
    const active = mine.filter((o) => ACTIVE.has(o.status));
    const activeOrders: ActiveOrder[] = active.map((o) => {
      const cust = customerByCompany(o.customer);
      const d = daysToDue(o.deadline);
      return {
        id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status,
        priority: o.priority, value: o.value, customer: o.customer,
        tier: cust?.tier ?? 'new', deadline: o.deadline, daysToDue: Number.isFinite(d) ? d : 9999,
        skill: SERVICE_SKILL[o.service] ?? null,
      };
    }).sort((a, b) => a.daysToDue - b.daysToDue);

    const load = activeOrders.length;
    const overdue = activeOrders.filter((o) => o.daysToDue < 0).length;
    const dueSoon = activeOrders.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 1).length;
    const valueInFlight = activeOrders.reduce((sum, o) => sum + o.value, 0);
    const completed = mine.filter((o) => o.status === 'completed').length;

    return {
      id: s.id, name: s.name, role: s.role, email: s.email, since: s.since, tz: s.tz,
      skills: s.skills, capacity: s.capacity, active: s.active,
      composite: s.composite, quality: s.quality, onTime: s.onTime, throughput: s.throughput, trend: s.trend,
      load, overdue, dueSoon, valueInFlight, completed, activeOrders,
    };
  });

  return <StaffClient initialStaff={staff} skillMeta={SKILL_META} />;
}
