// Staff-surface mock. Single source of truth = adminMock's ORDERS/DELIVERABLES.
// StaffTask deliberately OMITS money (value/price) at the type level, so a leak is a
// compile error, not a runtime check. Staff sees tasks, never prices or credit.
import {
  ORDERS, DELIVERABLES, ORDER_NOTE, SERVICE_SKILL, SKILL_META, qaCriteriaFor, briefFor,
  PAYOUTS, TRANSACTIONS,
  CUSTOMER_EXTRA, customerByCompany, CLIENT_NOTE, managerOf, TIER,
  type OrderStatus, type Priority, type AdminDeliverable, type Tier,
} from './adminMock';

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

export const MY_TASKS: StaffTask[] = MY_TASK_IDS
  .map((id) => ORDERS.find((o) => o.id === id))
  .filter((o): o is NonNullable<typeof o> => Boolean(o))
  .map((o) => {
    const brief = briefFor(o.id);
    return {
      id: o.id, code: o.code, customer: o.customer, service: o.service, pkg: o.pkg,
      status: o.status, priority: o.priority, skill: SERVICE_SKILL[o.service] ?? null,
      deadline: o.deadline, created: o.created,
      site: siteOf(brief), keywords: keywordsOf(brief),
      note: ORDER_NOTE[o.id] ?? null, qa: qaCriteriaFor(o.service), brief,
    };
  });

export const taskById = (id: string): StaffTask | undefined => MY_TASKS.find((t) => t.id === id);

// Deliverables for a task, oldest → newest (newest is the "current" submission).
export const deliverablesFor = (orderId: string): StaffDeliverable[] =>
  DELIVERABLES.filter((d) => d.orderId === orderId).sort((a, b) => a.version - b.version);

// Submission history across every task on the staffer's board — newest first for the table.
export interface MyDeliverable {
  d: StaffDeliverable; taskId: string; taskCode: string; service: string; customer: string;
}
export const myDeliverables = (): MyDeliverable[] =>
  MY_TASKS.flatMap((t) =>
    deliverablesFor(t.id).map((d) => ({ d, taskId: t.id, taskCode: t.code, service: t.service, customer: t.customer })),
  ).sort((a, b) => (b.d.submittedAt ?? '').localeCompare(a.d.submittedAt ?? ''));

// Rework rounds for a task = number of versions that were sent back for changes.
export const reworkCount = (orderId: string): number =>
  deliverablesFor(orderId).filter((d) => d.status === 'changes_requested').length;

// Headline quality stats for the deliverables workspace.
export interface DeliverableStats { total: number; approved: number; inReview: number; reworking: number; firstPassRate: number | null; }
export function deliverableStats(): DeliverableStats {
  const rows = myDeliverables();
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
export function myCustomers(): CaredCustomer[] {
  const map = new Map<string, CaredCustomer>();
  for (const t of MY_TASKS) {
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
export function latestReview(): LatestReview | null {
  const mine = new Set(MY_TASK_IDS);
  const d = DELIVERABLES
    .filter((x) => mine.has(x.orderId) && x.reviewNote && x.reviewedAt)
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))[0];
  if (!d) return null;
  const task = MY_TASKS.find((t) => t.id === d.orderId);
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
export const myManager = (): ManagerInfo => {
  const m = managerOf(CURRENT_STAFF.id);
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
export type StaffNotifKind = 'assignment' | 'changes' | 'reminder' | 'approved';
export interface StaffNotification {
  id: string; kind: StaffNotifKind; title: string; body: string;
  taskId: string | null; at: string; read: boolean;
}
export const STAFF_NOTIFICATIONS: StaffNotification[] = [
  { id: 'n1', kind: 'changes', title: 'Changes requested · CNT-1004', body: 'Add internal links and fill meta titles/descriptions before resubmitting.', taskId: 'o4', at: '2h ago', read: false },
  { id: 'n2', kind: 'assignment', title: 'New task assigned · KW-1031', body: 'A keyword map landed on your board — due in 3 days.', taskId: 'o31', at: '5h ago', read: false },
  { id: 'n3', kind: 'reminder', title: 'Deadline soon · BL-1008', body: 'Backlink batch is due tomorrow. Submit when ready.', taskId: 'o8', at: 'Yesterday', read: false },
  { id: 'n4', kind: 'approved', title: 'Approved · CNT-1015', body: 'Your Nova articles passed review — nice work. Scorecard updated.', taskId: 'o15', at: 'Yesterday', read: true },
  { id: 'n5', kind: 'reminder', title: 'Capacity check', body: 'You have 5 open tasks. Update availability if you need a lighter week.', taskId: null, at: '2d ago', read: true },
];

export const NOTIF_META: Record<StaffNotifKind, { icon: string; tone: string; label: string }> = {
  assignment: { icon: 'ph-tray-arrow-down', tone: 'text-primary', label: 'Assignment' },
  changes: { icon: 'ph-arrow-counter-clockwise', tone: 'text-amber-500', label: 'Changes requested' },
  reminder: { icon: 'ph-alarm', tone: 'text-sky-500', label: 'Reminder' },
  approved: { icon: 'ph-seal-check', tone: 'text-emerald-500', label: 'Approved' },
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
