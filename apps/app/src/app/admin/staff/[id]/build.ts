import { ORDERS, STAFF, customerByCompany, type OrderStatus, type Priority, type Tier, type AdminOrder, type AdminStaff } from '@/data/adminMock';
import { buildStaffInsight, buildStaffInsightReal } from '@/data/adminStaffInsight';
import type { ProfileOrder, Workload, TeamAvg } from './StaffProfileClient';

/**
 * Real clock — same bug as the roster builder: dueIn measured real deadlines against 2026-06-24.
 * Server-only (staff/[id]/page.tsx is a server page).
 */
const todayMs = () => Date.now();
const ACTIVE = new Set<OrderStatus>(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);
const dueIn = (d: string | null) => (d ? Math.round((new Date(d).getTime() - todayMs()) / 86400000) : null);

function toProfileOrder(o: (typeof ORDERS)[number]): ProfileOrder {
  const cust = customerByCompany(o.customer);
  const d = dueIn(o.deadline);
  return {
    id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status,
    priority: o.priority as Priority, value: o.value, customer: o.customer,
    tier: (cust?.tier ?? 'new') as Tier, daysToDue: d === null ? 9999 : d,
    deadline: o.deadline,
  };
}

// Build the full profile props for a staffer, or null if unknown. Shared by the
// admin and manager (pod-checked) staff detail pages.
export function buildStaffProfile(id: string) {
  const insight = buildStaffInsight(id);
  const base = STAFF.find((x) => x.id === id);
  if (!insight || !base) return null;

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

  const act = STAFF.filter((s) => s.active);
  const avg = (sel: (s: (typeof STAFF)[number]) => number) => Math.round(act.reduce((n, s) => n + sel(s), 0) / (act.length || 1));
  const teamAvg: TeamAvg = { composite: avg((s) => s.composite), quality: avg((s) => s.quality), onTime: avg((s) => s.onTime), throughput: avg((s) => s.throughput) };

  return { insight, workload, teamAvg };
}

// Real staff profile (getStaff): identity + perf real; workload from real assigned orders; team avg from
// the real roster. Used when the id is a real profile (not in the mock roster) so the page never 404s.
function toProfileOrderReal(o: AdminOrder): ProfileOrder {
  const d = dueIn(o.deadline);
  return {
    id: o.id, code: o.code, service: o.service, pkg: o.pkg, status: o.status,
    priority: o.priority, value: o.value, customer: o.customer, tier: 'new' as Tier,
    daysToDue: d === null ? 9999 : d, deadline: o.deadline,
  };
}

export function buildStaffProfileReal(rs: AdminStaff, realOrders: AdminOrder[], team: AdminStaff[]) {
  const insight = buildStaffInsightReal(rs);
  const mine = realOrders.filter((o) => o.staff === rs.name);
  const active = mine.filter((o) => ACTIVE.has(o.status)).map(toProfileOrderReal).sort((a, b) => a.daysToDue - b.daysToDue);
  const shipped = mine.filter((o) => o.status === 'completed' || o.status === 'approved').map(toProfileOrderReal).slice(0, 8);
  const workload: Workload = {
    capacity: rs.capacity, load: active.length,
    valueInFlight: active.reduce((n, o) => n + o.value, 0),
    valueDelivered: shipped.reduce((n, o) => n + o.value, 0),
    overdue: active.filter((o) => o.daysToDue < 0).length,
    dueSoon: active.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 1).length,
    active, shipped,
  };
  const act = team.filter((s) => s.active);
  const avg = (sel: (s: AdminStaff) => number) => Math.round(act.reduce((n, s) => n + sel(s), 0) / (act.length || 1));
  const teamAvg: TeamAvg = { composite: avg((s) => s.composite), quality: avg((s) => s.quality), onTime: avg((s) => s.onTime), throughput: avg((s) => s.throughput) };
  return { insight, workload, teamAvg };
}
