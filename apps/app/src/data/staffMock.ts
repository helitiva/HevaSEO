// Staff-surface mock. Single source of truth = adminMock's ORDERS/DELIVERABLES.
// StaffTask deliberately OMITS money (value/price) at the type level, so a leak is a
// compile error, not a runtime check. Staff sees tasks, never prices or credit.
import {
  ORDERS, DELIVERABLES, ORDER_NOTE, SERVICE_SKILL, SKILL_META, qaCriteriaFor, briefFor,
  PAYOUTS, TRANSACTIONS, STAFF,
  CUSTOMER_EXTRA, customerByCompany, CLIENT_NOTE, managerOf, TIER,
  type OrderStatus, type Priority, type AdminDeliverable, type Tier,
} from './adminMock';
import { workStats as computeWorkStats, summariseEarnings, firstPassStreak, rankByComposite, type WorkItem, type MonthEarning } from '@/lib/staff';
import {
  walletBalance, availableToWithdraw, clearingTotal, pendingPenaltyCount,
  type WalletEntry, type StaffPenalty, type PayoutMethod, type PayoutRequest, type PenaltyRule,
} from '@/lib/staffFinance';
import { buildRewards, type Reward } from '@/lib/staffRewards';

export type { OrderStatus, Priority } from './adminMock';
export { SKILL_META }; // safe (icon/label/color only) — re-export for staff client
// Visual meta for a service (icon/label/color), via its skill. Safe for staff surface.
export const serviceMeta = (service: string): { label: string; icon: string; color: string } =>
  SKILL_META[SERVICE_SKILL[service] ?? ''] ?? { label: service, icon: 'ph-circle', color: '#64748b' };
export type StaffDeliverable = AdminDeliverable; // already money-free

export interface StaffTask {
  id: string; code: string; customer: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; skill: string | null;
  deadline: string | null; created: string;
  site: string | null; keywords: string[]; note: string | null; qa: string[];
  brief: { label: string; value: string }[]; // full customer intake from checkout
}

export interface StaffMessage { who: string; body: string; internal: boolean; at: string; }

// The signed-in staff member (mock). Swapped for the session user when auth lands.
export const CURRENT_STAFF = { id: 's3', name: 'Huy N.', role: 'Content Lead' };

// Curated board for the demo — a fuller spread of actionable tasks across urgency buckets.
const MY_TASK_IDS = ['o31', 'o14', 'o2', 'o8', 'o34', 'o28', 'o6', 'o27', 'o32', 'o36', 'o26', 'o33', 'o11', 'o4', 'o15', 'o38'];

const siteOf = (b: { label: string; value: string }[]): string | null =>
  b.find((x) => /website|site|url/i.test(x.label))?.value ?? null;
// Keywords for the board chips, pulled from the brief's keyword/anchor field.
const keywordsOf = (b: { label: string; value: string }[]): string[] => {
  const field = b.find((x) => /keyword|anchor/i.test(x.label))?.value;
  return field ? field.split(/[,;]/).map((k) => k.trim()).filter(Boolean).slice(0, 6) : [];
};

// One order → the money-free StaffTask shape shown on the board.
function buildTask(o: (typeof ORDERS)[number]): StaffTask {
  const brief = briefFor(o.id);
  return {
    id: o.id, code: o.code, customer: o.customer, service: o.service, pkg: o.pkg,
    status: o.status, priority: o.priority, skill: SERVICE_SKILL[o.service] ?? null,
    deadline: o.deadline, created: o.created,
    site: siteOf(brief), keywords: keywordsOf(brief),
    note: ORDER_NOTE[o.id] ?? null, qa: qaCriteriaFor(o.service), brief,
  };
}

// The staffer's board. s3 (the demo staffer) keeps its hand-curated spread; everyone else derives
// from the live ORDERS assigned to them, so admin impersonation shows that person's real tasks.
export function myTasks(staffId: string = CURRENT_STAFF.id): StaffTask[] {
  const name = STAFF.find((x) => x.id === staffId)?.name ?? CURRENT_STAFF.name;
  const orders = staffId === CURRENT_STAFF.id
    ? MY_TASK_IDS.map((id) => ORDERS.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => Boolean(o))
    : ORDERS.filter((o) => o.staff === name && o.status !== 'canceled');
  return orders.map(buildTask);
}
export const MY_TASKS: StaffTask[] = myTasks();

export const taskById = (id: string, staffId: string = CURRENT_STAFF.id): StaffTask | undefined => myTasks(staffId).find((t) => t.id === id);

// Deliverables for a task, oldest → newest (newest is the "current" submission).
export const deliverablesFor = (orderId: string): StaffDeliverable[] =>
  DELIVERABLES.filter((d) => d.orderId === orderId).sort((a, b) => a.version - b.version);

// Submission history across every task on the staffer's board — newest first for the table.
export interface MyDeliverable {
  d: StaffDeliverable; taskId: string; taskCode: string; service: string; customer: string;
}
export const myDeliverables = (staffId: string = CURRENT_STAFF.id): MyDeliverable[] =>
  myTasks(staffId).flatMap((t) =>
    deliverablesFor(t.id).map((d) => ({ d, taskId: t.id, taskCode: t.code, service: t.service, customer: t.customer })),
  ).sort((a, b) => (b.d.submittedAt ?? '').localeCompare(a.d.submittedAt ?? ''));

// Rework rounds for a task = number of versions that were sent back for changes.
export const reworkCount = (orderId: string): number =>
  deliverablesFor(orderId).filter((d) => d.status === 'changes_requested').length;

// Headline quality stats for the deliverables workspace.
export interface DeliverableStats { total: number; approved: number; inReview: number; reworking: number; firstPassRate: number | null; }
export function deliverableStats(staffId: string = CURRENT_STAFF.id): DeliverableStats {
  const rows = myDeliverables(staffId);
  const approvedTaskIds = [...new Set(rows.filter((r) => r.d.status === 'approved').map((r) => r.taskId))];
  const firstPass = approvedTaskIds.filter((id) => reworkCount(id) === 0).length;
  return {
    total: rows.length,
    approved: rows.filter((r) => r.d.status === 'approved').length,
    inReview: rows.filter((r) => r.d.status === 'submitted').length,
    reworking: rows.filter((r) => r.d.status === 'changes_requested').length,
    firstPassRate: approvedTaskIds.length ? Math.round((firstPass / approvedTaskIds.length) * 100) : null,
  };
}

// ---- Own earnings (the staffer's OWN pay — not customer prices) ----
// Pulls aggregates from the admin payroll. Deliberately exposes ONLY base/commission/bonus/
// take-home — never the Payout's `basis`/`rate`, so commission can't be reverse-engineered into
// the customer revenue behind it. This is the one place money is intentionally shown to staff.
export interface StaffEarnings {
  base: number; commission: number; bonus: number; takeHome: number;
  lastPaid: { month: string; amount: number } | null;
}
export function myEarnings(staffId: string = CURRENT_STAFF.id): StaffEarnings | null {
  const p = PAYOUTS.find((x) => x.staffId === staffId);
  if (!p) return null;
  const past = TRANSACTIONS
    .filter((t) => t.kind === 'payout' && t.partyId === staffId)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const lastPaid = past
    ? { month: past.note?.split(' ')[0] ?? past.at.slice(0, 7), amount: Math.abs(past.amount) }
    : null;
  return { base: p.base, commission: p.commission, bonus: p.bonus, takeHome: p.due, lastPaid };
}

// ---- Customers the staffer is actively caring for (derived from their board; no money) ----
export interface CaredCustomer { name: string; active: number; services: string[]; }
export function myCustomers(staffId: string = CURRENT_STAFF.id): CaredCustomer[] {
  const map = new Map<string, CaredCustomer>();
  for (const t of myTasks(staffId)) {
    if (t.status === 'completed' || t.status === 'canceled') continue;
    const c = map.get(t.customer) ?? { name: t.customer, active: 0, services: [] };
    map.set(t.customer, {
      name: c.name,
      active: c.active + 1,
      services: c.services.includes(t.service) ? c.services : [...c.services, t.service],
    });
  }
  return [...map.values()].sort((a, b) => b.active - a.active);
}

// ---- Latest review feedback on my work (reviewer/admin QA note on a deliverable) ----
export interface LatestReview { taskCode: string; note: string; at: string; changesRequested: boolean; }
export function latestReview(staffId: string = CURRENT_STAFF.id): LatestReview | null {
  const tasks = myTasks(staffId);
  const mine = new Set(tasks.map((t) => t.id));
  const d = DELIVERABLES
    .filter((x) => mine.has(x.orderId) && x.reviewNote && x.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))[0];
  if (!d) return null;
  const task = tasks.find((t) => t.id === d.orderId);
  return { taskCode: task?.code ?? d.orderId, note: d.reviewNote as string, at: d.reviewedAt as string, changesRequested: d.status === 'changes_requested' };
}

// Two-thread seed: customer-visible vs internal. Per-task in real life; shared seed for the mock.
export const MESSAGES: Record<string, StaffMessage[]> = {
  o4: [
    { who: 'Jane Doe', body: 'Hi, any update on the articles?', internal: false, at: '2d' },
    { who: 'You', body: 'Batch 2 is in review now, you’ll have it today.', internal: false, at: '1d' },
    { who: 'Admin', body: 'Add internal links + meta on all 5 before resubmitting.', internal: true, at: '1d' },
  ],
};
export const messagesFor = (orderId: string): StaffMessage[] => MESSAGES[orderId] ?? [];

// ---- Client context (money-free): order history + who worked it + account note ----
export interface ClientSummary {
  company: string; tier: Tier | null; since: string | null; tags: string[];
  orders: number; byService: { service: string; count: number }[]; topService: string | null;
  staff: string[]; note: string | null;
}
export const clientSummary = (customer: string): ClientSummary => {
  const all = ORDERS.filter((o) => o.customer === customer);
  const counts = new Map<string, number>();
  all.forEach((o) => counts.set(o.service, (counts.get(o.service) ?? 0) + 1));
  const byService = [...counts.entries()].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count);
  const staff = [...new Set(all.map((o) => o.staff).filter((s): s is string => Boolean(s)))];
  const c = customerByCompany(customer);
  const ex = c ? CUSTOMER_EXTRA[c.id] : undefined;
  return {
    company: customer, tier: c?.tier ?? null, since: ex?.memberSince ?? null, tags: ex?.tags ?? [],
    orders: all.length, byService, topService: byService[0]?.service ?? null, staff, note: CLIENT_NOTE[customer] ?? null,
  };
};

// ---- Manager context: the ops lead who reviews this staffer's work ----
export interface ManagerInfo { id: string; name: string; rank: string; title: string; skills: string[]; note: string | null; }
const MANAGER_NOTE: Record<string, string> = {
  mgr2: 'On content tasks: always fill the meta title + description and add 2–3 internal links before sending for review. Ping me early if a brief is unclear — that beats a rework round.',
  mgr1: 'For link work: share the target domains with me before outreach. Quality over volume — one DR50 placement beats three weak ones.',
};
export const myManager = (staffId: string = CURRENT_STAFF.id): ManagerInfo => {
  const m = managerOf(staffId);
  return m
    ? { id: m.id, name: m.name, rank: m.rank, title: m.title, skills: m.skills, note: MANAGER_NOTE[m.id] ?? null }
    : { id: '', name: 'Unassigned', rank: '—', title: 'No manager assigned', skills: [], note: null };
};
const MANAGER_THREAD: Record<string, StaffMessage[]> = {
  mgr2: [
    { who: 'Ken Rivera', body: 'Saw the Orbit brief land on your board — they’re picky about anchors, keep it natural.', internal: true, at: '3h' },
    { who: 'You', body: 'Got it. I’ll send the source domains before any outreach.', internal: true, at: '2h' },
  ],
  mgr1: [
    { who: 'Sofia Marin', body: 'Nice turnaround on the last batch. Keep the momentum.', internal: true, at: '1d' },
  ],
};
export const managerThread = (mgrId: string): StaffMessage[] => MANAGER_THREAD[mgrId] ?? [];

// ---- Notifications inbox (mock) ----
export type StaffNotifKind =
  | 'assignment' | 'changes' | 'reminder' | 'approved'
  | 'penalty' | 'bonus' | 'tier' | 'salary' | 'payout' | 'leave' | 'message';
export interface StaffNotification {
  id: string; kind: StaffNotifKind; title: string; body: string;
  taskId: string | null;     // task context, if any → drives the "open task" link
  href: string | null;       // non-task deep link (wallet, standing, settings…)
  at: string;                // human label ("2h ago")
  ts: string;                // ISO timestamp for sorting + day grouping
  read: boolean;
}
export const STAFF_NOTIFICATIONS: StaffNotification[] = [
  { id: 'n1', kind: 'salary', title: 'Salary paid · June', body: 'Your June payroll of $1,372 (base + commission) was deposited to Vietcombank ••4821. Payslip ready.', taskId: null, href: '/staff/finance', at: '1h ago', ts: '2026-06-26T09:00', read: false },
  { id: 'n2', kind: 'changes', title: 'Changes requested · CNT-1004', body: 'Add internal links and fill meta titles/descriptions before resubmitting.', taskId: 'o4', href: null, at: '2h ago', ts: '2026-06-26T08:10', read: false },
  { id: 'n3', kind: 'message', title: 'New message · Ken Rivera', body: 'Saw the Orbit brief land on your board — they’re picky about anchors, keep it natural.', taskId: 'o31', href: null, at: '2h ago', ts: '2026-06-26T07:50', read: false },
  { id: 'n4', kind: 'penalty', title: 'Revision fee flagged · CNT-1004', body: 'A $12 fee is pending review for the extra revision round. Dispute it if the brief changed mid-task.', taskId: null, href: '/staff/finance', at: '3h ago', ts: '2026-06-26T07:30', read: false },
  { id: 'n5', kind: 'bonus', title: 'Bonus earned · On the Dot', body: '100% on-time delivery in June — a $50 bonus landed in your wallet. Nice.', taskId: null, href: '/staff/finance', at: '5h ago', ts: '2026-06-26T06:00', read: false },
  { id: 'n6', kind: 'assignment', title: 'New task assigned · KW-1031', body: 'A keyword map landed on your board — due in 3 days.', taskId: 'o31', href: null, at: '6h ago', ts: '2026-06-26T05:00', read: false },
  { id: 'n7', kind: 'tier', title: '1 point from Senior tier', body: 'Lift your composite to 85 to unlock the Senior commission band (1.5× per task).', taskId: null, href: '/staff/performance', at: 'Yesterday', ts: '2026-06-25T16:00', read: false },
  { id: 'n8', kind: 'payout', title: 'Withdrawal completed · $200', body: 'Your $200 payout to Vietcombank ••4821 has landed. Fee $0.', taskId: null, href: '/staff/finance', at: 'Yesterday', ts: '2026-06-25T14:00', read: true },
  { id: 'n9', kind: 'reminder', title: 'Deadline soon · BL-1008', body: 'Backlink batch is due tomorrow. Submit when ready.', taskId: 'o8', href: null, at: 'Yesterday', ts: '2026-06-25T09:00', read: true },
  { id: 'n10', kind: 'approved', title: 'Approved · CNT-1015', body: 'Your Nova articles passed review — nice work. Scorecard updated.', taskId: 'o15', href: null, at: 'Yesterday', ts: '2026-06-25T08:00', read: true },
  { id: 'n11', kind: 'leave', title: 'Time off approved', body: 'Your 2 days off (Jul 3–4) are confirmed. Those days are now blocked on your calendar.', taskId: null, href: '/staff/calendar', at: '2d ago', ts: '2026-06-24T11:00', read: true },
  { id: 'n12', kind: 'reminder', title: 'Capacity check', body: 'You have 5 open tasks. Update availability if you need a lighter week.', taskId: null, href: '/staff/settings', at: '2d ago', ts: '2026-06-24T10:00', read: true },
];

export const NOTIF_META: Record<StaffNotifKind, { icon: string; tone: string; label: string; action: string }> = {
  assignment: { icon: 'ph-tray-arrow-down', tone: 'text-primary', label: 'Assignment', action: 'Open task' },
  changes: { icon: 'ph-arrow-counter-clockwise', tone: 'text-amber-500', label: 'Changes requested', action: 'Resume task' },
  reminder: { icon: 'ph-alarm', tone: 'text-sky-500', label: 'Reminder', action: 'View' },
  approved: { icon: 'ph-seal-check', tone: 'text-emerald-500', label: 'Approved', action: 'View task' },
  penalty: { icon: 'ph-warning-octagon', tone: 'text-red-500', label: 'Penalty', action: 'View wallet' },
  bonus: { icon: 'ph-gift', tone: 'text-emerald-500', label: 'Bonus', action: 'View wallet' },
  tier: { icon: 'ph-medal', tone: 'text-amber-500', label: 'Tier', action: 'View standing' },
  salary: { icon: 'ph-money', tone: 'text-emerald-500', label: 'Salary', action: 'View payslip' },
  payout: { icon: 'ph-hand-coins', tone: 'text-emerald-500', label: 'Payout', action: 'View wallet' },
  leave: { icon: 'ph-umbrella', tone: 'text-sky-500', label: 'Time off', action: 'View schedule' },
  message: { icon: 'ph-chat-circle-dots', tone: 'text-violet-500', label: 'Message', action: 'Open thread' },
};

export const statusLabel: Record<OrderStatus, string> = {
  new: 'New', confirmed: 'Confirmed', assigned: 'Assigned', in_progress: 'In progress',
  internal_review: 'Internal review', delivered: 'Delivered', changes_requested: 'Changes requested',
  approved: 'Approved', completed: 'Completed', canceled: 'Canceled',
};

// Columns staff actually work through (no New/Confirmed — that's admin intake).
export const BOARD_COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'internal_review', label: 'In review' },
  { status: 'changes_requested', label: 'Changes requested' },
  { status: 'delivered', label: 'Delivered' },
];

// ---- Availability: working hours, time off, and the away-handoff policy ----
export type AvailStatus = 'available' | 'away' | 'focus';
export type HandoffPolicy = 'speed' | 'continuity' | 'balanced';
export interface WorkHours { day: number; on: boolean; start: string; end: string } // day 0=Mon … 6=Sun
export interface TimeOff { id: string; from: string; to: string; reason: string }
export interface StaffAvailability { status: AvailStatus; hours: WorkHours[]; timeOff: TimeOff[]; handoff: HandoffPolicy }

export const MY_AVAILABILITY: StaffAvailability = {
  status: 'available',
  hours: [
    { day: 0, on: true, start: '09:00', end: '17:00' },
    { day: 1, on: true, start: '09:00', end: '17:00' },
    { day: 2, on: true, start: '09:00', end: '17:00' },
    { day: 3, on: true, start: '09:00', end: '17:00' },
    { day: 4, on: true, start: '09:00', end: '15:00' },
    { day: 5, on: false, start: '09:00', end: '17:00' },
    { day: 6, on: false, start: '09:00', end: '17:00' },
  ],
  timeOff: [{ id: 'to1', from: '2026-06-30', to: '2026-07-02', reason: 'Personal' }],
  handoff: 'balanced',
};

export const HANDOFF_META: Record<HandoffPolicy, { label: string; icon: string; blurb: string }> = {
  speed: { label: 'Speed-first', icon: 'ph-lightning', blurb: 'Never make a customer wait — hand my tasks to whoever is free when I’m away.' },
  continuity: { label: 'Continuity-first', icon: 'ph-heart', blurb: 'Keep my customers with me — hold non-urgent work until I’m back; only true emergencies get reassigned.' },
  balanced: { label: 'Balanced', icon: 'ph-scales', blurb: 'Reassign rush work and new customers; hold non-urgent work for the customers who prefer me.' },
};

// When I'm away/at capacity, should an incoming task be reassigned or held for me?
export function resolveHandoff(policy: HandoffPolicy, urgent: boolean, loyal: boolean): 'reassign' | 'hold' {
  if (urgent) return 'reassign';
  if (policy === 'speed') return 'reassign';
  if (policy === 'continuity') return 'hold';
  return loyal ? 'hold' : 'reassign'; // balanced
}

// Sample scenarios that make the handoff policy concrete in the UI preview.
export const HANDOFF_SCENARIOS: { label: string; urgent: boolean; loyal: boolean }[] = [
  { label: 'Rush order, tight deadline', urgent: true, loyal: false },
  { label: 'Returning client who asked for you', urgent: false, loyal: true },
  { label: 'New client, standard timeline', urgent: false, loyal: false },
];

// Expand time-off ranges into a set of ISO dates for calendar marking.
export function offDaysSet(timeOff: TimeOff[]): Set<string> {
  const set = new Set<string>();
  for (const t of timeOff) {
    let d = new Date(`${t.from}T00:00:00Z`);
    const end = new Date(`${t.to}T00:00:00Z`);
    while (d.getTime() <= end.getTime()) { set.add(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86_400_000); }
  }
  return set;
}

// ---- Client care signals: how much priority / care an order's customer warrants ----
// Higher tier = prioritise. New, particular, or priority-tagged clients = handle carefully / first.
const CLIENT_TRAITS: Record<string, { demanding?: boolean }> = {
  'Vertex AI': { demanding: true }, // technical; drafts go through their staff engineer, accuracy over speed
  'Orbit Labs': { demanding: true }, // detail-oriented CEO; picky about anchors
};
export interface ClientCare {
  tier: Tier | null;
  tierMeta: { label: string; icon: string; color: string } | null;
  isNew: boolean; isDemanding: boolean; isPriority: boolean;
  rank: number; // 0 standard · 1 elevated · 2 top priority
  hint: string;
}
export function clientCare(company: string): ClientCare {
  const c = customerByCompany(company);
  const ex = c ? CUSTOMER_EXTRA[c.id] : undefined;
  const tier = c?.tier ?? null;
  const tags = ex?.tags ?? [];
  const isNew = tier === 'new';
  const isDemanding = CLIENT_TRAITS[company]?.demanding ?? false;
  const isPriority = tier === 'vip' || tier === 'gold' || tags.some((t) => /priority|enterprise/i.test(t));
  const rank = isPriority || isDemanding ? 2 : isNew || tier === 'silver' || tags.some((t) => /retainer/i.test(t)) ? 1 : 0;
  const hint = rank === 2
    ? 'Top priority — high-rank or particular client. Do this first and double-check QA before sending.'
    : isNew ? 'New client — make a strong first impression and over-communicate.'
    : rank === 1 ? 'Valued client — keep the bar high.'
    : 'Standard care.';
  return { tier, tierMeta: tier ? TIER[tier] : null, isNew, isDemanding, isPriority, rank, hint };
}
export const careRankOf = (company: string): number => clientCare(company).rank;

// ---- Structured evaluation on a deliverable: manager/QA rating + customer rating ----
// reviewNote (the text) lives on the deliverable; this adds the star ratings + customer voice.
export interface DeliverableFeedback {
  managerRating?: number; reviewer?: string; managerNote?: string; // QA score 1–5
  customerRating?: number; customerNote?: string; customerRatedAt?: string; // customer stars 1–5
}
export const DELIVERABLE_FEEDBACK: Record<string, DeliverableFeedback> = {
  d10: { managerRating: 5, reviewer: 'Ken Rivera', managerNote: 'Polished and on-brief — meta and internal links all in place. Nice work.',
    customerRating: 5, customerNote: 'Exactly what we needed — clear, on-brand, and ready to publish. Thank you!', customerRatedAt: '2026-06-24' },
  d1: { managerRating: 3, reviewer: 'Ken Rivera', customerNote: 'Also — could we make the intros a bit punchier? Otherwise loving the direction!', customerRatedAt: '2026-06-19' },
  d8: { managerRating: 2, reviewer: 'Ken Rivera' },
};
export const feedbackFor = (deliverableId: string): DeliverableFeedback => DELIVERABLE_FEEDBACK[deliverableId] ?? {};

// Extra attachments + the customer-facing message a submission carried (a round can ship a file
// AND a link plus a note-to-reviewer and a message-to-customer).
export interface DeliverableExtra { file?: string; link?: string; staffMessage?: string }
export const DELIVERABLE_EXTRA: Record<string, DeliverableExtra> = {
  d1: { link: 'https://docs.google.com/document/d/acme-articles-v1', staffMessage: 'First draft — focused on the money pages (/pricing, /shop). Let me know any tweaks!' },
  d2: { file: 'acme-3-articles-v2.docx', link: 'https://docs.google.com/document/d/acme-articles-v2', staffMessage: 'Revised: punchier intros, internal links + meta added, and a summary table per the notes.' },
};
export const extraFor = (deliverableId: string): DeliverableExtra => DELIVERABLE_EXTRA[deliverableId] ?? {};

// ── Self-notes (personal work log) ─────────────────────────────────────
// A private running log the assigned staff keeps on a task — "where am I, what's
// left, what am I waiting on" — so multi-step work survives context switches.
// Money-free. Visible to the staff who wrote it + their manager + admin; NEVER the
// customer (this is NOT the customer-facing message thread).
export type SelfNoteAttachmentKind = 'image' | 'video' | 'link' | 'file';
export interface SelfNoteAttachment { kind: SelfNoteAttachmentKind; url: string; name?: string }
export interface SelfNote {
  id: string;
  author: string; // staff display name
  at: string; // human-readable timestamp (auto-filled "now" or hand-entered)
  body: string;
  attachments: SelfNoteAttachment[];
}

export const SELF_NOTES: Record<string, SelfNote[]> = {
  o31: [
    {
      id: 'sn-o31-1', author: CURRENT_STAFF.name, at: 'Jun 24, 09:40',
      body: 'Outlined all 3 articles + pulled SERP competitors. /pricing draft done. Paused — waiting on the client to confirm the product names before I write /shop.',
      attachments: [{ kind: 'link', url: 'https://docs.google.com/document/d/acme-outline', name: 'Working outline (Google Doc)' }],
    },
    {
      id: 'sn-o31-2', author: CURRENT_STAFF.name, at: 'Jun 25, 14:10',
      body: 'Client confirmed names. Resumed /shop article — first pass written, need to add internal links + meta description, then self-QA pass before submitting.',
      attachments: [],
    },
  ],
  o14: [
    {
      id: 'sn-o14-1', author: CURRENT_STAFF.name, at: 'Jun 26, 08:05',
      body: 'Audit crawl running (large site ~4k URLs). Will come back when it finishes to triage the Core Web Vitals issues.',
      attachments: [],
    },
  ],
};
export const selfNotesFor = (orderId: string): SelfNote[] => SELF_NOTES[orderId] ?? [];

// ---- Canned snippets for the submit form — staff tap to fill instead of retyping ----
export const REVIEWER_NOTE_SNIPPETS: string[] = [
  'Resubmitting after addressing all the feedback — internal links + meta added on every page.',
  'No risky changes this round — copy edits and formatting only.',
  'Self-QA done: passes plagiarism, links are live, meta titles/descriptions set.',
  'Heads up — one section needs a fact-check on the stats before it goes out.',
];
export const CUSTOMER_MSG_SNIPPETS: string[] = [
  'Here’s your deliverable — I focused on the money pages first. Let me know any tweaks!',
  'Revised per your notes: punchier intros and a summary table added. Hope this hits the mark!',
  'All set — everything’s optimised and ready to publish. Happy to adjust anything.',
  'Thanks for your patience! The updated version is attached — let me know what you think.',
];

// ---- Track record: completed-work archive per staff (the lifetime task history) ----
// Stands in for a real `tasks` archive — adminMock's ORDERS is only the current snapshot, too thin
// to show a track record. Each row is money-free (no order value). The most recent rows mirror the
// staffer's real June orders for consistency; older rows extend the history back across the year.
const WORK_ARCHIVE: Record<string, WorkItem[]> = {
  // Huy N. (Content Lead) — Content-heavy with some Keyword/Optimization/Audit/Indexer.
  s3: [
    // June — mirrors his real live orders (CNT-1038 approved, CNT-1015/1004 delivered, IDX-1012 done)
    { code: 'CNT-1038', service: 'Content', pkg: '5 articles', customer: 'Lumen', completedAt: '2026-06-22', versions: 1, revisions: 0, onTime: true, rating: 5, days: 6, reviewNote: null, commission: 45 },
    { code: 'CNT-1015', service: 'Content', pkg: '3 articles', customer: 'Nova', completedAt: '2026-06-25', versions: 1, revisions: 0, onTime: true, rating: 4, days: 7, reviewNote: null, commission: 36 },
    { code: 'IDX-1012', service: 'Indexer', pkg: '—', customer: 'Peak Digital', completedAt: '2026-06-20', versions: 1, revisions: 0, onTime: true, rating: 4, days: 6, reviewNote: null, commission: 24 },
    { code: 'CNT-1004', service: 'Content', pkg: '10 articles', customer: 'Acme Co', completedAt: '2026-06-24', versions: 2, revisions: 1, onTime: true, rating: 3, days: 4, reviewNote: 'Add internal links and fill meta titles/descriptions.', commission: 30 },
    // May
    { code: 'CNT-0991', service: 'Content', pkg: '5 articles', customer: 'Pulse Media', completedAt: '2026-05-28', versions: 1, revisions: 0, onTime: true, rating: 5, days: 5, reviewNote: null, commission: 42 },
    { code: 'KW-0987', service: 'Keyword', pkg: 'Standard', customer: 'Bright Ltd', completedAt: '2026-05-20', versions: 2, revisions: 1, onTime: false, rating: 3, days: 6, reviewNote: 'Add a search-intent column to the keyword map.', commission: 30 },
    { code: 'CNT-0975', service: 'Content', pkg: '10 articles', customer: 'Vertex AI', completedAt: '2026-05-12', versions: 1, revisions: 0, onTime: true, rating: 4, days: 7, reviewNote: null, commission: 60 },
    // April
    { code: 'OPT-0968', service: 'Optimization', pkg: 'Standard', customer: 'Vértice', completedAt: '2026-04-30', versions: 1, revisions: 0, onTime: true, rating: 5, days: 6, reviewNote: null, commission: 48 },
    { code: 'CNT-0959', service: 'Content', pkg: '3 articles', customer: 'Nova', completedAt: '2026-04-18', versions: 2, revisions: 1, onTime: true, rating: 4, days: 4, reviewNote: 'Tighten the intros — tone read a bit generic.', commission: 30 },
    { code: 'CNT-0945', service: 'Content', pkg: '5 articles', customer: 'Acme Co', completedAt: '2026-04-05', versions: 1, revisions: 0, onTime: false, rating: 4, days: 5, reviewNote: null, commission: 40 },
    // March
    { code: 'AUD-0938', service: 'Audit', pkg: 'Standard', customer: 'Cobalt Studio', completedAt: '2026-03-22', versions: 1, revisions: 0, onTime: true, rating: 5, days: 3, reviewNote: null, commission: 22 },
    { code: 'CNT-0925', service: 'Content', pkg: '10 articles', customer: 'Acme Co', completedAt: '2026-03-08', versions: 3, revisions: 2, onTime: true, rating: 2, days: 8, reviewNote: 'Off-brand voice + missing internal links on most pages.', commission: 55 },
    // February
    { code: 'KW-0913', service: 'Keyword', pkg: 'Pro', customer: 'Orbit Labs', completedAt: '2026-02-20', versions: 1, revisions: 0, onTime: true, rating: 4, days: 5, reviewNote: null, commission: 45 },
    { code: 'CNT-0902', service: 'Content', pkg: '5 articles', customer: 'Lumen', completedAt: '2026-02-05', versions: 1, revisions: 0, onTime: true, rating: 5, days: 5, reviewNote: null, commission: 42 },
    // January
    { code: 'CNT-0888', service: 'Content', pkg: '3 articles', customer: 'Nova', completedAt: '2026-01-22', versions: 1, revisions: 0, onTime: true, rating: 4, days: 4, reviewNote: null, commission: 28 },
    { code: 'OPT-0875', service: 'Optimization', pkg: 'Standard', customer: 'Pulse Media', completedAt: '2026-01-10', versions: 2, revisions: 1, onTime: false, rating: 3, days: 6, reviewNote: 'Cite the before/after metrics with sources.', commission: 44 },
  ],
};

// ---- Per-staff archive generation (s3 is hand-authored above; the rest are derived) ----
// Admin lists the whole team, so every staffer needs a track record — not just CURRENT_STAFF.
// These rows are generated deterministically and calibrated to each member's headline
// quality/on-time so their profile reads consistently with their score. Money-free except the
// staffer's OWN commission (a flat per-task figure, never an order value), same invariant as above.
const ARCH_SERVICE_BY_SKILL: Record<string, string> = { keyword: 'Keyword', backlink: 'Backlink', content: 'Content', optimize: 'Optimization' };
const ARCH_COMMISSION: Record<string, number> = { Content: 40, Keyword: 30, Backlink: 35, Optimization: 45, Audit: 22, Indexer: 24 };
const ARCH_PKG: Record<string, string[]> = {
  Content: ['3 articles', '5 articles', '10 articles'],
  Keyword: ['Standard', 'Pro'],
  Backlink: ['10 links', '25 links', 'Guest post'],
  Optimization: ['Standard', 'Technical'],
};
const ARCH_CUSTOMERS = ['Acme Co', 'Nova', 'Lumen', 'Pulse Media', 'Vertex AI', 'Orbit Labs', 'Bright Ltd', 'Peak Digital', 'Cobalt Studio'];
const ARCH_REVISION_NOTES: Record<string, string[]> = {
  Content: ['Tighten the intros — tone read a bit generic.', 'Add internal links and fill meta titles/descriptions.', 'Off-brand voice on a couple of sections.'],
  Keyword: ['Add a search-intent column to the keyword map.', 'Diversify the anchor suggestions.'],
  Backlink: ['Anchor mix too exact-match — diversify.', 'Two referring domains below the quality bar — swap them.'],
  Optimization: ['Cite the before/after metrics with sources.', 'Fix the meta descriptions flagged in the audit.'],
};
// Local FNV-ish hash so this block has no ordering dependency on earnSeed (defined further down).
function archSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function archIso(daysAgo: number): string {
  const d = new Date('2026-06-25T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function genWorkArchive(s: { id: string; skills: string[]; quality: number; onTime: number }): WorkItem[] {
  const services = s.skills.map((k) => ARCH_SERVICE_BY_SKILL[k]).filter(Boolean);
  if (services.length === 0) services.push('Content');
  const N = 16;
  const items: WorkItem[] = [];
  let counter = 1000 + (archSeed(s.id) % 400);
  const ratingBase = Math.round(s.quality / 20); // 95→5, 90→5, 84→4
  for (let i = 0; i < N; i++) {
    const seed = archSeed(`${s.id}-arch-${i}`);
    const service = services[seed % services.length];
    const pkgs = ARCH_PKG[service] ?? ['Standard'];
    const pkg = pkgs[(seed >>> 2) % pkgs.length];
    const customer = ARCH_CUSTOMERS[(seed >>> 5) % ARCH_CUSTOMERS.length];
    const daysAgo = Math.round(4 + (i * 172) / (N - 1)); // spread ~4..176 days back
    const completedAt = archIso(daysAgo);
    const onTime = (seed % 100) < s.onTime;
    const miss = 100 - s.quality;                        // lower quality → more revision rounds
    const rRoll = (seed >>> 7) % 100;
    const revisions = rRoll < miss / 2 ? 2 : rRoll < miss ? 1 : 0;
    const rated = ((seed >>> 11) % 10) < 8;               // ~80% of tasks get an admin rating
    let rating: number | null = null;
    if (rated) {
      const jitter = ((seed >>> 13) % 3) === 0 ? -1 : 0;
      rating = Math.max(1, Math.min(5, ratingBase - (revisions >= 2 ? 2 : revisions === 1 ? 1 : 0) + jitter));
    }
    const days = 3 + ((seed >>> 17) % 6);
    const noteList = ARCH_REVISION_NOTES[service] ?? ['Minor fixes requested.'];
    const reviewNote = revisions > 0 ? noteList[(seed >>> 19) % noteList.length] : null;
    const commission = (ARCH_COMMISSION[service] ?? 30) + ((seed >>> 23) % 16);
    const prefix = service.slice(0, 3).toUpperCase();
    items.push({ code: `${prefix}-${counter++}`, service, pkg, customer, completedAt, versions: revisions + 1, revisions, onTime, rating, days, reviewNote, commission });
  }
  return items.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
// The whole-team archive: hand-authored where present, generated otherwise.
const WORK_ARCHIVE_ALL: Record<string, WorkItem[]> = (() => {
  const out: Record<string, WorkItem[]> = { ...WORK_ARCHIVE };
  for (const s of STAFF) if (!out[s.id]) out[s.id] = genWorkArchive(s);
  return out;
})();

export const workHistory = (staffId: string = CURRENT_STAFF.id): WorkItem[] =>
  [...(WORK_ARCHIVE_ALL[staffId] ?? [])].sort((a, b) => b.completedAt.localeCompare(a.completedAt));

// Detail lookups for the history task page.
export const archivedTask = (code: string, staffId: string = CURRENT_STAFF.id): WorkItem | undefined =>
  (WORK_ARCHIVE_ALL[staffId] ?? []).find((w) => w.code === code);
// If this archived task is still a live task on the staff board, its id (→ full task page); else null.
export const liveTaskIdForCode = (code: string): string | null =>
  MY_TASKS.find((t) => t.code === code)?.id ?? null;

export const myWorkStats = (staffId: string = CURRENT_STAFF.id) => computeWorkStats(workHistory(staffId));

// Active (in-flight) tasks right now — counted from the live board, money stripped.
export const activeWorkload = (staffId: string = CURRENT_STAFF.id): number =>
  myTasks(staffId).filter((t) => t.status !== 'completed' && t.status !== 'canceled').length;

// ---- Monthly earnings history (current month = real PAYOUTS; prior months seeded) ----
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EARNINGS_NOW = new Date('2026-06-26T00:00:00');
// Small deterministic hash so prior-month figures are stable across renders.
function earnSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function earningsHistory(staffId: string = CURRENT_STAFF.id, months = 6): MonthEarning[] {
  const payout = PAYOUTS.find((p) => p.staffId === staffId);
  const base = payout?.base ?? 1000;
  const current = myEarnings(staffId);
  const archive = WORK_ARCHIVE[staffId] ?? [];
  const out: MonthEarning[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(EARNINGS_NOW.getFullYear(), EARNINGS_NOW.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const tasks = archive.filter((a) => a.completedAt.slice(0, 7) === ym).length;
    if (i === 0 && current) {
      // current month: the authoritative live payout (matches the Earnings card)
      out.push({ month: ym, label: MONTH_LABEL[d.getMonth()], base: current.base, commission: current.commission, bonus: current.bonus, takeHome: current.takeHome, tasks });
    } else {
      const seed = earnSeed(`${staffId}-${ym}`);
      // commission tracks that month's task volume, with a little organic jitter
      const commission = tasks * 42 + (seed % 60);
      const bonus = [0, 0, 0, 100, 150][seed % 5];
      out.push({ month: ym, label: MONTH_LABEL[d.getMonth()], base, commission, bonus, takeHome: base + commission + bonus, tasks });
    }
  }
  return out;
}

export const myEarningsSummary = (staffId: string = CURRENT_STAFF.id) => summariseEarnings(earningsHistory(staffId));

// ---- Work activity: tasks (and the pay they earn) bucketed by Day/Week/Month/Year, split by type ----
// Deterministic synthetic series so every granularity has substance (the 16-task rated archive is
// too sparse for a day view). Content-weighted to match a Content Lead. Each slice carries both the
// task count and the variable pay those tasks earned, so the chart can show either metric.
export type Granularity = 'day' | 'week' | 'month' | 'year';
export interface ActivitySlice { service: string; tasks: number; pay: number; }
export interface ActivityBucket { key: string; label: string; full: string; slices: ActivitySlice[]; tasks: number; pay: number; }

const ACT_TYPES = ['Content', 'Keyword', 'Optimization', 'Backlink', 'Audit', 'Indexer'];
const ACT_PAY: Record<string, number> = { Content: 22, Keyword: 18, Optimization: 35, Backlink: 30, Audit: 15, Indexer: 8 };
const ACT_WEIGHT: Record<string, number> = { Content: 5, Keyword: 2, Optimization: 2, Backlink: 1, Audit: 1, Indexer: 1 };
const ACT_WSUM = ACT_TYPES.reduce((a, t) => a + ACT_WEIGHT[t], 0);
const ACT_NOW = new Date('2026-06-26T00:00:00Z');
const MS_DAY = 86_400_000;

function actSlices(staffId: string, seedKey: string, intensity: number): ActivitySlice[] {
  const out: ActivitySlice[] = [];
  for (const service of ACT_TYPES) {
    const seed = earnSeed(`${staffId}-${seedKey}-${service}`);
    const expected = (intensity * ACT_WEIGHT[service]) / ACT_WSUM;
    const jitter = 0.5 + (seed % 100) / 100; // 0.5..1.5
    const tasks = Math.max(0, Math.round(expected * jitter));
    if (tasks > 0) out.push({ service, tasks, pay: tasks * ACT_PAY[service] });
  }
  return out;
}
function actBucket(key: string, label: string, full: string, slices: ActivitySlice[]): ActivityBucket {
  return { key, label, full, slices, tasks: slices.reduce((a, s) => a + s.tasks, 0), pay: slices.reduce((a, s) => a + s.pay, 0) };
}
const startOfWeekUTC = (d: Date): Date => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // back to Monday
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

export function buildActivity(staffId: string = CURRENT_STAFF.id): Record<Granularity, ActivityBucket[]> {
  const day: ActivityBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(ACT_NOW.getTime() - i * MS_DAY);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const iso = d.toISOString().slice(0, 10);
    const full = `${MONTH_LABEL[d.getUTCMonth()]} ${d.getUTCDate()}`;
    day.push(actBucket(iso, String(d.getUTCDate()), full, actSlices(staffId, `day-${iso}`, weekend ? 0.4 : 1.9)));
  }

  const week: ActivityBucket[] = [];
  const thisMon = startOfWeekUTC(ACT_NOW);
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(thisMon.getTime() - i * 7 * MS_DAY);
    const iso = ws.toISOString().slice(0, 10);
    const label = `${MONTH_LABEL[ws.getUTCMonth()]} ${ws.getUTCDate()}`;
    week.push(actBucket(iso, label, `Week of ${label}`, actSlices(staffId, `week-${iso}`, 3)));
  }

  const month: ActivityBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(ACT_NOW.getUTCFullYear(), ACT_NOW.getUTCMonth() - i, 1));
    const ym = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`;
    month.push(actBucket(ym, MONTH_LABEL[m.getUTCMonth()], `${MONTH_LABEL[m.getUTCMonth()]} ${m.getUTCFullYear()}`, actSlices(staffId, `month-${ym}`, 8)));
  }

  const year: ActivityBucket[] = [];
  for (const y of [2023, 2024, 2025, 2026]) {
    const elapsed = y === 2026 ? 0.48 : 1; // 2026 is partial (through late June)
    year.push(actBucket(String(y), String(y), `${y}${y === 2026 ? ' (YTD)' : ''}`, actSlices(staffId, `year-${y}`, 90 * elapsed)));
  }

  return { day, week, month, year };
}

// Type palette (label/icon/color) for the activity legend + segments.
export const ACTIVITY_TYPE_META = ACT_TYPES.map((service) => ({ service, ...serviceMeta(service) }));

// ───────────────────────────────────────────────────────────────────────────
// Finance surface: commission wallet · penalties · payout requests (Phase 0 mock)
// ───────────────────────────────────────────────────────────────────────────
// The ONLY place the staffer's own money is shown. Every figure below is a concrete
// commission-derived USD amount — never an order value, payout `basis`, or `rate` — so
// nothing here can be reverse-engineered into the price a customer paid. Hybrid model:
// base salary is admin payroll (from PAYOUTS, see myEarnings); commission accrues into
// this withdrawable wallet, which penalties debit.

// Commission/bonus that has accrued into the wallet (newest entries may still be clearing).
const COMMISSION_CREDITS: Record<string, WalletEntry[]> = {
  s3: [
    { id: 'wc0', kind: 'commission', label: 'Commission carried over', taskCode: null, at: '2026-06-01', amount: 700 },
    { id: 'wc1', kind: 'commission', label: 'Commission · CNT-1038', taskCode: 'CNT-1038', at: '2026-06-22', amount: 45 },
    { id: 'wc2', kind: 'commission', label: 'Commission · IDX-1012', taskCode: 'IDX-1012', at: '2026-06-20', amount: 24 },
    { id: 'wc3', kind: 'commission', label: 'Commission · CNT-1004', taskCode: 'CNT-1004', at: '2026-06-24', amount: 30 },
    { id: 'wc4', kind: 'bonus', label: 'Quality bonus · June', taskCode: null, at: '2026-06-26', amount: 100 },
    { id: 'wc5', kind: 'commission', label: 'Commission · CNT-1015', taskCode: 'CNT-1015', at: '2026-06-25', amount: 36, pending: true },
  ],
};

// Penalties — flagged by the rules below, then admin confirms (`applied`) or `waived`.
// Seeded to mirror Huy's real history (CNT-0925: 3 versions/2 revisions/rating 2; KW-0987: late).
const STAFF_PENALTIES: Record<string, StaffPenalty[]> = {
  s3: [
    {
      id: 'pen1', type: 'revision', taskCode: 'CNT-1004', reason: '3rd revision round — 1 over the 2-round allowance.',
      sizing: 'progressive', amount: 12, detail: 'Round 3 · 10% of task commission', status: 'pending',
      createdAt: '2026-06-24', by: 'Revision rule',
    },
    {
      id: 'pen2', type: 'late', taskCode: 'KW-0987', reason: 'Delivered 1 day after the deadline.',
      sizing: 'flat', amount: 25, detail: 'Flat late fee', status: 'applied',
      createdAt: '2026-05-20', by: 'Late-delivery rule',
    },
    {
      id: 'pen3', type: 'revision', taskCode: 'CNT-0925', reason: '4th round — 2 over the allowance.',
      sizing: 'pct', amount: 18, detail: '25% of task commission', status: 'applied',
      createdAt: '2026-03-08', by: 'Revision rule',
    },
    {
      id: 'pen4', type: 'rating', taskCode: 'CNT-0925', reason: 'QA rating 2/5 — below the 3-star bar.',
      sizing: 'flat', amount: 15, detail: 'Flat quality fee', status: 'waived',
      createdAt: '2026-03-09', by: 'Ken Rivera (waived — first offence)',
    },
  ],
};

// The auto-flagging rules, surfaced so staff understand how fines arise.
export const PENALTY_RULES: PenaltyRule[] = [
  { type: 'revision', label: 'Excess revisions', threshold: 'Beyond 2 revision rounds', sizing: 'progressive', value: 10, enabled: true },
  { type: 'late', label: 'Late delivery', threshold: 'Submitted after deadline', sizing: 'flat', value: 25, enabled: true },
  { type: 'rating', label: 'Low rating', threshold: 'QA or customer rating below 3★', sizing: 'flat', value: 15, enabled: true },
];

// Withdrawal methods on file (masked).
const PAYOUT_METHODS: Record<string, PayoutMethod[]> = {
  s3: [
    { id: 'pm1', kind: 'bank', label: 'Vietcombank ••4821', isDefault: true, feePct: 0, etaDays: 2 },
    { id: 'pm2', kind: 'paypal', label: 'huy•••@gmail.com', isDefault: false, feePct: 2, etaDays: 1 },
    { id: 'pm3', kind: 'wise', label: 'Wise · USD balance', isDefault: false, feePct: 1, etaDays: 1 },
  ],
};

// Past payout requests (the current session adds new ones client-side).
const PAYOUT_REQUESTS: Record<string, PayoutRequest[]> = {
  s3: [
    { id: 'po1', amount: 200, methodId: 'pm1', status: 'paid', requestedAt: '2026-06-05', note: 'Mid-cycle withdrawal' },
    { id: 'po2', amount: 180, methodId: 'pm1', status: 'paid', requestedAt: '2026-05-05' },
  ],
};

// ---- Per-staff finance generation (s3 hand-authored above; the rest derived from the archive) ----
// Wallet credits, penalties and payout history for the whole team, so the admin profile/ finance
// view is populated for everyone. All figures are commission-derived — never an order value.
function genCredits(s: { id: string; quality: number }): WalletEntry[] {
  const archive = WORK_ARCHIVE_ALL[s.id] ?? [];
  const june = archive.filter((a) => a.completedAt.slice(0, 7) === '2026-06');
  const carried = 300 + (archSeed(`${s.id}-wallet`) % 600);
  const out: WalletEntry[] = [{ id: `${s.id}-wc0`, kind: 'commission', label: 'Commission carried over', taskCode: null, at: '2026-06-01', amount: carried }];
  june.forEach((a, idx) => out.push({ id: `${s.id}-wc${idx + 1}`, kind: 'commission', label: `Commission · ${a.code}`, taskCode: a.code, at: a.completedAt, amount: a.commission, pending: idx === june.length - 1 && june.length > 1 }));
  if (s.quality >= 90) out.push({ id: `${s.id}-wb`, kind: 'bonus', label: 'Quality bonus · June', taskCode: null, at: '2026-06-26', amount: 100 });
  return out;
}
function genPenalties(s: { id: string }): StaffPenalty[] {
  const archive = WORK_ARCHIVE_ALL[s.id] ?? [];
  const out: StaffPenalty[] = [];
  let n = 1;
  const late = archive.filter((a) => !a.onTime);
  const heavyRev = archive.filter((a) => a.revisions >= 2);
  const lowRated = archive.filter((a) => a.rating !== null && a.rating <= 2);
  const recentRev = archive.find((a) => a.revisions === 1 && a.completedAt.slice(0, 7) === '2026-06');
  if (late[0]) out.push({ id: `${s.id}-pen${n++}`, type: 'late', taskCode: late[0].code, reason: 'Delivered after the deadline.', sizing: 'flat', amount: 25, detail: 'Flat late fee', status: 'applied', createdAt: late[0].completedAt, by: 'Late-delivery rule' });
  if (heavyRev[0]) out.push({ id: `${s.id}-pen${n++}`, type: 'revision', taskCode: heavyRev[0].code, reason: `${heavyRev[0].versions} versions — over the 2-round allowance.`, sizing: 'pct', amount: Math.max(8, Math.round(heavyRev[0].commission * 0.25)), detail: '25% of task commission', status: 'applied', createdAt: heavyRev[0].completedAt, by: 'Revision rule' });
  if (lowRated[0]) out.push({ id: `${s.id}-pen${n++}`, type: 'rating', taskCode: lowRated[0].code, reason: `QA rating ${lowRated[0].rating}/5 — below the 3-star bar.`, sizing: 'flat', amount: 15, detail: 'Flat quality fee', status: 'waived', createdAt: lowRated[0].completedAt, by: 'Manager (waived — first offence)' });
  if (recentRev) out.push({ id: `${s.id}-pen${n++}`, type: 'revision', taskCode: recentRev.code, reason: '3rd revision round — 1 over the 2-round allowance.', sizing: 'progressive', amount: Math.max(8, Math.round(recentRev.commission * 0.1)), detail: 'Round 3 · 10% of task commission', status: 'pending', createdAt: recentRev.completedAt, by: 'Revision rule' });
  return out;
}
function genPayouts(s: { id: string }): PayoutRequest[] {
  const seed = archSeed(`${s.id}-payouts`);
  return [
    { id: `${s.id}-po1`, amount: 150 + (seed % 5) * 30, methodId: `${s.id}-pm1`, status: 'paid', requestedAt: '2026-06-05', note: 'Mid-cycle withdrawal' },
    { id: `${s.id}-po2`, amount: 120 + ((seed >>> 4) % 5) * 30, methodId: `${s.id}-pm1`, status: 'paid', requestedAt: '2026-05-05' },
  ];
}
const COMMISSION_CREDITS_ALL: Record<string, WalletEntry[]> = (() => {
  const out: Record<string, WalletEntry[]> = { ...COMMISSION_CREDITS };
  for (const s of STAFF) if (!out[s.id]) out[s.id] = genCredits(s);
  return out;
})();
const STAFF_PENALTIES_ALL: Record<string, StaffPenalty[]> = (() => {
  const out: Record<string, StaffPenalty[]> = { ...STAFF_PENALTIES };
  for (const s of STAFF) if (!out[s.id]) out[s.id] = genPenalties(s);
  return out;
})();
const PAYOUT_METHODS_ALL: Record<string, PayoutMethod[]> = (() => {
  const out: Record<string, PayoutMethod[]> = { ...PAYOUT_METHODS };
  for (const s of STAFF) if (!out[s.id]) out[s.id] = [{ id: `${s.id}-pm1`, kind: 'bank', label: 'Bank transfer ••' + String(1000 + (archSeed(s.id) % 9000)).slice(-4), isDefault: true, feePct: 0, etaDays: 2 }];
  return out;
})();
const PAYOUT_REQUESTS_ALL: Record<string, PayoutRequest[]> = (() => {
  const out: Record<string, PayoutRequest[]> = { ...PAYOUT_REQUESTS };
  for (const s of STAFF) if (!out[s.id]) out[s.id] = genPayouts(s);
  return out;
})();

export const myCommissionCredits = (staffId: string = CURRENT_STAFF.id): WalletEntry[] => COMMISSION_CREDITS_ALL[staffId] ?? [];
export const myPenalties = (staffId: string = CURRENT_STAFF.id): StaffPenalty[] => STAFF_PENALTIES_ALL[staffId] ?? [];

// Penalties tied to one task → a per-status roll-up for the task-history table.
export interface TaskPenalty { applied: number; pending: number; waived: number; net: number; items: StaffPenalty[]; }
export function taskPenalty(code: string, staffId: string = CURRENT_STAFF.id): TaskPenalty | null {
  const items = myPenalties(staffId).filter((p) => p.taskCode === code);
  if (items.length === 0) return null;
  const sum = (st: string) => items.filter((p) => p.status === st).reduce((a, p) => a + p.amount, 0);
  const applied = sum('applied');
  const pending = sum('pending');
  return { applied, pending, waived: sum('waived'), net: applied + pending, items };
}
export const myPayoutMethods = (staffId: string = CURRENT_STAFF.id): PayoutMethod[] => PAYOUT_METHODS_ALL[staffId] ?? [];
export const myPayouts = (staffId: string = CURRENT_STAFF.id): PayoutRequest[] => PAYOUT_REQUESTS_ALL[staffId] ?? [];

// Everything the Finance page needs, bundled. Money-leak-safe: derives the wallet figures from
// the commission-only entries above and never touches PAYOUTS.basis / PAYOUTS.rate.
export interface StaffFinance {
  credits: WalletEntry[];
  penalties: StaffPenalty[];
  methods: PayoutMethod[];
  payouts: PayoutRequest[];
  rules: PenaltyRule[];
  balance: number;
  available: number;
  clearing: number;
  pendingFines: number;
}
export function myFinance(staffId: string = CURRENT_STAFF.id): StaffFinance {
  const credits = myCommissionCredits(staffId);
  const penalties = myPenalties(staffId);
  const payouts = myPayouts(staffId);
  return {
    credits, penalties, methods: myPayoutMethods(staffId), payouts, rules: PENALTY_RULES,
    balance: walletBalance(credits, penalties, payouts),
    available: availableToWithdraw(credits, penalties, payouts),
    clearing: clearingTotal(credits),
    pendingFines: pendingPenaltyCount(penalties),
  };
}

// Reward/bonus progress — derived from the staffer's own performance signals (streak, monthly
// rating/on-time/first-pass, team rank, lifetime volume). Money-leak-safe: reward amounts are
// fixed bonuses, never tied to a customer's order value.
const REWARDS_MONTH = '2026-06'; // "current" month for the demo (matches TODAY)
export function myRewards(staffId: string = CURRENT_STAFF.id): Reward[] {
  const history = workHistory(staffId);
  const monthItems = history.filter((h) => h.completedAt.slice(0, 7) === REWARDS_MONTH);
  const rated = monthItems.filter((h) => h.rating !== null);
  const monthAvgRating = rated.length ? rated.reduce((a, h) => a + (h.rating ?? 0), 0) / rated.length : null;
  const onTimeCount = monthItems.filter((h) => h.onTime).length;
  const firstPassCount = monthItems.filter((h) => h.revisions === 0).length;
  const rank = rankByComposite(STAFF, staffId)?.rank ?? STAFF.length;
  return buildRewards({
    streakCurrent: firstPassStreak(history).current,
    monthAvgRating,
    monthRatedCount: rated.length,
    monthOnTimeRate: monthItems.length ? Math.round((onTimeCount / monthItems.length) * 100) : 0,
    monthFirstPassRate: monthItems.length ? Math.round((firstPassCount / monthItems.length) * 100) : 0,
    rank,
    teamSize: STAFF.length,
    lifetimeTasks: history.length,
  });
}
