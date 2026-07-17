import { ORDERS, STAFF, SERVICE_SKILL, customerByCompany, STAFF_MANAGER, managerOf, type AdminStaff, type AdminOrder } from '@/data/adminMock';
import { rosterSignals } from '@/data/adminStaffInsight';
import type { StaffVM, ActiveOrder, ManagerVM } from './StaffClient';

/**
 * Real clock. Was mockTodayDate() (2026-06-24) against REAL order deadlines dated now, so daysToDue
 * came out ~26 days too high: `overdue` (< 0) could never fire and `dueSoon` (<= 1) never matched — the
 * roster showed a team with nothing late and nothing due, whatever the real deadlines said.
 * Server-only (staff/page.tsx is a server page); per-call so a long-lived process doesn't freeze today.
 */
const todayMs = () => Date.now();
// Orders that still sit on a staff member's plate (i.e. real current workload).
const ACTIVE = new Set(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);

function daysToDue(deadline: string | null): number {
  return deadline ? Math.round((new Date(deadline).getTime() - todayMs()) / 86400000) : Number.POSITIVE_INFINITY;
}

// Shared by the admin Staff page and the manager (pod-scoped) one. `allOrders` defaults to the mock
// ORDERS (manager surface, still mock); the admin page passes real orders so workload is real.
/**
 * @param pay  Real monthly pay per profile id, from staff_comp + delivered-basis commission
 *             (getPayrollPreview). rosterSignals below CANNOT supply it: it does
 *             `STAFF.find(x => x.id === staffId)` against the adminMock roster whose ids are s1..s6,
 *             so a real UUID always misses and `sig?.monthlyPay ?? 0` rendered **$0/mo for every
 *             staffer** — while Finance, reading the same people from payroll_runs, showed $1,029.60.
 * @param managerNames  Real pod owner per profile id, from staff_details.manager_id. Same bug: the mock
 *             managerOf() lookup missed on UUIDs, so every card said "No staff assigned".
 */
export function buildStaffVMs(
  staffList: readonly AdminStaff[],
  allOrders: readonly AdminOrder[] = ORDERS,
  pay: ReadonlyMap<string, number> = new Map(),
  managerNames: ReadonlyMap<string, { id: string; name: string }> = new Map(),
): StaffVM[] {
  return staffList.map((s) => {
    const mine = allOrders.filter((o) => o.staff === s.name);
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
    const mgr = managerNames.get(s.id) ?? managerOf(s.id);
    const sig = rosterSignals(s.id);

    return {
      id: s.id, name: s.name, role: s.role, email: s.email, since: s.since, tz: s.tz,
      skills: s.skills, capacity: s.capacity, active: s.active,
      composite: s.composite, quality: s.quality, onTime: s.onTime, throughput: s.throughput, trend: s.trend,
      load, overdue, dueSoon, valueInFlight, completed, activeOrders,
      managerId: mgr?.id ?? null, managerName: mgr?.name ?? null,
      tier: sig?.tier ?? '—', rank: sig?.rank ?? null,
      monthlyPay: pay.get(s.id) ?? sig?.monthlyPay ?? 0, walletBalance: sig?.walletBalance ?? 0,
      pendingFines: sig?.pendingFines ?? 0, appliedFines: sig?.appliedFines ?? 0,
      rewardsUnlocked: sig?.rewardsUnlocked ?? 0, rewardsTotal: sig?.rewardsTotal ?? 0,
      firstPassRate: sig?.firstPassRate ?? 0, avgRating: sig?.avgRating ?? null,
    };
  });
}

// Manager → the staff they own (for the Managers overview + filter).
export function buildManagerVMs(managers: readonly { id: string; name: string; title: string; email: string }[]): ManagerVM[] {
  return managers.map((m) => {
    const reports = STAFF.filter((s) => STAFF_MANAGER[s.id] === m.id);
    return { id: m.id, name: m.name, title: m.title, email: m.email, reportIds: reports.map((s) => s.id), reportNames: reports.map((s) => s.name) };
  });
}
