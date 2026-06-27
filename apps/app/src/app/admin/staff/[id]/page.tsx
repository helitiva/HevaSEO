import { notFound } from 'next/navigation';
import { ORDERS, STAFF, SKILL_META, SERVICE_SKILL, TIER, customerByCompany, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';
import { buildStaffInsight } from '@/data/adminStaffInsight';
import { StaffProfileClient, type ProfileOrder, type Workload, type TeamAvg } from './StaffProfileClient';

const TODAY = new Date('2026-06-24T00:00:00');
const ACTIVE = new Set<OrderStatus>(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);
const dueIn = (d: string | null) => (d ? Math.round((new Date(d).getTime() - TODAY.getTime()) / 86400000) : null);

function toProfileOrder(o: (typeof ORDERS)[number]): ProfileOrder {
  const cust = customerByCompany(o.customer);
  const d = dueIn(o.deadline);
  return {
    id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status,
    priority: o.priority as Priority, value: o.value, customer: o.customer,
    tier: (cust?.tier ?? 'new') as Tier, daysToDue: d === null ? 9999 : d,
  };
}

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insight = buildStaffInsight(id);
  const base = STAFF.find((x) => x.id === id);
  if (!insight || !base) notFound();

  const mine = ORDERS.filter((o) => o.staff === base.name);
  const active = mine.filter((o) => ACTIVE.has(o.status))
    .map(toProfileOrder).sort((a, b) => a.daysToDue - b.daysToDue);
  const shipped = mine.filter((o) => o.status === 'completed' || o.status === 'approved')
    .map(toProfileOrder).slice(0, 8);

  const load = active.length;
  const workload: Workload = {
    capacity: base.capacity, load,
    valueInFlight: active.reduce((n, o) => n + o.value, 0),
    valueDelivered: shipped.reduce((n, o) => n + o.value, 0),
    overdue: active.filter((o) => o.daysToDue < 0).length,
    dueSoon: active.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 1).length,
    active, shipped,
  };

  // team averages (active staff only) for the "vs team" deltas on the score breakdown
  const act = STAFF.filter((s) => s.active);
  const avg = (sel: (s: (typeof STAFF)[number]) => number) => Math.round(act.reduce((n, s) => n + sel(s), 0) / (act.length || 1));
  const teamAvg: TeamAvg = { composite: avg((s) => s.composite), quality: avg((s) => s.quality), onTime: avg((s) => s.onTime), throughput: avg((s) => s.throughput) };

  return (
    <StaffProfileClient
      insight={insight} workload={workload} teamAvg={teamAvg}
      skillMeta={SKILL_META} tierMeta={TIER} serviceSkill={SERVICE_SKILL}
    />
  );
}
