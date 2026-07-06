/**
 * Manager "pulse" — derived ops signals for the Pod Command Center overview.
 *
 * Every function is pure and takes the REAL data arrays the page fetched (orders,
 * deliverables, tickets, staff, audit), so it computes view-models over live DB
 * data. A manager is tenant-wide + money-blind, so there is no pod sub-filter here
 * — the caller passes exactly what the manager may see (orders_mgr etc.). It holds
 * no money (revenue/payroll/spend); the manager surface is deliberately money-blind.
 */
import {
  SERVICE_SKILL, SKILL_META, SLA_LIMIT_H, ACTIVE_ORDER_STATUS,
  type AdminOrder, type AdminDeliverable, type AdminStaff, type AdminTicket, type AuditEntry,
} from '@/data/adminMock';

/** Today (real, date-only) — the manager surface runs against live dates. */
export function podToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Order statuses that still consume a delivery slot (not terminal). */
export const ACTIVE_STATUS = ACTIVE_ORDER_STATUS;

const DAY_MS = 86_400_000;

/** Whole days from `iso` until `today` (positive = in the past). Date-only safe. */
export function ageDays(iso: string, today: string = podToday()): number {
  const a = Date.parse(iso.slice(0, 10));
  const b = Date.parse(today.slice(0, 10));
  return Math.round((b - a) / DAY_MS);
}

/** Parse a ticket's human age label ("3h", "2d", "45m") into whole hours. */
function ticketAgeHours(age: string): number {
  const m = /^(\d+)\s*([mhd])$/.exec((age ?? '').trim());
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === 'd' ? n * 24 : m[2] === 'm' ? Math.round(n / 60) : n;
}

const activeOrders = (orders: AdminOrder[]): AdminOrder[] => orders.filter((o) => ACTIVE_STATUS.has(o.status));

/** Service → palette colour, via the canonical skill taxonomy. */
export function serviceColor(service: string): string {
  return SKILL_META[SERVICE_SKILL[service]]?.color ?? '#64748b';
}

/** The skills the active team can deliver. */
const teamSkillSet = (staff: AdminStaff[]): Set<string> =>
  new Set(staff.filter((s) => s.active).flatMap((s) => s.skills));

/** Can the team deliver this order's service? (Unmapped services are open to all.) */
function teamCanServe(skills: ReadonlySet<string>, service: string): boolean {
  const sk = SERVICE_SKILL[service];
  return !sk || skills.has(sk);
}

/** Late work needing attention: assigned active slippage + unrouted work the team could take. */
export function overdueCount(orders: AdminOrder[], staff: AdminStaff[], today: string = podToday()): number {
  const assigned = activeOrders(orders).filter((o) => o.deadline && o.deadline < today).length;
  const skills = teamSkillSet(staff);
  const unrouted = orders.filter((o) =>
    o.staff === null && o.status !== 'canceled' &&
    o.deadline !== null && o.deadline < today && teamCanServe(skills, o.service),
  ).length;
  return assigned + unrouted;
}

// ---------------------------------------------------------------- Triage queue

export type TriageKind = 'review' | 'overdue' | 'changes' | 'sla' | 'assign';
export interface TriageItem {
  id: string; kind: TriageKind; icon: string; tone: 'bad' | 'warn' | 'good' | 'info';
  title: string; subtitle: string; meta: string; href: string; weight: number;
}

/** The latest deliverable per order (highest version). */
function latestByOrder(items: AdminDeliverable[]): Map<string, AdminDeliverable> {
  const map = new Map<string, AdminDeliverable>();
  for (const d of items) {
    const cur = map.get(d.orderId);
    if (!cur || d.version > cur.version) map.set(d.orderId, d);
  }
  return map;
}

/** The single prioritised list a manager works top-down. */
export function triageForPod(
  orders: AdminOrder[], deliverables: AdminDeliverable[], tickets: AdminTicket[], staff: AdminStaff[], today: string = podToday(),
): TriageItem[] {
  const items: TriageItem[] = [];
  const orderById = new Map(orders.map((o) => [o.id, o] as const));

  // 1) Deliverables awaiting review (latest version submitted).
  for (const d of latestByOrder(deliverables).values()) {
    if (d.status !== 'submitted') continue;
    const o = orderById.get(d.orderId);
    const waited = ageDays(d.submittedAt, today);
    items.push({
      id: `rev-${d.id}`, kind: 'review', icon: 'ph-seal-check', tone: 'warn',
      title: `Review ${o?.code ?? d.orderId}${d.version > 1 ? ` · v${d.version}` : ''}`,
      subtitle: `${d.staff} · ${o?.service ?? 'deliverable'}${o ? ` for ${o.customer}` : ''}`,
      meta: waited <= 0 ? 'submitted today' : `waiting ${waited}d`,
      href: '/manager/review', weight: 70 + waited,
    });
  }

  // 2) Overdue active orders.
  for (const o of activeOrders(orders)) {
    if (!o.deadline || o.deadline >= today) continue;
    const over = ageDays(o.deadline, today);
    items.push({
      id: `od-${o.id}`, kind: 'overdue', icon: 'ph-warning-octagon', tone: 'bad',
      title: `${o.code} overdue`, subtitle: `${o.staff ?? 'unassigned'} · ${o.service} for ${o.customer}`,
      meta: `${over}d overdue`, href: '/manager/orders', weight: 100 + over,
    });
  }

  // 3) Change-requests — the ball is in the staffer's court.
  for (const o of orders) {
    if (o.status !== 'changes_requested') continue;
    items.push({
      id: `cr-${o.id}`, kind: 'changes', icon: 'ph-arrow-u-up-left', tone: 'warn',
      title: `${o.code} sent back`, subtitle: `${o.staff ?? 'unassigned'} · ${o.service} for ${o.customer}`,
      meta: 'awaiting redo', href: '/manager/review', weight: 50 + Math.min(ageDays(o.created, today), 20),
    });
  }

  // 4) SLA-urgent tickets still open.
  for (const t of tickets) {
    if (t.status !== 'open' && t.status !== 'pending') continue;
    if (t.slaTier !== 'urgent') continue;
    const hrs = ticketAgeHours(t.age);
    const breach = hrs >= SLA_LIMIT_H.urgent;
    items.push({
      id: `sla-${t.id}`, kind: 'sla', icon: 'ph-lifebuoy', tone: breach ? 'bad' : 'warn',
      title: `${t.code} · ${t.subject}`, subtitle: `${t.customer}${t.assignee ? ` · ${t.assignee}` : ' · unassigned'}`,
      meta: breach ? `SLA breached · ${t.age}` : `urgent · ${t.age} open`,
      href: '/manager/tickets', weight: (breach ? 92 : 80) + hrs,
    });
  }

  // 5) Unassigned orders the team can serve — work to route.
  const skills = teamSkillSet(staff);
  const PRIO_BUMP: Record<string, number> = { high: 8, med: 3, low: 0 };
  for (const o of orders) {
    if (o.staff !== null || o.status === 'canceled') continue;
    if (!teamCanServe(skills, o.service)) continue;
    const bump = PRIO_BUMP[o.priority] ?? 0;
    const dtd = o.deadline ? -ageDays(o.deadline, today) : null;
    let weight: number; let tone: TriageItem['tone']; let meta: string;
    if (dtd === null) { weight = 36 + bump; tone = 'info'; meta = 'needs routing'; }
    else if (dtd < 0) { weight = 104 - dtd; tone = 'bad'; meta = `${-dtd}d overdue · unrouted`; }
    else if (dtd === 0) { weight = 72 + bump; tone = 'warn'; meta = 'due today · unrouted'; }
    else if (dtd === 1) { weight = 58 + bump; tone = 'warn'; meta = 'due tomorrow · unrouted'; }
    else if (dtd <= 3) { weight = 46 + bump; tone = 'info'; meta = `due in ${dtd}d`; }
    else { weight = 34 + bump - Math.min(dtd, 12) * 0.4; tone = 'info'; meta = `due in ${dtd}d`; }
    items.push({
      id: `as-${o.id}`, kind: 'assign', icon: 'ph-user-plus', tone,
      title: `Route ${o.code}`, subtitle: `${o.service} · ${o.pkg} for ${o.customer}`,
      meta, href: '/manager/assignment', weight,
    });
  }

  return items.sort((a, b) => b.weight - a.weight);
}

// ------------------------------------------------------------- Week deadlines

export interface WeekDay { label: string; date: string; count: number; isToday: boolean; isPast: boolean; }

export function weekDeadlines(orders: AdminOrder[], today: string = podToday()): { days: WeekDay[]; overdue: number } {
  const t = new Date(`${today}T00:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(t.getTime() - dow * DAY_MS);
  const active = activeOrders(orders);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    return {
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], date: iso,
      count: active.filter((o) => o.deadline === iso).length,
      isToday: iso === today, isPast: iso < today,
    };
  });
  const overdue = active.filter((o) => o.deadline && o.deadline < days[0].date).length;
  return { days, overdue };
}

// ---------------------------------------------------------------- QA health

export interface QaHealth { reviewed: number; firstPassRate: number; changesRate: number; avgTurnaroundDays: number; awaiting: number; }

export function qaHealth(deliverables: AdminDeliverable[]): QaHealth {
  const reviewed = deliverables.filter((d) => d.reviewedAt !== null);
  const approved = reviewed.filter((d) => d.status === 'approved').length;
  const changes = reviewed.filter((d) => d.status === 'changes_requested').length;
  const turn = reviewed.reduce((s, d) => s + ageDays(d.submittedAt, d.reviewedAt!), 0);
  return {
    reviewed: reviewed.length,
    firstPassRate: reviewed.length ? Math.round((approved / reviewed.length) * 100) : 0,
    changesRate: reviewed.length ? Math.round((changes / reviewed.length) * 100) : 0,
    avgTurnaroundDays: reviewed.length ? +(turn / reviewed.length).toFixed(1) : 0,
    awaiting: deliverables.filter((d) => d.status === 'submitted').length,
  };
}

// ---------------------------------------------------------------- SLA / tickets

export interface SlaHealth { open: number; urgent: number; breached: number; }

export function slaHealth(tickets: AdminTicket[]): SlaHealth {
  const open = tickets.filter((t) => t.status === 'open' || t.status === 'pending');
  const urgent = open.filter((t) => t.slaTier === 'urgent');
  const breached = urgent.filter((t) => ticketAgeHours(t.age) >= SLA_LIMIT_H.urgent).length;
  return { open: open.length, urgent: urgent.length, breached };
}

// ---------------------------------------------------------------- Service mix

export interface MixSeg { label: string; value: number; color: string; }

export function serviceMix(orders: AdminOrder[]): MixSeg[] {
  const counts = new Map<string, number>();
  for (const o of activeOrders(orders)) counts.set(o.service, (counts.get(o.service) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, color: serviceColor(label) }))
    .sort((a, b) => b.value - a.value);
}

// ----------------------------------------------------------- Roster + rebalance

export interface RosterRow {
  id: string; name: string; role: string; skills: string[]; active: boolean;
  capacity: number; load: number; overdue: number; util: number; trend: number[];
}
export interface Rebalance { from: RosterRow; to: RosterRow; skill: string; move: number; }

export function rosterWithRebalance(staff: AdminStaff[], orders: AdminOrder[], today: string = podToday()): { roster: RosterRow[]; rebalance: Rebalance | null } {
  const active = activeOrders(orders);
  const roster: RosterRow[] = staff.map((s) => {
    const mine = active.filter((o) => o.staff === s.name);
    return {
      id: s.id, name: s.name, role: s.role, skills: s.skills, active: s.active,
      capacity: s.capacity, load: mine.length,
      overdue: mine.filter((o) => o.deadline && o.deadline < today).length,
      util: s.capacity ? Math.round((mine.length / s.capacity) * 100) : 0,
      trend: s.trend,
    };
  }).sort((a, b) => b.util - a.util);

  const hot = roster.find((r) => r.active && r.util >= 90);
  const cool = [...roster].reverse().find((r) => r.active && r.util <= 60);
  let rebalance: Rebalance | null = null;
  if (hot && cool && hot.id !== cool.id) {
    const shared = hot.skills.find((sk) => cool.skills.includes(sk));
    if (shared) rebalance = { from: hot, to: cool, skill: SKILL_META[shared]?.label ?? shared, move: Math.max(1, Math.round((hot.util - cool.util) / 40)) };
  }
  return { roster, rebalance };
}

// --------------------------------------------------------------- Recent activity

const OPS_ENTITY: ReadonlySet<string> = new Set(['order', 'deliverable', 'ticket', 'staff']);
const MONEY_ACTION: ReadonlySet<string> = new Set(['refund', 'credit_adjust', 'invoice', 'payout', 'charge']);
const MONEY_KEY: ReadonlySet<string> = new Set(['price', 'amount', 'delta', 'spend', 'balance', 'value']);

function isMoneyEvent(e: AuditEntry): boolean {
  if (MONEY_ACTION.has(e.action)) return true;
  if (e.meta && Object.keys(e.meta).some((k) => MONEY_KEY.has(k))) return true;
  if (e.diff?.some((d) => MONEY_KEY.has(d.field))) return true;
  return false;
}

/** The most recent ops audit events (money-blind). */
export function recentActivity(audit: AuditEntry[], limit = 6): AuditEntry[] {
  return audit
    .filter((e) => OPS_ENTITY.has(e.entity) && !isMoneyEvent(e))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}
