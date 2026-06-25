/**
 * Mock data for the dashboard UI (mirrors the HTML demo).
 * This module is the ONLY place screens read data from — when the Supabase
 * backend lands (master-plan Phase 1), swap these exports for real queries
 * and the UI stays untouched.
 */

export type ServiceKey =
  | 'backlink' | 'content' | 'indexer' | 'audit' | 'optimize' | 'keyword' | 'design';

export type OrderStatus = 'planned' | 'progress' | 'review' | 'completed';
export type Priority = 'high' | 'med' | 'low';
export type PayStatus = 'paid' | 'pending';

export const SERVICES: Record<ServiceKey, { label: string; icon: string }> = {
  backlink: { label: 'Backlink', icon: 'ph-share-network' },
  content: { label: 'Content', icon: 'ph-pen-nib' },
  indexer: { label: 'Indexer', icon: 'ph-magnifying-glass' },
  audit: { label: 'Audit', icon: 'ph-stethoscope' },
  optimize: { label: 'Optimization', icon: 'ph-gauge' },
  keyword: { label: 'Keywords', icon: 'ph-tree-structure' },
  design: { label: 'Design', icon: 'ph-palette' },
};

export const STATUSES: Record<OrderStatus, { label: string; color: string }> = {
  planned: { label: 'Planned', color: '#94a3b8' },
  progress: { label: 'In progress', color: '#2563eb' },
  review: { label: 'In review', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#10b981' },
};

export const PRIORITIES: Record<Priority, string> = { high: 'High', med: 'Med', low: 'Low' };

/** Demo credit balance, in USD. */
export const CREDIT_BALANCE = 179;

export interface Order {
  id: string;
  date: string;
  title: string;
  service: ServiceKey;
  domain: string;
  sub: string;
  /** number of URLs (e.g. indexer batches) */
  urls?: number;
  /** true when the order spans several websites (indexer multi-site) */
  multiWeb?: boolean;
  status: OrderStatus;
  priority: Priority;
  progress: number | null;
  detail?: string;
  eta: string;
  owner: string;
  /** cost in USD */
  cost: number;
  pay: PayStatus;
  invoice: string | null;
  /** the brief the customer submitted at order time (captured from the order form) */
  intake?: IntakeField[];
}

/** One answer from the order-time brief. `full` spans the full width when rendered. */
export interface IntakeField { label: string; value: string; full?: boolean; }

export const ORDERS: Order[] = [
  { id: 'BLEN-1042', date: '06/05/2026', title: 'Entity Growth', service: 'backlink', domain: 'hevashop.com', sub: '80 profiles · NAP, citations', status: 'planned', priority: 'high', progress: null, detail: 'NAP · social', eta: '3 days', owner: 'Daniel Brooks', cost: 356, pay: 'pending', invoice: null },
  { id: 'KW-1041', date: '06/04/2026', title: 'Keyword map', service: 'keyword', domain: 'clinicpro.com', sub: '48 terms · dermatology cluster', status: 'planned', priority: 'low', progress: null, detail: 'Dermatology cluster', eta: '5 days', owner: 'Emily Hart', cost: 0, pay: 'paid', invoice: 'INV-2041' },
  { id: 'AD-1040', date: '06/04/2026', title: 'Website audit', service: 'audit', domain: 'newsite.com', sub: '200+ criteria', status: 'planned', priority: 'med', progress: null, detail: 'Awaiting kickoff', eta: '4 days', owner: 'Ryan Cole', cost: 60, pay: 'pending', invoice: null },
  { id: 'WD-1038', date: '06/03/2026', title: 'Landing page design', service: 'design', domain: 'beautyspa.com', sub: '1 landing page', status: 'planned', priority: 'low', progress: null, detail: 'Brief completed', eta: '2 weeks', owner: 'Grace Lee', cost: 600, pay: 'pending', invoice: null },
  { id: 'CT-1033', date: '05/28/2026', title: 'Content SEO/GEO x30', service: 'content', domain: 'hevashop.com', sub: '12/30 articles · E-E-A-T', status: 'progress', priority: 'med', progress: 40, eta: '8 days', owner: 'Sophie Lane', cost: 700, pay: 'paid', invoice: 'INV-2033' },
  { id: 'IDX-1035', date: '05/30/2026', title: 'Indexer Pro', service: 'indexer', domain: 'hevashop.com', sub: '9.2k / 10k URLs · retry', urls: 10000, multiWeb: true, status: 'progress', priority: 'high', progress: 92, eta: '2 days', owner: 'Daniel Brooks', cost: 40, pay: 'paid', invoice: 'INV-2035' },
  { id: 'BLPR-1034', date: '05/29/2026', title: 'Press backlinks', service: 'backlink', domain: 'anphat.com', sub: '8 VIP press articles', status: 'progress', priority: 'high', progress: 60, eta: '6 days', owner: 'Emily Hart', cost: 356, pay: 'paid', invoice: 'INV-2034' },
  { id: 'OP-1030', date: '05/26/2026', title: 'Core Web Vitals optimization', service: 'optimize', domain: 'techland.com', sub: 'LCP · INP · CLS', status: 'progress', priority: 'med', progress: 55, eta: '1 week', owner: 'Ryan Cole', cost: 156, pay: 'paid', invoice: 'INV-2030' },
  { id: 'CT-1029', date: '05/25/2026', title: 'Content, 10 articles', service: 'content', domain: 'clinicpro.com', sub: '6/10 articles', status: 'progress', priority: 'low', progress: 60, eta: '5 days', owner: 'Sophie Lane', cost: 260, pay: 'paid', invoice: 'INV-2029' },
  { id: 'CT-1028', date: '05/24/2026', title: 'Dental cluster articles', service: 'content', domain: 'clinicpro.com', sub: '5 articles in review', status: 'review', priority: 'med', progress: 100, detail: 'In review', eta: 'Today', owner: 'Grace Lee', cost: 260, pay: 'paid', invoice: 'INV-2028' },
  { id: 'AD-1027', date: '05/23/2026', title: 'Website audit', service: 'audit', domain: 'saigonhomes.com', sub: 'Report awaiting handover', status: 'review', priority: 'high', progress: 100, detail: 'Awaiting handover', eta: 'Today', owner: 'Daniel Brooks', cost: 60, pay: 'paid', invoice: 'INV-2027' },
  { id: 'AD-1015', date: '05/12/2026', title: 'Website audit', service: 'audit', domain: 'anphat.com', sub: 'Score 78/100', status: 'completed', priority: 'low', progress: 100, detail: 'SEO 78/100', eta: 'Delivered', owner: 'Emily Hart', cost: 60, pay: 'paid', invoice: 'INV-2015' },
  { id: 'BLEN-1012', date: '05/08/2026', title: 'Entity citations', service: 'backlink', domain: 'hevashop.com', sub: '65 profiles live', status: 'completed', priority: 'med', progress: 100, detail: '65 live', eta: 'Delivered', owner: 'Ryan Cole', cost: 156, pay: 'paid', invoice: 'INV-2012' },
  { id: 'IDX-1009', date: '05/05/2026', title: 'Indexer batch', service: 'indexer', domain: 'techland.com', sub: '5,000 links · 98% indexed', urls: 5000, status: 'completed', priority: 'low', progress: 100, detail: '98% indexed', eta: 'Delivered', owner: 'Sophie Lane', cost: 12, pay: 'paid', invoice: 'INV-2009' },
  { id: 'CT-1004', date: '04/28/2026', title: 'Content, 20 articles', service: 'content', domain: 'vietbeauty.com', sub: '20/20 published', status: 'completed', priority: 'med', progress: 100, detail: 'Published', eta: 'Delivered', owner: 'Grace Lee', cost: 700, pay: 'paid', invoice: 'INV-2004' },
  { id: 'OP-1001', date: '04/20/2026', title: 'Speed optimization', service: 'optimize', domain: 'saigonhomes.com', sub: '5.2s → 1.8s', status: 'completed', priority: 'low', progress: 100, detail: '5.2s → 1.8s', eta: 'Delivered', owner: 'Daniel Brooks', cost: 156, pay: 'paid', invoice: 'INV-2001' },
];

export interface Project {
  id: string;
  /** project name the customer created */
  name: string;
  domain: string;
  label: string;
  folder: string;
  status: 'progress' | 'completed' | 'planned';
  note: string;
  updated: string;
  tags: Partial<Record<ServiceKey, { plan: number; run: number; done: number }>>;
}

export const FOLDERS = [
  { id: 'ecom', name: 'E-commerce client', color: '#2563eb', parentId: null as string | null },
  { id: 'ecom-fashion', name: 'Fashion', color: '#6366f1', parentId: 'ecom' },
  { id: 'internal', name: 'Internal project', color: '#10b981', parentId: null },
  { id: 'health', name: 'Client — Healthcare & Spa', color: '#f59e0b', parentId: null },
  { id: 'health-spa', name: 'Spa & Aesthetics', color: '#ec4899', parentId: 'health' },
];

export const PROJECTS: Project[] = [
  { id: 'p1', name: 'HevaShop Store', domain: 'hevashop.com', label: 'E-commerce client', folder: 'ecom', status: 'progress', note: 'Pushing entity in Q2, prioritizing the “authentic cosmetics” cluster. The client requests a report every 2 weeks.', updated: '2 minutes ago', tags: { backlink: { plan: 1, run: 1, done: 5 }, content: { plan: 0, run: 1, done: 18 }, indexer: { plan: 0, run: 1, done: 3 }, audit: { plan: 0, run: 0, done: 2 } } },
  { id: 'p2', name: 'An Phat Retail', domain: 'anphat.com', label: 'E-commerce client', folder: 'ecom', status: 'progress', note: 'Press backlinks are in their second wave. Awaiting client approval of the June content brief.', updated: 'Today', tags: { backlink: { plan: 0, run: 1, done: 3 }, content: { plan: 1, run: 0, done: 0 }, audit: { plan: 0, run: 0, done: 1 } } },
  { id: 'p3', name: 'Viet Beauty', domain: 'vietbeauty.com', label: 'Fashion', folder: 'ecom-fashion', status: 'completed', note: 'Delivered 20 content articles. Awaiting the client’s response on renewing the plan.', updated: 'Today', tags: { content: { plan: 0, run: 0, done: 20 } } },
  { id: 'p4', name: 'TechLand', domain: 'techland.com', label: 'Internal project', folder: 'internal', status: 'progress', note: 'Optimizing Core Web Vitals on the homepage + PDP. Monitoring LCP after deploy.', updated: 'Yesterday', tags: { optimize: { plan: 0, run: 1, done: 1 }, indexer: { plan: 0, run: 0, done: 1 } } },
  { id: 'p5', name: 'NewSite Launch', domain: 'newsite.com', label: 'Internal project', folder: 'internal', status: 'planned', note: 'New site, awaiting audit kickoff. Need GSC access from the client.', updated: 'Yesterday', tags: { audit: { plan: 1, run: 0, done: 0 } } },
  { id: 'p6', name: 'ClinicPro Clinic', domain: 'clinicpro.com', label: 'Client — Healthcare & Spa', folder: 'health', status: 'progress', note: 'Dermatology cluster content is in progress. Keyword map pending sign-off with the doctor.', updated: '2 days ago', tags: { content: { plan: 0, run: 2, done: 0 }, keyword: { plan: 1, run: 0, done: 0 } } },
  { id: 'p7', name: 'Saigon Homes', domain: 'saigonhomes.com', label: 'Client — Healthcare & Spa', folder: 'health', status: 'progress', note: 'Audit found 12 critical issues. Found mass indexing errors after the migration. Needs urgent attention before continuing.', updated: '2 days ago', tags: { audit: { plan: 0, run: 0, done: 1 }, optimize: { plan: 0, run: 0, done: 1 } } },
  { id: 'p8', name: 'Beauty Spa', domain: 'beautyspa.com', label: 'Spa & Aesthetics', folder: 'health-spa', status: 'planned', note: 'Landing brief is finalized; waiting on the design team to start.', updated: 'Just created', tags: { design: { plan: 1, run: 0, done: 0 } } },
];

/** Project name for a domain — used on the order cards. */
export function projectForDomain(domain: string): { name: string } | null {
  const proj = PROJECTS.find((p) => p.domain === domain);
  return proj ? { name: proj.name } : null;
}

/** Project id for a domain — used to deep-link a card to its project detail. */
export function projectIdForDomain(domain: string): string | null {
  return PROJECTS.find((p) => p.domain === domain)?.id ?? null;
}

/** Folder breadcrumb (root → leaf) for a domain's project. */
export function folderPathForDomain(domain: string): { id: string; name: string; color: string }[] {
  const proj = PROJECTS.find((p) => p.domain === domain);
  if (!proj) return [];
  const path: { id: string; name: string; color: string }[] = [];
  let cur = FOLDERS.find((f) => f.id === proj.folder);
  while (cur) {
    path.unshift({ id: cur.id, name: cur.name, color: cur.color });
    const parentId: string | null = cur.parentId;
    cur = parentId ? FOLDERS.find((f) => f.id === parentId) : undefined;
  }
  return path;
}

/** The folder a domain belongs to, via its project — drives the card's folder tag. */
export function folderForDomain(domain: string): { name: string; color: string } | null {
  const proj = PROJECTS.find((p) => p.domain === domain);
  if (!proj) return null;
  const f = FOLDERS.find((x) => x.id === proj.folder);
  return f ? { name: f.name, color: f.color } : { name: proj.label, color: '#64748b' };
}

// ── Order detail (slide-over panel) ───────────────────────────────────────────
export interface Deliverable { name: string; version: string; status: 'approved' | 'review' | 'rejected'; date: string; }
export interface OrderComment { author: string; initials: string; text: string; time: string; internal?: boolean; }
export interface Activity { label: string; date: string; }

const DELIVERABLES: Record<string, Deliverable[]> = {
  'CT-1033': [
    { name: 'Batch 1 — 5 articles', version: 'v1', status: 'approved', date: '06/02/2026' },
    { name: 'Batch 2 — 5 articles', version: 'v1', status: 'review', date: '06/08/2026' },
  ],
  'AD-1027': [{ name: 'Audit report', version: 'v2', status: 'review', date: '05/23/2026' }],
  'AD-1015': [{ name: 'Audit report (final)', version: 'final', status: 'approved', date: '05/12/2026' }],
  'IDX-1009': [{ name: 'Index coverage export', version: 'final', status: 'approved', date: '05/05/2026' }],
};
export function deliverablesFor(id: string): Deliverable[] { return DELIVERABLES[id] ?? []; }

const COMMENTS: Record<string, OrderComment[]> = {
  'CT-1033': [{ author: 'Huy', initials: 'HV', text: 'Can batch 2 lean more into product comparisons?', time: '1 day ago' }],
  'IDX-1035': [{ author: 'Daniel Brooks', initials: 'DB', text: 'Retrying the 800 URLs that failed first pass.', time: '3 hours ago', internal: true }],
};
export function commentsFor(id: string): OrderComment[] { return COMMENTS[id] ?? []; }

/** Build a plausible activity timeline (newest first) from the order's status. */
export function activityFor(o: Order): Activity[] {
  const order: OrderStatus[] = ['planned', 'progress', 'review', 'completed'];
  const idx = order.indexOf(o.status);
  const acts: Activity[] = [{ label: 'Order created', date: o.date }];
  if (idx >= 1) { acts.push({ label: `Assigned to ${o.owner}`, date: o.date }); acts.push({ label: 'Moved to In progress', date: o.date }); }
  if (idx >= 2) acts.push({ label: 'Submitted for review', date: o.eta });
  if (idx >= 3) acts.push({ label: 'Completed & delivered', date: o.eta });
  return acts.reverse();
}

/**
 * The brief the customer submitted at order time. Real for orders placed in this
 * session (captured from the order form into `o.intake`); for seed/demo orders we
 * return representative per-service answers, so each service shows a different,
 * fully-filled request — matching the fields its order form actually collects.
 */
export function intakeFor(o: Order): IntakeField[] {
  if (o.intake && o.intake.length) return o.intake;
  const url = `https://${o.domain}`;
  switch (o.service) {
    case 'backlink':
      return [
        { label: 'Target URL(s) to boost', value: `${url}\n${url}/products`, full: true },
        { label: 'Preferred anchors / keywords', value: 'brand name · primary keyword · naked URL', full: true },
        { label: 'Niche / industry', value: 'E-commerce · retail' },
        { label: 'Language / market', value: 'United States · English' },
      ];
    case 'audit':
      return [
        { label: 'What should the audit focus on?', value: 'A recent organic traffic drop and Core Web Vitals after the last redesign.', full: true },
        { label: 'GSC / Analytics access', value: "I'll share after we confirm" },
        { label: 'Target market / language', value: 'United States · English' },
        { label: 'Competitors to benchmark', value: 'competitor-one.com\ncompetitor-two.com', full: true },
      ];
    case 'content':
      return [
        { label: 'Tone / brand voice', value: 'Friendly expert' },
        { label: 'Language', value: 'English (US)' },
        { label: 'Style & guidelines for the batch', value: 'Lead with practical value, cite real sources, avoid hype. Audience: SMB owners researching options.', full: true },
      ];
    case 'keyword':
      return [
        { label: 'Website URL', value: url, full: true },
        { label: 'What does your site offer?', value: 'Products and services for our core customers, plus an SEO-driven blog to capture top-of-funnel search.', full: true },
        { label: 'Target market / language', value: 'United States · English' },
        { label: 'Primary goal', value: 'Grow organic traffic' },
        { label: 'Known competitors', value: 'competitor-one.com\ncompetitor-two.com', full: true },
      ];
    case 'optimize':
      return [
        { label: 'Website URL', value: url, full: true },
        { label: 'Platform / CMS', value: 'WordPress' },
        { label: 'Source / hosting access', value: "I'll grant access after we confirm" },
        { label: 'What do you most want to improve?', value: 'Page speed, Core Web Vitals (LCP / INP / CLS) and AI-readiness (GEO).', full: true },
      ];
    case 'design':
      return [
        { label: 'Existing website / domain', value: url },
        { label: 'Google Maps listing', value: 'Shared — pull info & photos' },
        { label: 'Tell us about your business', value: 'What we do, who we serve, and the goal for the new site.', full: true },
        { label: 'Reference sites you like', value: 'competitor-one.com\ncompetitor-two.com', full: true },
        { label: 'Brand colors / fonts', value: 'Navy + gold · modern sans' },
        { label: 'Logo & image links', value: 'Shared via Drive folder' },
      ];
    case 'indexer':
      return [
        { label: 'Links submitted', value: o.urls != null ? `${o.urls.toLocaleString('en-US')} URLs` : 'Pasted URL list' },
        { label: 'Anything we should know?', value: 'Links built elsewhere — please prioritize the money pages first.', full: true },
      ];
    default:
      return [];
  }
}

export interface CreditTx {
  date: string;
  description: string;
  type: 'topup' | 'order';
  amount: number; // +topup / -order, in USD
  status: 'success' | 'processing';
}

export const TRANSACTIONS: CreditTx[] = [
  { date: '06/06/2026', description: 'Visa •••• 4242', type: 'topup', amount: 199, status: 'success' },
  { date: '05/30/2026', description: 'Order IDX-1035 · Indexer Pro', type: 'order', amount: -40, status: 'success' },
  { date: '05/28/2026', description: 'Order CT-1033 · Content SEO/GEO', type: 'order', amount: -700, status: 'success' },
  { date: '05/08/2026', description: 'PayPal · huy@hevashop.com', type: 'topup', amount: 399, status: 'success' },
];

export interface Invoice {
  no: string;
  date: string;
  amount: number;
  status: 'issued' | 'processing';
}

export const INVOICES: Invoice[] = [
  { no: 'HD-2026-061', date: '06/07/2026', amount: 199, status: 'issued' },
  { no: 'HD-2026-055', date: '05/28/2026', amount: 399, status: 'issued' },
  { no: 'HD-2026-048', date: '05/12/2026', amount: 60, status: 'processing' },
];

export const ACTIVITY = [
  { icon: 'ph-check-circle', cls: 'text-emerald-500', html: '<b>1,284 links</b> indexed today', meta: '2 minutes ago · Indexer Pro' },
  { icon: 'ph-pen-nib', cls: 'text-primary', html: 'Article <b>“Affordable braces”</b> moved to In review', meta: '1 hour ago · Content' },
  { icon: 'ph-buildings', cls: 'text-primary', html: '<b>12 entities</b> newly live on a directory', meta: '3 hours ago · Backlink Entity' },
  { icon: 'ph-trend-up', cls: 'text-emerald-500', html: 'Main keyword <b>+11 spots</b> → Top 3', meta: 'Yesterday · Report' },
  { icon: 'ph-wallet', cls: 'text-primary', html: '<b>$199</b> credit top-up successful', meta: '2 days ago · Invoice' },
];
