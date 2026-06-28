import {
  ORDERS, STAFF, MANAGERS, STAFF_MANAGER, LEAVE_REQUESTS, SKILL_META,
} from '@/data/adminMock';
import { mockTodayDate } from '@/lib/today';
import { allManagerPerf, companyBenchmark, type ManagerPerf } from '@/lib/managerPerf';
import { ManagersClient, type ManagerMeta, type StaffMemberVM, type TeamLeaveVM } from './ManagersClient';

export const metadata = { title: 'Managers' };

const TODAY = mockTodayDate();
const ACTIVE = new Set(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);

function daysToDue(deadline: string | null): number {
  return deadline ? Math.round((new Date(deadline).getTime() - TODAY.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
}

export default function ManagersPage() {
  // Every staff member with workload metrics + their seeded manager. The client
  // owns reassignment from here, so teams are computed there, not baked in.
  const staff: StaffMemberVM[] = STAFF.map((s) => {
    const active = ORDERS.filter((o) => o.staff === s.name && ACTIVE.has(o.status));
    const load = active.length;
    const overdue = active.filter((o) => daysToDue(o.deadline) < 0).length;
    const dueSoon = active.filter((o) => { const d = daysToDue(o.deadline); return d >= 0 && d <= 1; }).length;
    const valueInFlight = active.reduce((n, o) => n + o.value, 0);
    return {
      id: s.id, name: s.name, role: s.role, active: s.active, skills: s.skills,
      capacity: s.capacity, load, overdue, dueSoon, valueInFlight,
      composite: s.composite, quality: s.quality, onTime: s.onTime,
      managerId: STAFF_MANAGER[s.id] ?? null,
    };
  });

  const managers: ManagerMeta[] = MANAGERS.map((m) => ({ id: m.id, name: m.name, title: m.title, email: m.email }));
  const leave: TeamLeaveVM[] = LEAVE_REQUESTS.map((l) => ({
    id: l.id, staffId: l.staffId, staffName: l.staffName, role: l.role,
    from: l.from, to: l.to, days: l.days, reason: l.reason, status: l.status,
  }));

  // Manager Score per pod (seeded standing) + the company benchmark the cards rank against.
  // Computed once and reused, so the score model runs a single pass per render.
  const perfList = allManagerPerf();
  const perfById: Record<string, ManagerPerf> = Object.fromEntries(perfList.map((p) => [p.id, p]));
  const benchmark = companyBenchmark(perfList);

  return <ManagersClient managers={managers} staff={staff} leave={leave} skillMeta={SKILL_META} perfById={perfById} benchmark={benchmark} />;
}
