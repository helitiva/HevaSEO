// Mock data for the admin UI. Shapes mirror the design specs; replaced by DB later.
export type OrderStatus = 'new'|'confirmed'|'assigned'|'in_progress'|'internal_review'|'delivered'|'changes_requested'|'approved'|'completed'|'canceled';
export type Priority = 'low'|'med'|'high';

export interface AdminOrder {
  id: string; code: string; customer: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; source: 'quick'|'dashboard';
  value: number; staff: string | null; deadline: string | null; created: string;
}
export interface AdminCustomer {
  id: string; name: string; company: string; email: string; status: 'shadow'|'claimed';
  orders: number; spend: number; balance: number; lastActive: string; tier: Tier;
}
export interface AdminStaff {
  id: string; name: string; skills: string[]; capacity: number; openLoad: number;
  composite: number; quality: number; onTime: number; throughput: number; active: boolean;
}
export interface AdminTicket {
  id: string; subject: string; customer: string; status: 'open'|'pending'|'resolved'|'closed';
  priority: Priority; assignee: string | null; age: string;
}
export interface AdminRule { id: string; service: string; pkg: string | null; mode: 'pin'|'auto'; target: string | null; priority: number; active: boolean; }
export interface AuditEntry { id: string; at: string; actor: string; entity: string; action: string; change: string; }

export const KPIS = {
  newOrders: 6, inProgress: 11, overdue: 3, awaitingApproval: 4,
  revenueToday: 1240, revenueMtd: 18650, openTickets: 5, unassigned: 2,
};

export const ORDERS: AdminOrder[] = [
  { id: 'o1', code: 'AUD-1001', customer: 'Acme Co', service: 'Audit', pkg: 'Standard', status: 'new', priority: 'high', source: 'quick', value: 39, staff: null, deadline: '2026-06-26', created: '2026-06-24' },
  { id: 'o2', code: 'KW-1002', customer: 'Bright Ltd', service: 'Keyword', pkg: 'Standard', status: 'in_progress', priority: 'med', source: 'dashboard', value: 39, staff: 'Mai T.', deadline: '2026-06-25', created: '2026-06-23' },
  { id: 'o3', code: 'BL-1003', customer: 'Nova', service: 'Backlink', pkg: 'Growth', status: 'internal_review', priority: 'high', source: 'dashboard', value: 64, staff: 'Linh P.', deadline: '2026-06-24', created: '2026-06-21' },
  { id: 'o4', code: 'CNT-1004', customer: 'Acme Co', service: 'Content', pkg: '10 articles', status: 'delivered', priority: 'med', source: 'quick', value: 120, staff: 'Huy N.', deadline: '2026-06-27', created: '2026-06-20' },
  { id: 'o5', code: 'OPT-1005', customer: 'Vértice', service: 'Optimization', pkg: 'Standard', status: 'completed', priority: 'low', source: 'dashboard', value: 79, staff: 'Mai T.', deadline: '2026-06-22', created: '2026-06-18' },
  { id: 'o6', code: 'BL-1006', customer: 'Nova', service: 'Backlink', pkg: 'Power', status: 'assigned', priority: 'high', source: 'dashboard', value: 104, staff: 'Linh P.', deadline: '2026-06-28', created: '2026-06-22' },
  { id: 'o7', code: 'KW-1007', customer: 'Peak Digital', service: 'Keyword', pkg: 'Pro', status: 'confirmed', priority: 'med', source: 'quick', value: 79, staff: null, deadline: '2026-06-26', created: '2026-06-22' },
  { id: 'o8', code: 'CNT-1008', customer: 'Acme Co', service: 'Content', pkg: '5 articles', status: 'in_progress', priority: 'med', source: 'dashboard', value: 60, staff: 'Huy N.', deadline: '2026-06-25', created: '2026-06-19' },
  { id: 'o9', code: 'AUD-1009', customer: 'Lumen', service: 'Audit', pkg: 'Basic', status: 'new', priority: 'low', source: 'quick', value: 19, staff: null, deadline: '2026-06-27', created: '2026-06-24' },
  { id: 'o10', code: 'OPT-1010', customer: 'Vértice', service: 'Optimization', pkg: 'Ultra', status: 'approved', priority: 'med', source: 'dashboard', value: 140, staff: 'Mai T.', deadline: '2026-06-23', created: '2026-06-17' },
  { id: 'o11', code: 'WD-1011', customer: 'Nova', service: 'Web Design', pkg: 'E-commerce', status: 'assigned', priority: 'high', source: 'dashboard', value: 279, staff: 'Linh P.', deadline: '2026-07-02', created: '2026-06-16' },
  { id: 'o12', code: 'IDX-1012', customer: 'Peak Digital', service: 'Indexer', pkg: '—', status: 'completed', priority: 'low', source: 'quick', value: 24, staff: 'Huy N.', deadline: '2026-06-20', created: '2026-06-14' },
  { id: 'o13', code: 'KW-1013', customer: 'Acme Co', service: 'Keyword', pkg: 'Standard', status: 'completed', priority: 'med', source: 'dashboard', value: 39, staff: 'Mai T.', deadline: '2026-06-19', created: '2026-06-13' },
  { id: 'o14', code: 'BL-1014', customer: 'Bright Ltd', service: 'Backlink', pkg: 'Starter', status: 'changes_requested', priority: 'high', source: 'quick', value: 36, staff: 'Linh P.', deadline: '2026-06-24', created: '2026-06-12' },
  { id: 'o15', code: 'CNT-1015', customer: 'Nova', service: 'Content', pkg: '3 articles', status: 'delivered', priority: 'med', source: 'dashboard', value: 36, staff: 'Huy N.', deadline: '2026-06-26', created: '2026-06-11' },
  { id: 'o16', code: 'AUD-1016', customer: 'Vértice', service: 'Audit', pkg: 'Standard', status: 'canceled', priority: 'low', source: 'quick', value: 39, staff: null, deadline: '2026-06-15', created: '2026-06-09' },
];

// Customer tiers (shown by icon in the orders/customers tables).
export type Tier = 'new' | 'silver' | 'gold' | 'vip';
export const TIER: Record<Tier, { label: string; icon: string; color: string }> = {
  new: { label: 'New', icon: 'ph-sparkle', color: '#38bdf8' },
  silver: { label: 'Silver', icon: 'ph-medal', color: '#94a3b8' },
  gold: { label: 'Gold', icon: 'ph-medal', color: '#f59e0b' },
  vip: { label: 'VIP', icon: 'ph-crown', color: '#a855f7' },
};
export function tierOf(spend: number): Tier {
  return spend >= 3000 ? 'vip' : spend >= 1500 ? 'gold' : spend >= 400 ? 'silver' : 'new';
}

export const CUSTOMERS: AdminCustomer[] = [
  { id: 'c1', name: 'Jane Doe', company: 'Acme Co', email: 'jane@acme.com', status: 'claimed', orders: 9, spend: 1840, balance: 320, lastActive: '2026-06-24', tier: 'gold' },
  { id: 'c2', name: 'Sam Lee', company: 'Bright Ltd', email: 'sam@bright.io', status: 'shadow', orders: 2, spend: 198, balance: 0, lastActive: '2026-06-23', tier: 'new' },
  { id: 'c3', name: 'Ana Ruiz', company: 'Nova', email: 'ana@nova.co', status: 'claimed', orders: 14, spend: 3180, balance: 540, lastActive: '2026-06-22', tier: 'vip' },
  { id: 'c4', name: 'Marco Vidal', company: 'Vértice', email: 'marco@vertice.es', status: 'claimed', orders: 6, spend: 920, balance: 80, lastActive: '2026-06-21', tier: 'silver' },
  { id: 'c5', name: 'Priya Nair', company: 'Peak Digital', email: 'priya@peak.io', status: 'claimed', orders: 4, spend: 640, balance: 0, lastActive: '2026-06-20', tier: 'silver' },
  { id: 'c6', name: 'Tom Vale', company: 'Lumen', email: 'tom@lumen.co', status: 'shadow', orders: 1, spend: 79, balance: 0, lastActive: '2026-06-24', tier: 'new' },
];
export const customerByCompany = (company: string) => CUSTOMERS.find((c) => c.company === company);

// Full order intake: what's included, the customer's brief inputs, upsells, and bundled orders.
export interface OrderExtra {
  included: string[];
  brief: { label: string; value: string }[];
  addons: { name: string; tier: string; price: number }[];
  bundle: string[]; // ids of related orders placed together (upsells)
  project?: string; // customer project the order was filed into
  folder?: string;  // folder within that project
}
export const ORDER_EXTRA: Record<string, OrderExtra> = {
  o1: {
    project: 'Acme — Main site',
    folder: 'Money pages',
    included: ['Full site crawl (up to 500 URLs)', 'Technical SEO audit', 'On-page analysis', 'Competitor snapshot (3 rivals)', 'Prioritised fix roadmap'],
    brief: [
      { label: 'Website', value: 'https://acme.com' },
      { label: 'Primary goal', value: 'Recover rankings lost after the site redesign' },
      { label: 'Target market', value: 'United States · English' },
      { label: 'Top competitors', value: 'rivalco.com, betterwidgets.com' },
      { label: 'CMS / platform', value: 'WordPress + WooCommerce' },
      { label: 'Notes', value: 'Focus on the money pages (/pricing, /shop).' },
    ],
    addons: [
      { name: 'Keyword Research', tier: 'Standard', price: 39 },
      { name: 'Content — 5 articles', tier: 'AI-assisted', price: 60 },
    ],
    bundle: ['o8', 'o13'],
  },
};

export const SERVICE_INCLUDED: Record<string, string[]> = {
  Audit: ['Full site crawl', 'Technical + on-page audit', 'Competitor snapshot', 'Fix roadmap'],
  Keyword: ['Keyword clusters', 'Volume & difficulty', 'Intent mapping', 'Competitor gap'],
  Backlink: ['Prospecting & vetting', 'Outreach', 'Link placement', 'Index verification'],
  Content: ['SEO-optimised articles', 'Keyword targeting', 'Internal linking', 'Editorial review'],
  Optimization: ['Speed optimisation', 'On-page + schema', 'Core Web Vitals', 'Deploy + report'],
  'Web Design': ['Responsive build', 'On-page SEO setup', 'Schema & sitemap', 'QA + deploy'],
  Indexer: ['Index submission', 'Retry pending links', 'Per-link status report'],
};

export const STAFF: AdminStaff[] = [
  { id: 's1', name: 'Mai T.', skills: ['keyword','optimize'], capacity: 6, openLoad: 3, composite: 92, quality: 95, onTime: 90, throughput: 22, active: true },
  { id: 's2', name: 'Linh P.', skills: ['backlink'], capacity: 5, openLoad: 4, composite: 88, quality: 86, onTime: 92, throughput: 31, active: true },
  { id: 's3', name: 'Huy N.', skills: ['content'], capacity: 8, openLoad: 5, composite: 84, quality: 88, onTime: 79, throughput: 40, active: true },
];

export const TICKETS: AdminTicket[] = [
  { id: 't1', subject: 'When will my report be ready?', customer: 'Acme Co', status: 'open', priority: 'high', assignee: null, age: '2h' },
  { id: 't2', subject: 'Invoice question', customer: 'Nova', status: 'pending', priority: 'med', assignee: 'Mai T.', age: '1d' },
];

export const RULES: AdminRule[] = [
  { id: 'r1', service: 'Backlink', pkg: null, mode: 'pin', target: 'Linh P.', priority: 10, active: true },
  { id: 'r2', service: 'Content', pkg: null, mode: 'auto', target: null, priority: 50, active: true },
];

export const AUDIT: AuditEntry[] = [
  { id: 'a1', at: '2026-06-24 09:12', actor: 'Admin', entity: 'order', action: 'transition', change: 'AUD-1001 new→confirmed' },
  { id: 'a2', at: '2026-06-24 08:40', actor: 'Admin', entity: 'order', action: 'assign', change: 'KW-1002 → Mai T.' },
];

export const statusLabel: Record<OrderStatus, string> = {
  new:'New', confirmed:'Confirmed', assigned:'Assigned', in_progress:'In progress', internal_review:'Internal review',
  delivered:'Delivered', changes_requested:'Changes requested', approved:'Approved', completed:'Completed', canceled:'Canceled',
};
export const money = (n: number) => `$${n.toLocaleString('en-US')}`;

// ---- Command Center extras (data-viz) -------------------------------
export const REVENUE_SERIES = [620, 840, 760, 980, 1120, 900, 1340, 1180, 1010, 1450, 1290, 1510, 1380, 1240];
export const REVENUE_DELTA = 12.4; // % vs the prior 14-day window
export const SLA_ON_TIME = 87;     // % of orders delivered on time
export const CAPACITY_USED = 63;   // % of total staff capacity in use

export interface PipelineStage { status: OrderStatus; label: string; count: number; }
export const PIPELINE: PipelineStage[] = [
  { status: 'new', label: 'New', count: 6 },
  { status: 'confirmed', label: 'Confirmed', count: 4 },
  { status: 'assigned', label: 'Assigned', count: 5 },
  { status: 'in_progress', label: 'In progress', count: 11 },
  { status: 'internal_review', label: 'Review', count: 3 },
  { status: 'delivered', label: 'Delivered', count: 4 },
  { status: 'approved', label: 'Approved', count: 2 },
  { status: 'completed', label: 'Completed', count: 38 },
];

export const PIPELINE_COLOR: Record<OrderStatus, string> = {
  new: '#60a5fa', confirmed: '#38bdf8', assigned: '#22d3ee', in_progress: '#2563eb',
  internal_review: '#a78bfa', delivered: '#f59e0b', changes_requested: '#fb923c',
  approved: '#34d399', completed: '#10b981', canceled: '#94a3b8',
};

export interface OpsKpi {
  key: string; icon: string; label: string; value: number;
  trend: number[]; delta: number; deltaGood: boolean; tone: 'primary' | 'warn' | 'good';
}
export const OPS_KPIS: OpsKpi[] = [
  { key: 'new', icon: 'ph-tray', label: 'New orders', value: KPIS.newOrders, trend: [3, 5, 4, 6, 5, 7, 6], delta: 9, deltaGood: true, tone: 'primary' },
  { key: 'wip', icon: 'ph-spinner-gap', label: 'In progress', value: KPIS.inProgress, trend: [8, 9, 11, 10, 12, 11, 11], delta: 4, deltaGood: true, tone: 'primary' },
  { key: 'overdue', icon: 'ph-warning', label: 'Overdue', value: KPIS.overdue, trend: [1, 2, 1, 3, 2, 3, 3], delta: 12, deltaGood: false, tone: 'warn' },
  { key: 'unassigned', icon: 'ph-user-minus', label: 'Unassigned', value: KPIS.unassigned, trend: [4, 3, 2, 3, 2, 2, 2], delta: -20, deltaGood: true, tone: 'warn' },
];

// Daily revenue + order volume — 90 days, dated (ISO for range filtering, label for ticks).
export interface RevenuePoint { iso: string; date: string; revenue: number; orders: number; }
function genRevenue(days: number): RevenuePoint[] {
  const out: RevenuePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date('2026-06-24T00:00:00');
    d.setDate(d.getDate() - (days - 1 - i));
    const dow = d.getDay();
    const trend = 560 + i * 7;
    const wiggle = Math.round(170 * Math.sin(i / 2.3)) + (dow === 0 || dow === 6 ? -170 : 70);
    const revenue = Math.max(280, trend + wiggle);
    out.push({
      iso: d.toISOString().slice(0, 10),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue,
      orders: Math.round(revenue / 80) + (i % 4),
    });
  }
  return out;
}
export const REVENUE_90: RevenuePoint[] = genRevenue(90);

// Visitor geo distribution (detected by IP). x/y are normalized map coords (0..1).
export interface GeoRow { country: string; flag: string; users: number; x: number; y: number; }
export const GEO: GeoRow[] = [
  { country: 'United States', flag: '🇺🇸', users: 1840, x: 0.21, y: 0.42 },
  { country: 'United Kingdom', flag: '🇬🇧', users: 720, x: 0.47, y: 0.34 },
  { country: 'Germany', flag: '🇩🇪', users: 560, x: 0.52, y: 0.37 },
  { country: 'Canada', flag: '🇨🇦', users: 430, x: 0.19, y: 0.31 },
  { country: 'India', flag: '🇮🇳', users: 360, x: 0.69, y: 0.52 },
  { country: 'Australia', flag: '🇦🇺', users: 320, x: 0.84, y: 0.74 },
  { country: 'Singapore', flag: '🇸🇬', users: 220, x: 0.75, y: 0.59 },
  { country: 'Brazil', flag: '🇧🇷', users: 190, x: 0.34, y: 0.69 },
];

// Support / ticket aggregate.
export const TICKET_STATS = { open: 5, pending: 3, resolved: 28, closed: 64, answeredToday: 12, avgFirstResponseH: 1.8 };

// Orders by acquisition source (for conversion donut).
export const SOURCE_SPLIT = { quick: 64, dashboard: 41 };

// Monthly revenue goal.
export const REVENUE_GOAL = { mtd: 18650, target: 26000 };

// ---- Audience / user analytics --------------------------------------
export const USER_STATS = {
  newToday: 38, newWeek: 214, newMonth: 902,
  dau: 1240, wau: 4380, mau: 9820,
  stickiness: 13,            // DAU/MAU %
  retention30: 41, churn30: 6.2,
  newPct: 58, returningPct: 42,
  avgSessionMin: 4.6, sessionsPerUser: 2.3, bounceRate: 38, visitorToCustomer: 3.1,
};

export interface UserKpi { key: string; icon: string; label: string; value: string; trend: number[]; delta: number; deltaGood: boolean; }
export const USER_KPIS: UserKpi[] = [
  { key: 'newToday', icon: 'ph-user-plus', label: 'New users · today', value: '38', trend: [22, 28, 31, 26, 35, 33, 38], delta: 9, deltaGood: true },
  { key: 'newWeek', icon: 'ph-user-circle-plus', label: 'New · this week', value: '214', trend: [180, 195, 205, 198, 210, 208, 214], delta: 6, deltaGood: true },
  { key: 'newMonth', icon: 'ph-users-four', label: 'New · this month', value: '902', trend: [700, 760, 810, 840, 870, 890, 902], delta: 11, deltaGood: true },
  { key: 'dau', icon: 'ph-pulse', label: 'DAU', value: '1,240', trend: [1100, 1180, 1150, 1220, 1200, 1260, 1240], delta: 3, deltaGood: true },
  { key: 'wau', icon: 'ph-chart-line', label: 'WAU', value: '4,380', trend: [3900, 4050, 4120, 4200, 4280, 4340, 4380], delta: 4, deltaGood: true },
  { key: 'mau', icon: 'ph-users-three', label: 'MAU', value: '9,820', trend: [8800, 9000, 9200, 9400, 9600, 9750, 9820], delta: 5, deltaGood: true },
];

export interface DauPoint { date: string; dau: number; }
function genDau(days: number): DauPoint[] {
  const out: DauPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date('2026-06-24T00:00:00');
    d.setDate(d.getDate() - (days - 1 - i));
    const dow = d.getDay();
    const base = 960 + i * 9;
    const w = Math.round(120 * Math.sin(i / 2)) + (dow === 0 || dow === 6 ? -180 : 60);
    out.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), dau: Math.max(600, base + w) });
  }
  return out;
}
export const DAU_SERIES: DauPoint[] = genDau(30);

export const RETENTION: { day: string; pct: number }[] = [
  { day: 'D0', pct: 100 }, { day: 'D1', pct: 62 }, { day: 'D3', pct: 48 },
  { day: 'D7', pct: 41 }, { day: 'D14', pct: 33 }, { day: 'D30', pct: 27 },
];

export const FUNNEL: { stage: string; value: number }[] = [
  { stage: 'Visitors', value: 9820 }, { stage: 'Signups', value: 902 },
  { stage: 'First order', value: 312 }, { stage: 'Repeat buyer', value: 148 },
];

// ---- Revenue analytics (deep, for the Analytics page) ----------------
export const REVENUE_ANALYTICS = {
  grossMtd: 18650, refundsMtd: 540, netMtd: 18110,
  aov: 86, arpu: 14.2, payingCustomers: 1278,
  forecastNextMonth: 24200, forecastDelta: 14,
  bySource: [
    { label: 'Quick checkout', value: 9200, color: '#2563eb' },
    { label: 'Dashboard', value: 8910, color: '#10b981' },
  ],
};
export interface RevKpi { key: string; icon: string; label: string; value: string; delta?: number; deltaGood?: boolean; }
export const REVENUE_KPIS: RevKpi[] = [
  { key: 'gross', icon: 'ph-currency-dollar', label: 'Gross · MTD', value: '$18,650', delta: 12, deltaGood: true },
  { key: 'net', icon: 'ph-receipt', label: 'Net (after refunds)', value: '$18,110', delta: 11, deltaGood: true },
  { key: 'aov', icon: 'ph-shopping-bag', label: 'Avg order value', value: '$86', delta: 4, deltaGood: true },
  { key: 'arpu', icon: 'ph-user', label: 'ARPU', value: '$14.2', delta: 2, deltaGood: true },
  { key: 'refunds', icon: 'ph-arrow-u-down-left', label: 'Refunds · MTD', value: '$540', delta: 8, deltaGood: false },
  { key: 'forecast', icon: 'ph-trend-up', label: 'Forecast · next mo.', value: '$24,200', delta: 14, deltaGood: true },
];

// Share of orders by service — both by order count and by revenue value.
export interface ServiceMixRow { service: string; orders: number; value: number; color: string; }
export const SERVICE_MIX: ServiceMixRow[] = [
  { service: 'Keyword', orders: 51, value: 1990, color: '#38bdf8' },
  { service: 'Backlink', orders: 42, value: 3180, color: '#2563eb' },
  { service: 'Content', orders: 38, value: 4120, color: '#10b981' },
  { service: 'Audit', orders: 29, value: 1130, color: '#a78bfa' },
  { service: 'Optimization', orders: 24, value: 1900, color: '#f59e0b' },
  { service: 'Indexer', orders: 18, value: 640, color: '#34d399' },
  { service: 'Web Design', orders: 9, value: 1610, color: '#fb923c' },
];
