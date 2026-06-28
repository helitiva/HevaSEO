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
  role: string; email: string; since: string; tz: string; trend: number[];
}
// Canonical skill taxonomy — shared by the staff roster, assignment, and routing rules.
export const SKILL_META: Record<string, { label: string; icon: string; color: string }> = {
  keyword: { label: 'Keyword', icon: 'ph-magnifying-glass', color: '#2563eb' },
  backlink: { label: 'Backlink', icon: 'ph-link-simple', color: '#a855f7' },
  content: { label: 'Content', icon: 'ph-article', color: '#0ea5e9' },
  optimize: { label: 'Optimization', icon: 'ph-gauge', color: '#10b981' },
};
// Order service → skill needed to deliver it (used to match active work to a staff's skills).
export const SERVICE_SKILL: Record<string, string> = {
  Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize', Audit: 'optimize', Indexer: 'optimize', 'Web Design': 'content',
};
export type TicketType = 'technical'|'billing'|'consultation';
export type TicketChannel = 'portal'|'whatsapp'|'messenger'|'email';
export type TicketStatus = 'open'|'pending'|'resolved'|'closed';
export type SlaTier = 'urgent'|'standard';
export interface TicketMessage { from: 'customer'|'staff'; author: string; text: string; at: string; }
export interface AdminTicket {
  id: string; code: string; subject: string;
  customer: string; customerId: string | null;
  type: TicketType; channel: TicketChannel; status: TicketStatus;
  priority: Priority; assignee: string | null; slaTier: SlaTier;
  orderCode: string | null;
  createdAt: string; lastReplyAt: string; age: string;
  thread: TicketMessage[];
}
export interface AdminRule { id: string; service: string; pkg: string | null; mode: 'pin'|'auto'; target: string | null; priority: number; active: boolean; }
export type AuditCategory = 'create' | 'update' | 'transition' | 'assign' | 'destructive' | 'auth';
export type AuditEntity = 'order' | 'customer' | 'staff' | 'rule' | 'ticket' | 'deliverable' | 'catalog' | 'auth';
export interface AuditEntry {
  id: string; at: string; actor: string;
  entity: AuditEntity; entityId: string | null; entityCode: string | null;
  action: string; from: string | null; to: string | null;
  category: AuditCategory; change: string;
  diff?: { field: string; from: string; to: string }[];
  meta?: Record<string, string | number>;
}

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
  // --- unassigned queue (staff: null) ---
  { id: 'o17', code: 'KW-1017', customer: 'Orbit Labs', service: 'Keyword', pkg: 'Pro', status: 'confirmed', priority: 'high', source: 'quick', value: 79, staff: null, deadline: '2026-06-26', created: '2026-06-23' },
  { id: 'o18', code: 'BL-1018', customer: 'Vertex AI', service: 'Backlink', pkg: 'Power', status: 'new', priority: 'high', source: 'dashboard', value: 104, staff: null, deadline: '2026-06-27', created: '2026-06-24' },
  { id: 'o19', code: 'CNT-1019', customer: 'Pulse Media', service: 'Content', pkg: '5 articles', status: 'confirmed', priority: 'med', source: 'dashboard', value: 60, staff: null, deadline: '2026-06-28', created: '2026-06-22' },
  { id: 'o20', code: 'OPT-1020', customer: 'Cobalt Studio', service: 'Optimization', pkg: 'Standard', status: 'new', priority: 'med', source: 'quick', value: 79, staff: null, deadline: '2026-06-29', created: '2026-06-25' },
  { id: 'o21', code: 'AUD-1021', customer: 'Greenfield', service: 'Audit', pkg: 'Basic', status: 'new', priority: 'low', source: 'quick', value: 19, staff: null, deadline: '2026-06-30', created: '2026-06-25' },
  { id: 'o22', code: 'BL-1022', customer: 'Acme Co', service: 'Backlink', pkg: 'Growth', status: 'confirmed', priority: 'high', source: 'dashboard', value: 64, staff: null, deadline: '2026-06-25', created: '2026-06-20' },
  { id: 'o23', code: 'KW-1023', customer: 'Nova', service: 'Keyword', pkg: 'Standard', status: 'new', priority: 'med', source: 'quick', value: 39, staff: null, deadline: '2026-06-28', created: '2026-06-24' },
  { id: 'o24', code: 'CNT-1024', customer: 'Vertex AI', service: 'Content', pkg: '10 articles', status: 'confirmed', priority: 'high', source: 'dashboard', value: 120, staff: null, deadline: '2026-06-26', created: '2026-06-21' },
  { id: 'o25', code: 'WD-1025', customer: 'Orbit Labs', service: 'Web Design', pkg: 'Landing', status: 'new', priority: 'med', source: 'dashboard', value: 159, staff: null, deadline: '2026-07-03', created: '2026-06-25' },
  // --- active work on staff ---
  { id: 'o26', code: 'CNT-1026', customer: 'Pulse Media', service: 'Content', pkg: '5 articles', status: 'in_progress', priority: 'med', source: 'dashboard', value: 60, staff: 'Diego R.', deadline: '2026-06-27', created: '2026-06-21' },
  { id: 'o27', code: 'OPT-1027', customer: 'Vértice', service: 'Optimization', pkg: 'Ultra', status: 'assigned', priority: 'high', source: 'dashboard', value: 140, staff: 'Diego R.', deadline: '2026-06-29', created: '2026-06-22' },
  { id: 'o28', code: 'KW-1028', customer: 'Cobalt Studio', service: 'Keyword', pkg: 'Pro', status: 'in_progress', priority: 'med', source: 'quick', value: 79, staff: 'Aria K.', deadline: '2026-06-26', created: '2026-06-20' },
  { id: 'o29', code: 'BL-1029', customer: 'Vertex AI', service: 'Backlink', pkg: 'Power', status: 'internal_review', priority: 'high', source: 'dashboard', value: 104, staff: 'Aria K.', deadline: '2026-06-25', created: '2026-06-19' },
  { id: 'o30', code: 'BL-1030', customer: 'Orbit Labs', service: 'Backlink', pkg: 'Growth', status: 'assigned', priority: 'med', source: 'dashboard', value: 64, staff: 'Tom B.', deadline: '2026-06-28', created: '2026-06-21' },
  { id: 'o31', code: 'CNT-1031', customer: 'Acme Co', service: 'Content', pkg: '3 articles', status: 'changes_requested', priority: 'high', source: 'dashboard', value: 36, staff: 'Tom B.', deadline: '2026-06-24', created: '2026-06-18' },
  { id: 'o32', code: 'KW-1032', customer: 'Bright Ltd', service: 'Keyword', pkg: 'Standard', status: 'in_progress', priority: 'med', source: 'dashboard', value: 39, staff: 'Mai T.', deadline: '2026-06-27', created: '2026-06-22' },
  { id: 'o33', code: 'BL-1033', customer: 'Nova', service: 'Backlink', pkg: 'Starter', status: 'assigned', priority: 'low', source: 'quick', value: 36, staff: 'Linh P.', deadline: '2026-06-30', created: '2026-06-23' },
  { id: 'o34', code: 'CNT-1034', customer: 'Vertex AI', service: 'Content', pkg: '10 articles', status: 'in_progress', priority: 'high', source: 'dashboard', value: 120, staff: 'Huy N.', deadline: '2026-06-26', created: '2026-06-20' },
  { id: 'o35', code: 'OPT-1035', customer: 'Pulse Media', service: 'Optimization', pkg: 'Standard', status: 'delivered', priority: 'med', source: 'dashboard', value: 79, staff: 'Diego R.', deadline: '2026-06-25', created: '2026-06-17' },
  { id: 'o36', code: 'KW-1036', customer: 'Orbit Labs', service: 'Keyword', pkg: 'Pro', status: 'assigned', priority: 'med', source: 'dashboard', value: 79, staff: 'Aria K.', deadline: '2026-06-29', created: '2026-06-24' },
  // --- closed (history/analytics) ---
  { id: 'o37', code: 'AUD-1037', customer: 'Cobalt Studio', service: 'Audit', pkg: 'Standard', status: 'completed', priority: 'low', source: 'quick', value: 39, staff: 'Mai T.', deadline: '2026-06-21', created: '2026-06-15' },
  { id: 'o38', code: 'CNT-1038', customer: 'Lumen', service: 'Content', pkg: '5 articles', status: 'approved', priority: 'med', source: 'dashboard', value: 60, staff: 'Huy N.', deadline: '2026-06-23', created: '2026-06-16' },
];

// ---- Deliverable Review (module 4): versioned submissions per order ----
export interface AdminDeliverable {
  id: string; orderId: string; version: number; kind: 'file' | 'link';
  fileName: string | null; url: string | null; note: string; staff: string;
  status: 'submitted' | 'approved' | 'changes_requested';
  submittedAt: string; reviewedAt: string | null; reviewNote: string | null;
}
export const DELIVERABLES: AdminDeliverable[] = [
  // CNT-1004 — re-submission (v1 was sent back, v2 awaiting review)
  { id: 'd1', orderId: 'o4', version: 1, kind: 'file', fileName: 'acme-blog-v1.docx', url: null, note: 'First draft — 5 posts.', staff: 'Huy N.', status: 'changes_requested', submittedAt: '2026-06-22', reviewedAt: '2026-06-23', reviewNote: 'Add internal links and fill meta titles/descriptions.' },
  { id: 'd2', orderId: 'o4', version: 2, kind: 'file', fileName: 'acme-blog-v2.docx', url: null, note: 'Added internal links + meta on all 5 posts as requested.', staff: 'Huy N.', status: 'submitted', submittedAt: '2026-06-24', reviewedAt: null, reviewNote: null },
  // CNT-1015 — first-pass, awaiting review
  { id: 'd3', orderId: 'o15', version: 1, kind: 'link', fileName: null, url: 'https://docs.google.com/document/d/nova-3-articles', note: 'Nova — 3 articles, published as drafts.', staff: 'Huy N.', status: 'submitted', submittedAt: '2026-06-24', reviewedAt: null, reviewNote: null },
  // OPT-1035 — awaiting review
  { id: 'd4', orderId: 'o35', version: 1, kind: 'file', fileName: 'pulse-optimization-report.pdf', url: null, note: 'On-page fixes applied; before/after metrics inside.', staff: 'Diego R.', status: 'submitted', submittedAt: '2026-06-23', reviewedAt: null, reviewNote: null },
  // BL-1003 — awaiting review
  { id: 'd5', orderId: 'o3', version: 1, kind: 'link', fileName: null, url: 'https://nova.co/blog/guest-seo-trends', note: 'Guest post live · DR 58 · dofollow.', staff: 'Linh P.', status: 'submitted', submittedAt: '2026-06-23', reviewedAt: null, reviewNote: null },
  // BL-1029 — awaiting review
  { id: 'd6', orderId: 'o29', version: 1, kind: 'file', fileName: 'vertex-backlinks.xlsx', url: null, note: '8 links built, all live and indexed.', staff: 'Aria K.', status: 'submitted', submittedAt: '2026-06-24', reviewedAt: null, reviewNote: null },
  // changes_requested (awaiting staff re-submission — feeds quality stats)
  { id: 'd7', orderId: 'o14', version: 1, kind: 'link', fileName: null, url: 'https://example.com/starter-links', note: 'Starter pack — 4 links.', staff: 'Linh P.', status: 'changes_requested', submittedAt: '2026-06-22', reviewedAt: '2026-06-23', reviewNote: 'Anchors too exact-match; diversify.' },
  { id: 'd8', orderId: 'o31', version: 1, kind: 'file', fileName: 'acme-3-articles.docx', url: null, note: '3 articles draft.', staff: 'Tom B.', status: 'changes_requested', submittedAt: '2026-06-22', reviewedAt: '2026-06-23', reviewNote: 'Tone is off-brand — rework the intros.' },
  // closed / approved (for first-pass approval stats)
  { id: 'd9', orderId: 'o10', version: 1, kind: 'file', fileName: 'vertice-opt.pdf', url: null, note: 'Ultra optimization complete.', staff: 'Mai T.', status: 'approved', submittedAt: '2026-06-21', reviewedAt: '2026-06-22', reviewNote: null },
  { id: 'd10', orderId: 'o38', version: 1, kind: 'link', fileName: null, url: 'https://docs.google.com/document/d/lumen-5', note: 'Lumen 5 articles.', staff: 'Huy N.', status: 'approved', submittedAt: '2026-06-21', reviewedAt: '2026-06-22', reviewNote: null },
  { id: 'd11', orderId: 'o13', version: 1, kind: 'file', fileName: 'acme-kw-v1.xlsx', url: null, note: 'Keyword map v1.', staff: 'Mai T.', status: 'changes_requested', submittedAt: '2026-06-17', reviewedAt: '2026-06-18', reviewNote: 'Add search intent column.' },
  { id: 'd12', orderId: 'o13', version: 2, kind: 'file', fileName: 'acme-kw-v2.xlsx', url: null, note: 'Added intent classification.', staff: 'Mai T.', status: 'approved', submittedAt: '2026-06-18', reviewedAt: '2026-06-19', reviewNote: null },
];

// Acceptance criteria per service — review is checklist-driven, not vibes.
// Free-text note the customer left on the order (optional).
export const ORDER_NOTE: Record<string, string> = {
  o3: 'Avoid casino/gambling sources — prefer fintech & SaaS publications.',
  o4: 'Match our brand voice and link each post to /pricing.',
  o29: 'Tech / SaaS publications only; DR 50+ preferred.',
  o35: 'Mobile LCP is the priority — desktop already passes.',
};

export const QA_CRITERIA: Record<string, string[]> = {
  Content: ['Matches the brief & target keyword', 'Original (passes plagiarism)', 'Internal links added', 'Meta title & description set', 'Formatting & readability'],
  Backlink: ['Domain relevance', 'DR / authority threshold met', 'Link live & dofollow', 'Anchor text natural & diversified'],
  Audit: ['All sections complete', 'Issues prioritised by impact', 'Action items are clear'],
  Optimization: ['Changes implemented & verified', 'No regressions introduced', 'Before/after captured'],
  Keyword: ['Volume & difficulty included', 'Mapped to target pages', 'Search intent classified'],
  'Web Design': ['Matches approved mockup', 'Responsive on mobile', 'Lighthouse / performance ok'],
  Indexer: ['Submission confirmed', 'Per-link status reported'],
  _default: ['Meets the order scope', 'Quality is acceptable', 'Ready to deliver to the customer'],
};
export const qaCriteriaFor = (service: string): string[] => QA_CRITERIA[service] ?? QA_CRITERIA._default;

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
  { id: 'c2', name: 'Sam Lee', company: 'Bright Ltd', email: 'sam@bright.io', status: 'shadow', orders: 2, spend: 198, balance: 0, lastActive: '2026-05-10', tier: 'new' },
  { id: 'c3', name: 'Ana Ruiz', company: 'Nova', email: 'ana@nova.co', status: 'claimed', orders: 14, spend: 3180, balance: 540, lastActive: '2026-06-22', tier: 'vip' },
  { id: 'c4', name: 'Marco Vidal', company: 'Vértice', email: 'marco@vertice.es', status: 'claimed', orders: 6, spend: 920, balance: 80, lastActive: '2026-05-22', tier: 'silver' },
  { id: 'c5', name: 'Priya Nair', company: 'Peak Digital', email: 'priya@peak.io', status: 'claimed', orders: 4, spend: 640, balance: 0, lastActive: '2026-06-05', tier: 'silver' },
  { id: 'c6', name: 'Tom Vale', company: 'Lumen', email: 'tom@lumen.co', status: 'shadow', orders: 1, spend: 79, balance: 0, lastActive: '2026-06-24', tier: 'new' },
  { id: 'c7', name: 'Elena Park', company: 'Orbit Labs', email: 'elena@orbit.dev', status: 'claimed', orders: 11, spend: 2460, balance: 410, lastActive: '2026-06-24', tier: 'gold' },
  { id: 'c8', name: 'Raj Mehta', company: 'Pulse Media', email: 'raj@pulse.media', status: 'claimed', orders: 5, spend: 730, balance: 60, lastActive: '2026-06-23', tier: 'silver' },
  { id: 'c9', name: 'Sofia Bianchi', company: 'Vertex AI', email: 'sofia@vertex.ai', status: 'claimed', orders: 17, spend: 4120, balance: 900, lastActive: '2026-06-25', tier: 'vip' },
  { id: 'c10', name: 'Noah Berg', company: 'Greenfield', email: 'noah@greenfield.co', status: 'shadow', orders: 1, spend: 39, balance: 0, lastActive: '2026-06-25', tier: 'new' },
  { id: 'c11', name: 'Lina Haddad', company: 'Cobalt Studio', email: 'lina@cobalt.studio', status: 'claimed', orders: 7, spend: 1180, balance: 150, lastActive: '2026-06-22', tier: 'silver' },
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

// Full customer intake (the order brief the customer filled in at checkout), keyed by order.
// Lightweight vs OrderExtra so any order can carry a rich brief. Read via briefFor().
export const ORDER_BRIEF: Record<string, { label: string; value: string }[]> = {
  o30: [
    { label: 'Website', value: 'https://orbitlabs.io' },
    { label: 'Campaign goal', value: 'Grow domain authority and rank /platform for “observability platform”' },
    { label: 'Pages to boost', value: '/platform, /pricing, /blog/distributed-tracing' },
    { label: 'Anchor keywords', value: 'observability platform, distributed tracing, OpenTelemetry monitoring' },
    { label: 'Volume / month', value: '8 referring domains (Growth package)' },
    { label: 'Minimum Domain Rating', value: 'DR 45+' },
    { label: 'Niche / relevance', value: 'DevOps, SRE, cloud infrastructure' },
    { label: 'Target market', value: 'North America + EU · English' },
    { label: 'Competitors', value: 'datadog.com, honeycomb.io' },
    { label: 'Disallowed sources', value: 'No PBNs, link farms, gambling or adult sites' },
    { label: 'Special instructions', value: 'Prefer guest posts on engineering blogs; vary anchor text so the profile stays natural.' },
  ],
  o8: [
    { label: 'Website', value: 'https://acme.com' },
    { label: 'Content goal', value: 'Top-of-funnel articles to capture early-stage buyers' },
    { label: 'Article topics', value: 'Ecommerce SEO checklist; WooCommerce speed; Product-page optimization; Abandoned-cart recovery; Shopping-feed optimization' },
    { label: 'Primary keywords', value: 'ecommerce seo, woocommerce speed, product page seo' },
    { label: 'Word count', value: '~1,500 words per article' },
    { label: 'Brand voice', value: 'Practical and friendly, no fluff' },
    { label: 'Audience', value: 'SMB online-store owners' },
    { label: 'Internal links', value: 'Link to /pricing and /shop where relevant' },
    { label: 'Style reference', value: 'https://acme.com/blog' },
    { label: 'Deliverable format', value: 'Google Doc · H2/H3 outline · meta title + description each' },
    { label: 'Notes', value: 'Suggest one original image idea per article.' },
  ],
  o34: [
    { label: 'Website', value: 'https://vertex.ai' },
    { label: 'Content goal', value: 'Educational thought-leadership to build authority in MLOps' },
    { label: 'Article topics', value: 'Feature stores; Model monitoring; Vector databases; RAG pipelines; LLM evaluation (+5 from the keyword map)' },
    { label: 'Primary keywords', value: 'mlops platform, model monitoring, vector database, rag pipeline' },
    { label: 'Word count', value: '1,800–2,200 words per article' },
    { label: 'Brand voice', value: 'Technical, precise, credible — written for ML engineers' },
    { label: 'Audience', value: 'ML engineers and data-platform leads' },
    { label: 'SME review', value: 'Drafts reviewed by their staff engineer before publish' },
    { label: 'Deliverable format', value: 'Markdown + code blocks · meta + suggested internal links' },
    { label: 'Notes', value: 'Cite primary sources; avoid hype words like “revolutionary”.' },
  ],
  o31: [
    { label: 'Website', value: 'https://acme.com' },
    { label: 'Content goal', value: 'Comparison + bottom-funnel pages to drive signups' },
    { label: 'Article topics', value: 'Acme vs RivalCo; Best WooCommerce SEO plugins; Migrating to Acme' },
    { label: 'Primary keywords', value: 'woocommerce seo plugin, acme alternative' },
    { label: 'Word count', value: '~1,200 words per article' },
    { label: 'Brand voice', value: 'Confident but fair to competitors' },
    { label: 'Internal links', value: 'CTA to /pricing in each piece' },
    { label: 'Deliverable format', value: 'Google Doc · comparison tables where useful' },
    { label: 'Notes', value: 'Revision round: tighten intros and add a summary table (per admin feedback).' },
  ],
  o4: [
    { label: 'Website', value: 'https://acme.com' },
    { label: 'Content goal', value: 'Evergreen how-to library for organic traffic' },
    { label: 'Article topics', value: 'Batch of 10 how-to guides from the approved keyword map' },
    { label: 'Primary keywords', value: 'how to set up woocommerce, ecommerce shipping, store seo basics' },
    { label: 'Word count', value: '1,500–2,000 words per article' },
    { label: 'Brand voice', value: 'Friendly, step-by-step, beginner-safe' },
    { label: 'Internal links', value: '2–3 internal links per article' },
    { label: 'Deliverable format', value: 'Google Doc · screenshot placeholders · meta each' },
    { label: 'Notes', value: 'Admin asked for internal links + meta on all 5 of batch 2 before resubmitting.' },
  ],
  o15: [
    { label: 'Website', value: 'https://novahq.com' },
    { label: 'Content goal', value: 'Launch-support articles for a new analytics product' },
    { label: 'Article topics', value: 'Product analytics 101; Event tracking guide; North-star metrics' },
    { label: 'Primary keywords', value: 'product analytics, event tracking, north star metric' },
    { label: 'Word count', value: '~1,600 words per article' },
    { label: 'Brand voice', value: 'Sharp, modern, data-driven' },
    { label: 'Audience', value: 'PMs and growth teams at startups' },
    { label: 'Deliverable format', value: 'Notion export · meta + social blurb each' },
    { label: 'Notes', value: 'Approved — passed review on the first pass.' },
  ],
  o38: [
    { label: 'Website', value: 'https://lumen.energy' },
    { label: 'Content goal', value: 'SEO articles for residential solar lead-gen' },
    { label: 'Article topics', value: 'Solar payback period; Battery storage basics; Net metering by state; Solar tax credits; Choosing an installer' },
    { label: 'Primary keywords', value: 'solar payback, home battery storage, net metering, solar tax credit' },
    { label: 'Word count', value: '~1,400 words per article' },
    { label: 'Brand voice', value: 'Clear, trustworthy, lightly optimistic' },
    { label: 'Audience', value: 'US homeowners considering solar' },
    { label: 'Compliance', value: 'Avoid guaranteed-savings claims; cite figures' },
    { label: 'Deliverable format', value: 'Google Doc · FAQ-schema suggestions · meta each' },
    { label: 'Notes', value: 'Approved and live — keep as a style reference for future batches.' },
  ],
};

// Single source for an order's customer brief: dedicated map → OrderExtra → empty.
export const briefFor = (orderId: string): { label: string; value: string }[] =>
  ORDER_BRIEF[orderId] ?? ORDER_EXTRA[orderId]?.brief ?? [];

// ---- Customer profile extras ----------------------------------------
export interface CustomerExtra { phone: string; timezone: string; memberSince: string; tags: string[]; }
export const CUSTOMER_EXTRA: Record<string, CustomerExtra> = {
  c1: { phone: '+1 415 555 0132', timezone: 'America/Los_Angeles · PT', memberSince: '2025-02-14', tags: ['Retainer', 'E-commerce'] },
  c2: { phone: '+44 20 7946 0321', timezone: 'Europe/London · GMT', memberSince: '2026-05-02', tags: ['Trial'] },
  c3: { phone: '+34 91 555 0199', timezone: 'Europe/Madrid · CET', memberSince: '2024-09-03', tags: ['Agency', 'Priority'] },
  c4: { phone: '+34 93 555 0144', timezone: 'Europe/Madrid · CET', memberSince: '2025-06-18', tags: ['SMB'] },
  c5: { phone: '+91 22 4000 1188', timezone: 'Asia/Kolkata · IST', memberSince: '2025-11-02', tags: ['Agency'] },
  c6: { phone: '+1 312 555 0170', timezone: 'America/Chicago · CT', memberSince: '2026-06-22', tags: [] },
  c7: { phone: '+1 206 555 0119', timezone: 'America/Los_Angeles · PT', memberSince: '2024-12-10', tags: ['Retainer', 'SaaS'] },
  c8: { phone: '+1 646 555 0188', timezone: 'America/New_York · ET', memberSince: '2025-08-19', tags: ['Media'] },
  c9: { phone: '+39 02 555 0166', timezone: 'Europe/Rome · CET', memberSince: '2024-05-21', tags: ['Enterprise', 'Priority'] },
  c10: { phone: '+1 415 555 0101', timezone: 'America/Los_Angeles · PT', memberSince: '2026-06-25', tags: [] },
  c11: { phone: '+1 503 555 0133', timezone: 'America/Los_Angeles · PT', memberSince: '2025-10-07', tags: ['Studio'] },
};

export interface CustProject { name: string; site: string; folders: { name: string; orders: number }[]; }
export const CUSTOMER_PROJECTS: Record<string, CustProject[]> = {
  c1: [
    { name: 'Main site', site: 'acme.com', folders: [{ name: 'Money pages', orders: 4 }, { name: 'Blog', orders: 3 }, { name: 'Product pages', orders: 2 }] },
    { name: 'EU storefront', site: 'acme.eu', folders: [{ name: 'Localization', orders: 1 }] },
  ],
};

export interface LedgerEntry { at: string; delta: number; reason: string; }
export const CUSTOMER_LEDGER: Record<string, LedgerEntry[]> = {
  c1: [
    { at: '2026-06-24', delta: -39, reason: 'AUD-1001 confirmed' },
    { at: '2026-06-20', delta: -120, reason: 'CNT-1004 confirmed' },
    { at: '2026-06-10', delta: 500, reason: 'Top-up · Stripe' },
    { at: '2026-05-28', delta: -39, reason: 'KW-1013 confirmed' },
    { at: '2026-05-15', delta: 1000, reason: 'Top-up · Stripe' },
  ],
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
  { id: 's1', name: 'Mai T.', skills: ['keyword','optimize','content'], capacity: 6, openLoad: 3, composite: 92, quality: 95, onTime: 90, throughput: 22, active: true, role: 'Senior SEO Specialist', email: 'mai@hevaseo.com', since: '2023-02-14', tz: 'GMT+7', trend: [2,3,4,3,5,4,6,5] },
  { id: 's2', name: 'Linh P.', skills: ['backlink','keyword'], capacity: 5, openLoad: 4, composite: 88, quality: 86, onTime: 92, throughput: 31, active: true, role: 'Backlink Specialist', email: 'linh@hevaseo.com', since: '2023-06-01', tz: 'GMT+7', trend: [3,4,5,4,6,5,7,6] },
  { id: 's3', name: 'Huy N.', skills: ['content','optimize'], capacity: 8, openLoad: 5, composite: 84, quality: 88, onTime: 79, throughput: 40, active: true, role: 'Content Lead', email: 'huy@hevaseo.com', since: '2022-11-20', tz: 'GMT+7', trend: [4,5,6,5,7,6,8,7] },
  { id: 's4', name: 'Diego R.', skills: ['content','optimize'], capacity: 7, openLoad: 4, composite: 86, quality: 90, onTime: 85, throughput: 28, active: true, role: 'Content Specialist', email: 'diego@hevaseo.com', since: '2024-01-10', tz: 'GMT-3', trend: [3,3,4,4,5,4,6,5] },
  { id: 's5', name: 'Aria K.', skills: ['keyword','backlink'], capacity: 6, openLoad: 2, composite: 90, quality: 92, onTime: 88, throughput: 26, active: true, role: 'SEO Analyst', email: 'aria@hevaseo.com', since: '2024-03-22', tz: 'GMT+2', trend: [2,3,3,4,4,5,5,6] },
  { id: 's6', name: 'Tom B.', skills: ['backlink','content'], capacity: 5, openLoad: 3, composite: 82, quality: 84, onTime: 80, throughput: 34, active: false, role: 'Link Builder', email: 'tom@hevaseo.com', since: '2023-09-05', tz: 'GMT+0', trend: [4,4,5,5,6,5,7,6] },
];

// Team managers — ops leads who own a slice of the delivery roster. (Same people as
// the manager-tier admin accounts; see ADMIN_SETTINGS.admins.)
export interface AdminManager { id: string; name: string; email: string; title: string; rank: string; skills: string[]; }
export const MANAGERS: AdminManager[] = [
  { id: 'mgr1', name: 'Sofia Marin', email: 'sofia@hevaseo.com', title: 'Operations Manager', rank: 'Senior Manager', skills: ['keyword', 'backlink'] },
  { id: 'mgr2', name: 'Ken Rivera',  email: 'ken@hevaseo.com',   title: 'Delivery Manager',   rank: 'Lead Manager',   skills: ['content', 'optimize'] },
];
// Account-level note about a client / their project, shown to whoever works their orders.
export const CLIENT_NOTE: Record<string, string> = {
  'Orbit Labs': 'Technical SaaS client — white-hat links only. The CEO is detail-oriented: keep anchor text natural and share target domains before any outreach.',
  'Acme Co': 'Long-term retainer. Prioritise the money pages (/pricing, /shop). House style guide is on file — match it.',
  'Vertex AI': 'Highly technical; drafts go through their staff engineer. Accuracy over speed — cite primary sources.',
  'Nova': 'Fast-moving startup, very responsive. Happy with punchy, data-led copy.',
  'Lumen': 'Solar / energy — compliance-sensitive. Avoid guaranteed-savings claims and cite figures.',
  'Vertex': 'Highly technical; drafts go through their staff engineer. Accuracy over speed.',
};
// Which manager owns which staff member (staff id → manager id).
export const STAFF_MANAGER: Record<string, string> = {
  s1: 'mgr1', s2: 'mgr1', s5: 'mgr1',  // Sofia — search & links pod
  s3: 'mgr2', s4: 'mgr2', s6: 'mgr2',  // Ken — content & optimization pod
};
export const managerOf = (staffId: string): AdminManager | null =>
  MANAGERS.find((m) => m.id === STAFF_MANAGER[staffId]) ?? null;

// SLA response targets by tier (hours to first/next staff reply).
export const SLA_LIMIT_H: Record<SlaTier, number> = { urgent: 2, standard: 24 };
export const TICKET_TYPE: Record<TicketType, { label: string; icon: string; color: string }> = {
  technical: { label: 'Technical', icon: 'ph-wrench', color: '#2563eb' },
  billing: { label: 'Billing', icon: 'ph-receipt', color: '#f59e0b' },
  consultation: { label: 'Consultation', icon: 'ph-lightbulb', color: '#a855f7' },
};
export const TICKET_CHANNEL: Record<TicketChannel, { label: string; icon: string; color: string }> = {
  portal: { label: 'Portal', icon: 'ph-browser', color: '#64748b' },
  whatsapp: { label: 'WhatsApp', icon: 'ph-whatsapp-logo', color: '#25D366' },
  messenger: { label: 'Messenger', icon: 'ph-messenger-logo', color: '#0084FF' },
  email: { label: 'Email', icon: 'ph-envelope-simple', color: '#0ea5e9' },
};
// Canned replies (macros) the agent can drop into the reply box.
export const TICKET_MACROS: { label: string; text: string }[] = [
  { label: 'Acknowledge', text: "Thanks for reaching out — I'm looking into this now and will get back to you shortly." },
  { label: 'Need info', text: 'Could you share the URL and a screenshot so I can dig in? That will help me resolve this faster.' },
  { label: 'ETA', text: "Your deliverable is on track — expect it within the next 24 hours. I'll ping you the moment it's ready." },
  { label: 'Resolve', text: "This is sorted on our end now. I'll mark the ticket resolved, but reply any time if anything else comes up." },
];

export const TICKETS: AdminTicket[] = [
  {
    id: 't1', code: 'HV-1042', subject: 'When will my audit report be ready?',
    customer: 'Acme Co', customerId: 'c1', type: 'technical', channel: 'portal', status: 'open',
    priority: 'high', assignee: null, slaTier: 'urgent', orderCode: 'AUD-1001',
    createdAt: '2026-06-25T08:30', lastReplyAt: '2026-06-25T11:05', age: '3h',
    thread: [
      { from: 'customer', author: 'Jane Doe', text: "Hi — I ordered the audit (AUD-1001) two days ago and it's marked urgent. Any ETA on the report?", at: '08:30' },
      { from: 'customer', author: 'Jane Doe', text: 'Following up — we have a board review tomorrow and need at least the headline findings.', at: '11:05' },
    ],
  },
  {
    id: 't2', code: 'HV-1041', subject: 'May VAT invoice missing tax ID',
    customer: 'Nova', customerId: 'c3', type: 'billing', channel: 'email', status: 'pending',
    priority: 'med', assignee: 'Mai T.', slaTier: 'standard', orderCode: null,
    createdAt: '2026-06-24T09:10', lastReplyAt: '2026-06-24T15:42', age: '1d',
    thread: [
      { from: 'customer', author: 'Ana Ruiz', text: 'Our May invoice is missing the company VAT ID. Can you reissue it with ES-B-12345678?', at: 'Jun 24 · 09:10' },
      { from: 'staff', author: 'Mai T.', text: "Sure — I've queued the corrected invoice with finance. You'll have the PDF by end of day.", at: 'Jun 24 · 15:42' },
    ],
  },
  {
    id: 't3', code: 'HV-1040', subject: 'Strategy call for a Q3 entity build',
    customer: 'Vertex AI', customerId: 'c9', type: 'consultation', channel: 'whatsapp', status: 'open',
    priority: 'high', assignee: null, slaTier: 'urgent', orderCode: null,
    createdAt: '2026-06-25T12:40', lastReplyAt: '2026-06-25T12:40', age: '1h',
    thread: [
      { from: 'customer', author: 'Sofia Bianchi', text: "We're planning a big entity + content push for Q3. Can a strategist hop on a 30-min call this week?", at: '12:40' },
    ],
  },
  {
    id: 't4', code: 'HV-1039', subject: "Keyword set doesn't match my market",
    customer: 'Peak Digital', customerId: 'c5', type: 'technical', channel: 'portal', status: 'pending',
    priority: 'med', assignee: 'Aria K.', slaTier: 'standard', orderCode: 'KW-1007',
    createdAt: '2026-06-24T13:20', lastReplyAt: '2026-06-25T09:15', age: '5h',
    thread: [
      { from: 'customer', author: 'Priya Nair', text: 'The delivered keywords (KW-1007) skew US, but we only sell in the UK. Can we redo the targeting?', at: 'Jun 24 · 13:20' },
      { from: 'staff', author: 'Aria K.', text: "Good catch — I'll re-run the clusters with a UK locale and exclude US-only intent. Expect a v2 tomorrow.", at: 'Jun 25 · 09:15' },
    ],
  },
  {
    id: 't5', code: 'HV-1038', subject: "Credit didn't apply after top-up",
    customer: 'Orbit Labs', customerId: 'c7', type: 'billing', channel: 'messenger', status: 'open',
    priority: 'low', assignee: null, slaTier: 'standard', orderCode: null,
    createdAt: '2026-06-25T07:50', lastReplyAt: '2026-06-25T07:50', age: '4h',
    thread: [
      { from: 'customer', author: 'Elena Park', text: 'I topped up $200 via Stripe an hour ago but my balance still shows the old amount.', at: '07:50' },
    ],
  },
  {
    id: 't6', code: 'HV-1037', subject: 'Core Web Vitals still red after optimization',
    customer: 'Vértice', customerId: 'c4', type: 'technical', channel: 'portal', status: 'resolved',
    priority: 'med', assignee: 'Huy N.', slaTier: 'standard', orderCode: 'OPT-1005',
    createdAt: '2026-06-22T10:00', lastReplyAt: '2026-06-23T16:30', age: '2d',
    thread: [
      { from: 'customer', author: 'Marco Vidal', text: 'LCP is still red on mobile after the optimization (OPT-1005). Screenshot attached.', at: 'Jun 22 · 10:00' },
      { from: 'staff', author: 'Huy N.', text: 'The hero image wasn\'t being served as WebP from your CDN. I\'ve fixed the rule — re-test now.', at: 'Jun 22 · 14:12' },
      { from: 'customer', author: 'Marco Vidal', text: 'LCP is green now, thank you!', at: 'Jun 23 · 16:30' },
    ],
  },
  {
    id: 't7', code: 'HV-1036', subject: 'Which package fits a brand-new site?',
    customer: 'Lumen', customerId: 'c6', type: 'consultation', channel: 'portal', status: 'open',
    priority: 'med', assignee: 'Linh P.', slaTier: 'standard', orderCode: null,
    createdAt: '2026-06-24T18:05', lastReplyAt: '2026-06-25T08:40', age: '6h',
    thread: [
      { from: 'customer', author: 'Tom Vale', text: 'We just launched and have zero backlinks. Do we start with an audit or jump straight to backlinks?', at: 'Jun 24 · 18:05' },
      { from: 'staff', author: 'Linh P.', text: "For a brand-new domain I'd start with an audit + content foundation, then layer backlinks once you're indexed. Happy to map a 3-month plan.", at: 'Jun 25 · 08:40' },
    ],
  },
  {
    id: 't8', code: 'HV-1035', subject: 'Refund for a duplicate charge',
    customer: 'Pulse Media', customerId: 'c8', type: 'billing', channel: 'email', status: 'closed',
    priority: 'low', assignee: 'Diego R.', slaTier: 'standard', orderCode: null,
    createdAt: '2026-06-20T11:30', lastReplyAt: '2026-06-21T10:15', age: '5d',
    thread: [
      { from: 'customer', author: 'Raj Mehta', text: 'I was charged twice for the same top-up on Jun 20. Please refund the duplicate.', at: 'Jun 20 · 11:30' },
      { from: 'staff', author: 'Diego R.', text: 'Confirmed the duplicate and refunded $79 to your card — it should land in 3–5 business days.', at: 'Jun 21 · 10:15' },
    ],
  },
  {
    id: 't9', code: 'HV-1034', subject: 'Backlinks dropped a week after delivery',
    customer: 'Cobalt Studio', customerId: 'c11', type: 'technical', channel: 'whatsapp', status: 'open',
    priority: 'high', assignee: 'Tom B.', slaTier: 'urgent', orderCode: null,
    createdAt: '2026-06-25T06:15', lastReplyAt: '2026-06-25T10:50', age: '5h',
    thread: [
      { from: 'staff', author: 'Tom B.', text: 'Looking into the link drop now — pulling the latest index status for each placement.', at: '09:20' },
      { from: 'customer', author: 'Lina Haddad', text: '3 of the 10 links are gone from the live pages. Can you verify and replace them?', at: '10:50' },
    ],
  },
  {
    id: 't10', code: 'HV-1033', subject: 'Article tone is off-brand',
    customer: 'Acme Co', customerId: 'c1', type: 'technical', channel: 'portal', status: 'pending',
    priority: 'high', assignee: 'Mai T.', slaTier: 'urgent', orderCode: 'CNT-1004',
    createdAt: '2026-06-25T07:00', lastReplyAt: '2026-06-25T09:30', age: '5h',
    thread: [
      { from: 'customer', author: 'Jane Doe', text: 'The first two articles (CNT-1004) read too casual for us — we need a more authoritative B2B tone.', at: '07:00' },
      { from: 'customer', author: 'Jane Doe', text: "Here's our style guide for reference. Can the writer revise?", at: '09:30' },
    ],
  },
];

export const RULES: AdminRule[] = [
  { id: 'r1', service: 'Backlink', pkg: null, mode: 'pin', target: 'Linh P.', priority: 10, active: true },
  { id: 'r2', service: 'Content', pkg: null, mode: 'auto', target: null, priority: 50, active: true },
];

export const AUDIT_CATEGORY: Record<AuditCategory, { label: string; icon: string; color: string }> = {
  create: { label: 'Create', icon: 'ph-plus-circle', color: '#10b981' },
  update: { label: 'Update', icon: 'ph-pencil-simple', color: '#0ea5e9' },
  transition: { label: 'Transition', icon: 'ph-arrows-left-right', color: '#6366f1' },
  assign: { label: 'Assign', icon: 'ph-user-switch', color: '#a855f7' },
  destructive: { label: 'Destructive', icon: 'ph-warning-octagon', color: '#ef4444' },
  auth: { label: 'Auth', icon: 'ph-shield-check', color: '#f59e0b' },
};
export const AUDIT_ENTITY: Record<AuditEntity, { label: string; icon: string; href: string | null }> = {
  order: { label: 'Order', icon: 'ph-package', href: '/admin/orders' },
  customer: { label: 'Customer', icon: 'ph-user', href: '/admin/customers' },
  staff: { label: 'Staff', icon: 'ph-user-gear', href: '/admin/staff' },
  rule: { label: 'Rule', icon: 'ph-git-fork', href: '/admin/assignment' },
  ticket: { label: 'Ticket', icon: 'ph-lifebuoy', href: '/admin/tickets' },
  deliverable: { label: 'Deliverable', icon: 'ph-file-arrow-up', href: '/admin/review' },
  catalog: { label: 'Catalog', icon: 'ph-tag', href: '/admin/catalog' },
  auth: { label: 'Auth', icon: 'ph-shield', href: null },
};

export const AUDIT: AuditEntry[] = [
  // ---- 2026-06-24 (today) ----
  { id: 'a1', at: '2026-06-24 09:12', actor: 'Admin', entity: 'order', entityId: 'o1', entityCode: 'AUD-1001', action: 'transition', from: 'new', to: 'confirmed', category: 'transition', change: 'AUD-1001 new → confirmed' },
  { id: 'a2', at: '2026-06-24 08:40', actor: 'Admin', entity: 'order', entityId: 'o2', entityCode: 'KW-1002', action: 'assign', from: null, to: 'Mai T.', category: 'assign', change: 'KW-1002 assigned → Mai T.', meta: { staff: 'Mai T.' } },
  { id: 'a3', at: '2026-06-24 08:31', actor: 'Mai T.', entity: 'deliverable', entityId: 'o4', entityCode: 'CNT-1004', action: 'submit', from: null, to: 'v2', category: 'create', change: 'CNT-1004 deliverable v2 submitted', meta: { version: 2, kind: 'file' } },
  { id: 'a4', at: '2026-06-24 08:05', actor: 'Admin', entity: 'auth', entityId: 'c1', entityCode: 'Jane Doe', action: 'impersonate', from: null, to: null, category: 'auth', change: 'Admin impersonated Jane Doe (Acme Co)', meta: { customer: 'Acme Co' } },
  { id: 'a5', at: '2026-06-24 07:58', actor: 'Admin', entity: 'customer', entityId: 'c1', entityCode: 'Acme Co', action: 'credit_adjust', from: '$320', to: '$820', category: 'update', change: 'Acme Co credit +$500', meta: { delta: 500, reason: 'Top-up · Stripe' } },
  { id: 'a6', at: '2026-06-24 07:20', actor: 'system', entity: 'order', entityId: 'o18', entityCode: 'BL-1018', action: 'create', from: null, to: 'new', category: 'create', change: 'BL-1018 created (quick order)', meta: { source: 'quick', value: 104 } },
  // ---- 2026-06-23 ----
  { id: 'a7', at: '2026-06-23 18:44', actor: 'Admin', entity: 'order', entityId: 'o10', entityCode: 'OPT-1010', action: 'refund', from: 'approved', to: 'approved', category: 'destructive', change: 'OPT-1010 refunded $140 to Vértice', meta: { amount: 140, customer: 'Vértice' } },
  { id: 'a8', at: '2026-06-23 17:30', actor: 'Admin', entity: 'customer', entityId: 'c1', entityCode: 'Acme Co', action: 'update', from: null, to: null, category: 'update', change: 'Acme Co profile updated', diff: [{ field: 'tier', from: 'silver', to: 'gold' }, { field: 'tags', from: 'Retainer', to: 'Retainer, E-commerce' }] },
  { id: 'a9', at: '2026-06-23 16:12', actor: 'Admin', entity: 'catalog', entityId: 'backlink-growth', entityCode: 'Backlink · Growth', action: 'publish', from: null, to: null, category: 'update', change: 'Backlink · Growth price changed', diff: [{ field: 'price', from: '$64', to: '$79' }] },
  { id: 'a10', at: '2026-06-23 15:05', actor: 'Linh P.', entity: 'deliverable', entityId: 'o3', entityCode: 'BL-1003', action: 'request_changes', from: 'delivered', to: 'changes_requested', category: 'transition', change: 'BL-1003 changes requested', meta: { note: 'Anchor too exact-match' } },
  { id: 'a11', at: '2026-06-23 14:18', actor: 'Admin', entity: 'rule', entityId: 'r1', entityCode: 'Backlink rule', action: 'update', from: null, to: null, category: 'update', change: 'Backlink routing rule updated', diff: [{ field: 'mode', from: 'skill pool', to: 'pinned' }, { field: 'target', from: '—', to: 'Linh P.' }] },
  { id: 'a12', at: '2026-06-23 13:40', actor: 'Admin', entity: 'order', entityId: 'o14', entityCode: 'BL-1014', action: 'transition', from: 'internal_review', to: 'changes_requested', category: 'transition', change: 'BL-1014 internal_review → changes_requested' },
  { id: 'a13', at: '2026-06-23 11:55', actor: 'Huy N.', entity: 'order', entityId: 'o8', entityCode: 'CNT-1008', action: 'transition', from: 'assigned', to: 'in_progress', category: 'transition', change: 'CNT-1008 assigned → in_progress' },
  { id: 'a14', at: '2026-06-23 10:32', actor: 'Admin', entity: 'staff', entityId: 's1', entityCode: 'Mai T.', action: 'update', from: null, to: null, category: 'update', change: 'Mai T. capacity changed', diff: [{ field: 'capacity', from: '6', to: '7' }] },
  { id: 'a15', at: '2026-06-23 09:48', actor: 'Mai T.', entity: 'ticket', entityId: 't2', entityCode: 'TKT-2042', action: 'reply', from: null, to: null, category: 'update', change: 'Replied to ticket TKT-2042', meta: { customer: 'Bright Ltd' } },
  { id: 'a16', at: '2026-06-23 09:10', actor: 'Aria K.', entity: 'auth', entityId: 's5', entityCode: 'Aria K.', action: 'login', from: null, to: null, category: 'auth', change: 'Aria K. signed in', meta: { ip: '203.0.113.7' } },
  // ---- 2026-06-22 ----
  { id: 'a17', at: '2026-06-22 19:02', actor: 'Admin', entity: 'order', entityId: 'o16', entityCode: 'AUD-1016', action: 'cancel', from: 'new', to: 'canceled', category: 'destructive', change: 'AUD-1016 canceled', meta: { reason: 'Duplicate order' } },
  { id: 'a18', at: '2026-06-22 17:25', actor: 'Admin', entity: 'staff', entityId: 's6', entityCode: 'Tom B.', action: 'create', from: null, to: null, category: 'create', change: 'Tom B. added to the team', meta: { role: 'Specialist', capacity: 5 } },
  { id: 'a19', at: '2026-06-22 16:40', actor: 'Admin', entity: 'staff', entityId: 's3', entityCode: 'Huy N.', action: 'update', from: null, to: null, category: 'update', change: 'Huy N. skills changed', diff: [{ field: 'skills', from: 'content', to: 'content, optimize' }] },
  { id: 'a20', at: '2026-06-22 15:18', actor: 'Mai T.', entity: 'deliverable', entityId: 'o13', entityCode: 'KW-1013', action: 'approve', from: 'delivered', to: 'approved', category: 'transition', change: 'KW-1013 v2 approved' },
  { id: 'a21', at: '2026-06-22 14:02', actor: 'Linh P.', entity: 'ticket', entityId: 't1', entityCode: 'TKT-2041', action: 'resolve', from: 'open', to: 'resolved', category: 'transition', change: 'TKT-2041 resolved' },
  { id: 'a22', at: '2026-06-22 12:30', actor: 'Admin', entity: 'customer', entityId: 'c9', entityCode: 'Vertex AI', action: 'update', from: null, to: null, category: 'update', change: 'Vertex AI marked priority', diff: [{ field: 'tags', from: '—', to: 'Enterprise, Priority' }] },
  { id: 'a23', at: '2026-06-22 11:14', actor: 'system', entity: 'order', entityId: 'o24', entityCode: 'CNT-1024', action: 'create', from: null, to: 'confirmed', category: 'create', change: 'CNT-1024 created (dashboard)', meta: { source: 'dashboard', value: 120 } },
  { id: 'a24', at: '2026-06-22 10:05', actor: 'Admin', entity: 'auth', entityId: null, entityCode: 'Admin', action: 'login', from: null, to: null, category: 'auth', change: 'Admin signed in', meta: { ip: '198.51.100.23' } },
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
export interface GeoRow { country: string; flag: string; users: number; x: number; y: number; isoNum: string; }
export const GEO: GeoRow[] = [
  { country: 'United States', flag: '🇺🇸', users: 1840, x: 0.21, y: 0.42, isoNum: '840' },
  { country: 'United Kingdom', flag: '🇬🇧', users: 720,  x: 0.47, y: 0.34, isoNum: '826' },
  { country: 'Germany',        flag: '🇩🇪', users: 560,  x: 0.52, y: 0.37, isoNum: '276' },
  { country: 'Canada',         flag: '🇨🇦', users: 430,  x: 0.19, y: 0.31, isoNum: '124' },
  { country: 'India',          flag: '🇮🇳', users: 360,  x: 0.69, y: 0.52, isoNum: '356' },
  { country: 'Australia',      flag: '🇦🇺', users: 320,  x: 0.84, y: 0.74, isoNum: '036' },
  { country: 'Singapore',      flag: '🇸🇬', users: 220,  x: 0.75, y: 0.59, isoNum: '702' },
  { country: 'Brazil',         flag: '🇧🇷', users: 190,  x: 0.34, y: 0.69, isoNum: '076' },
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

/* ============================== FINANCE =============================== */
// Transaction ledger — hand-authored to cross-reference orders/customers/
// tickets (e.g. Orbit's pending top-up, Pulse's refund matches ticket HV-1035).
export type TxKind = 'top_up' | 'charge' | 'refund' | 'payout' | 'adjustment';
export type TxMethod = 'stripe' | 'paypal' | 'wallet' | 'manual';
export type TxStatus = 'settled' | 'pending' | 'failed';
export interface Transaction {
  id: string; at: string;            // 'YYYY-MM-DD HH:mm'
  kind: TxKind; amount: number;      // + inflow / − outflow
  party: string; partyId: string | null;
  method: TxMethod; status: TxStatus;
  orderCode: string | null; note: string;
}
export const TX_KIND: Record<TxKind, { label: string; icon: string; flow: 'in' | 'out' }> = {
  top_up:     { label: 'Top-up',        icon: 'ph-arrow-circle-down', flow: 'in' },
  charge:     { label: 'Order payment', icon: 'ph-receipt',           flow: 'in' },
  refund:     { label: 'Refund',        icon: 'ph-arrow-u-down-left', flow: 'out' },
  payout:     { label: 'Staff payout',  icon: 'ph-hand-coins',        flow: 'out' },
  adjustment: { label: 'Adjustment',    icon: 'ph-sliders',           flow: 'in' },
};
export const TX_METHOD: Record<TxMethod, { label: string; icon: string }> = {
  stripe: { label: 'Stripe', icon: 'ph-credit-card' },
  paypal: { label: 'PayPal', icon: 'ph-paypal-logo' },
  wallet: { label: 'Wallet', icon: 'ph-wallet' },
  manual: { label: 'Manual', icon: 'ph-note-pencil' },
};
export const TRANSACTIONS: Transaction[] = [
  { id: 'tx1', at: '2026-06-25 11:20', kind: 'top_up', amount: 200, party: 'Orbit Labs', partyId: 'c7', method: 'stripe', status: 'pending', orderCode: null, note: 'Wallet top-up — awaiting Stripe webhook' },
  { id: 'tx2', at: '2026-06-24 10:05', kind: 'top_up', amount: 500, party: 'Acme Co', partyId: 'c1', method: 'stripe', status: 'settled', orderCode: null, note: 'Wallet top-up' },
  { id: 'tx3', at: '2026-06-22 16:40', kind: 'top_up', amount: 540, party: 'Nova', partyId: 'c3', method: 'stripe', status: 'settled', orderCode: null, note: 'Wallet top-up' },
  { id: 'tx4', at: '2026-06-22 09:15', kind: 'top_up', amount: 198, party: 'Bright Ltd', partyId: 'c2', method: 'stripe', status: 'failed', orderCode: null, note: 'Card declined — retry sent' },
  { id: 'tx5', at: '2026-06-20 13:30', kind: 'top_up', amount: 150, party: 'Cobalt Studio', partyId: 'c11', method: 'stripe', status: 'settled', orderCode: null, note: 'Wallet top-up' },
  { id: 'tx6', at: '2026-06-09 08:50', kind: 'top_up', amount: 900, party: 'Vertex AI', partyId: 'c9', method: 'paypal', status: 'settled', orderCode: null, note: 'Wallet top-up' },
  { id: 'tx7', at: '2026-06-24 09:12', kind: 'charge', amount: 39, party: 'Acme Co', partyId: 'c1', method: 'wallet', status: 'settled', orderCode: 'AUD-1001', note: 'Order confirmed' },
  { id: 'tx8', at: '2026-06-22 14:02', kind: 'charge', amount: 79, party: 'Peak Digital', partyId: 'c5', method: 'stripe', status: 'settled', orderCode: 'KW-1007', note: 'Order confirmed' },
  { id: 'tx9', at: '2026-06-20 11:48', kind: 'charge', amount: 120, party: 'Acme Co', partyId: 'c1', method: 'wallet', status: 'settled', orderCode: 'CNT-1004', note: 'Order confirmed' },
  { id: 'tx10', at: '2026-06-18 10:30', kind: 'charge', amount: 79, party: 'Vértice', partyId: 'c4', method: 'wallet', status: 'settled', orderCode: 'OPT-1005', note: 'Order confirmed' },
  { id: 'tx11', at: '2026-06-17 15:20', kind: 'charge', amount: 140, party: 'Vértice', partyId: 'c4', method: 'stripe', status: 'settled', orderCode: 'OPT-1010', note: 'Order confirmed' },
  { id: 'tx12', at: '2026-06-16 09:05', kind: 'charge', amount: 279, party: 'Nova', partyId: 'c3', method: 'wallet', status: 'settled', orderCode: 'WD-1011', note: 'Order confirmed' },
  { id: 'tx13', at: '2026-06-21 10:15', kind: 'refund', amount: -79, party: 'Pulse Media', partyId: 'c8', method: 'stripe', status: 'settled', orderCode: null, note: 'Duplicate top-up refunded (ticket HV-1035)' },
  { id: 'tx14', at: '2026-06-15 12:00', kind: 'refund', amount: -39, party: 'Vértice', partyId: 'c4', method: 'wallet', status: 'settled', orderCode: 'AUD-1016', note: 'Order canceled — credited to wallet' },
  { id: 'tx15', at: '2026-06-05 17:00', kind: 'payout', amount: -700, party: 'Huy N.', partyId: 's3', method: 'manual', status: 'settled', orderCode: null, note: 'May payroll — salary + commission' },
  { id: 'tx16', at: '2026-06-05 17:00', kind: 'payout', amount: -620, party: 'Mai T.', partyId: 's1', method: 'manual', status: 'settled', orderCode: null, note: 'May payroll — salary + commission' },
  { id: 'tx17', at: '2026-06-05 17:00', kind: 'payout', amount: -540, party: 'Linh P.', partyId: 's2', method: 'manual', status: 'settled', orderCode: null, note: 'May payroll — salary + commission' },
  { id: 'tx18', at: '2026-06-25 09:40', kind: 'adjustment', amount: 25, party: 'Greenfield', partyId: 'c10', method: 'manual', status: 'settled', orderCode: null, note: 'Goodwill credit — onboarding offer' },
];

// Invoices (accounts receivable). Some prepaid customers settle by invoice.
export type InvoiceStatus = 'paid' | 'due' | 'overdue';
export interface Invoice {
  id: string; code: string; customer: string; customerId: string;
  issued: string; due: string; amount: number; status: InvoiceStatus; orderCodes: string[];
}
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; pill: string }> = {
  paid:    { label: 'Paid',    pill: 'pill-live' },
  due:     { label: 'Due',     pill: 'pill-warn' },
  overdue: { label: 'Overdue', pill: 'pill-bad' },
};
export const INVOICES: Invoice[] = [
  { id: 'inv1', code: 'INV-2042', customer: 'Vertex AI', customerId: 'c9', issued: '2026-06-20', due: '2026-07-05', amount: 900, status: 'due', orderCodes: ['CNT-1024', 'BL-1018'] },
  { id: 'inv2', code: 'INV-2041', customer: 'Nova', customerId: 'c3', issued: '2026-06-18', due: '2026-07-03', amount: 540, status: 'due', orderCodes: ['WD-1011'] },
  { id: 'inv3', code: 'INV-2040', customer: 'Orbit Labs', customerId: 'c7', issued: '2026-06-10', due: '2026-06-20', amount: 410, status: 'overdue', orderCodes: ['KW-1017', 'WD-1025'] },
  { id: 'inv4', code: 'INV-2039', customer: 'Acme Co', customerId: 'c1', issued: '2026-06-12', due: '2026-06-22', amount: 320, status: 'overdue', orderCodes: ['AUD-1001', 'CNT-1004'] },
  { id: 'inv5', code: 'INV-2038', customer: 'Cobalt Studio', customerId: 'c11', issued: '2026-06-08', due: '2026-06-23', amount: 150, status: 'due', orderCodes: ['KW-1028'] },
  { id: 'inv6', code: 'INV-2037', customer: 'Vértice', customerId: 'c4', issued: '2026-06-01', due: '2026-06-16', amount: 80, status: 'paid', orderCodes: ['OPT-1010'] },
  { id: 'inv7', code: 'INV-2036', customer: 'Pulse Media', customerId: 'c8', issued: '2026-05-28', due: '2026-06-12', amount: 60, status: 'paid', orderCodes: ['CNT-1026'] },
  { id: 'inv8', code: 'INV-2035', customer: 'Peak Digital', customerId: 'c5', issued: '2026-05-25', due: '2026-06-09', amount: 79, status: 'paid', orderCodes: ['KW-1007'] },
];

// Staff payroll — fixed monthly salary + GIG PAY (a flat piece-rate per delivered gig, by
// service) + commission on billable work + an admin-entered bonus.
// Total due = base + gig + commission + bonus.
export interface Payout {
  staffId: string; staff: string; role: string; active: boolean;
  completedOrders: number; basis: number; rate: number;
  base: number;        // fixed monthly salary
  gigUnits: number;    // count of billable gigs delivered
  gig: number;         // sum of GIG_RATE[service] over those gigs (piece-rate pay)
  gigCounts: { service: string; count: number }[]; // billable gigs grouped by service
  commission: number;  // round(basis × rate)
  bonus: number;       // admin-entered, 0 by default
  due: number;         // base + gig + commission + bonus
  lastPaidAt: string | null;
}
export const PAYABLE_STATES: OrderStatus[] = ['delivered', 'internal_review', 'approved', 'completed'];
export const PAYOUT_RATE: Record<string, number> = {
  'Senior SEO Specialist': 0.30, 'Backlink Specialist': 0.32, 'Content Lead': 0.30,
  'Content Specialist': 0.28, 'SEO Analyst': 0.28, 'Link Builder': 0.30,
};
// Fixed monthly salary per role (USD).
export const BASE_SALARY: Record<string, number> = {
  'Senior SEO Specialist': 1200, 'Backlink Specialist': 950, 'Content Lead': 1300,
  'Content Specialist': 900, 'SEO Analyst': 900, 'Link Builder': 700,
};
// Gig pay — a flat amount a staffer earns for each delivered gig, by service. Piece-rate on
// top of salary (e.g. a backlink package pays $5, a content gig $3, an audit $2). Keyed by the
// order's `service`; an unlisted service pays the default. Editable per service in the future.
export const GIG_RATE: Record<string, number> = {
  Backlink: 5, Content: 3, Keyword: 4, Optimization: 4, Audit: 2, Indexer: 2, 'Web Design': 8,
};
export const GIG_RATE_DEFAULT = 3;
export const gigRateFor = (service: string): number => GIG_RATE[service] ?? GIG_RATE_DEFAULT;
export const PAYOUTS: Payout[] = STAFF.map((s) => {
  const work = ORDERS.filter((o) => o.staff === s.name && PAYABLE_STATES.includes(o.status));
  const basis = work.reduce((a, o) => a + o.value, 0);
  const gig = work.reduce((a, o) => a + gigRateFor(o.service), 0);
  const gigCounts = Object.entries(
    work.reduce<Record<string, number>>((m, o) => { m[o.service] = (m[o.service] ?? 0) + 1; return m; }, {}),
  ).map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count);
  const rate = PAYOUT_RATE[s.role] ?? 0.28;
  const base = BASE_SALARY[s.role] ?? 800;
  const commission = Math.round(basis * rate);
  const bonus = 0;
  return {
    staffId: s.id, staff: s.name, role: s.role, active: s.active,
    completedOrders: work.length, basis, rate, base, gigUnits: work.length, gig, gigCounts, commission, bonus,
    due: base + gig + commission + bonus, lastPaidAt: '2026-06-05',
  };
});

// Manager payroll — fixed salary + commission on the value of orders their POD handles,
// plus a bonus that is a % of the bonuses the admin awards their pod's staff (so a manager
// shares in the upside they coach their team to). Total due = base + commission + bonus,
// where bonus is computed live in the UI from the current staff bonuses.
export interface ManagerPayout {
  managerId: string; manager: string; title: string; rank: string;
  podStaff: number;        // headcount in the pod
  podOrderValue: number;   // billable order value handled by the pod (commission basis)
  commissionRate: number;  // y% on pod order value
  commission: number;      // round(podOrderValue × commissionRate)
  base: number;            // fixed monthly salary
  bonusRate: number;       // x% of the bonuses awarded to the pod's staff
  due: number;             // base + commission (bonus added live from staff bonuses)
  lastPaidAt: string | null;
}
export const MANAGER_BASE_SALARY: Record<string, number> = { 'Senior Manager': 1800, 'Lead Manager': 1600 };
export const MANAGER_COMMISSION_RATE = 0.05; // 5% of the pod's billable order value
export const MANAGER_BONUS_RATE = 0.10;      // 10% of the bonuses awarded to the pod's staff
export const MANAGER_PAYOUTS: ManagerPayout[] = MANAGERS.map((m) => {
  const podStaff = STAFF.filter((s) => STAFF_MANAGER[s.id] === m.id);
  const podNames = new Set(podStaff.map((s) => s.name));
  const podOrderValue = ORDERS
    .filter((o) => o.staff !== null && podNames.has(o.staff) && PAYABLE_STATES.includes(o.status))
    .reduce((a, o) => a + o.value, 0);
  const commission = Math.round(podOrderValue * MANAGER_COMMISSION_RATE);
  const base = MANAGER_BASE_SALARY[m.rank] ?? 1500;
  return {
    managerId: m.id, manager: m.name, title: m.title, rank: m.rank,
    podStaff: podStaff.length, podOrderValue, commissionRate: MANAGER_COMMISSION_RATE,
    commission, base, bonusRate: MANAGER_BONUS_RATE, due: base + commission, lastPaidAt: '2026-06-05',
  };
});

// Cashflow: money in vs out per day (30d) — drives the Overview area chart.
export interface CashflowPoint { iso: string; date: string; in: number; out: number; }
function genCashflow(days: number): CashflowPoint[] {
  const rev = REVENUE_90.slice(-days);
  return rev.map((p, i) => {
    const dow = new Date(p.iso).getDay();
    const weekend = dow === 0 || dow === 6;
    const out = Math.round(p.revenue * 0.18) + (i % 9 === 4 ? 1860 : 0) + (weekend ? 40 : 110);
    return { iso: p.iso, date: p.date, in: p.revenue, out };
  });
}
export const CASHFLOW: CashflowPoint[] = genCashflow(30);

// Top-line balances — every figure derives from the data above.
export const FINANCE = {
  grossMtd: REVENUE_ANALYTICS.grossMtd,
  netMtd: REVENUE_ANALYTICS.netMtd,
  refundsMtd: REVENUE_ANALYTICS.refundsMtd,
  walletLiability: CUSTOMERS.reduce((a, c) => a + c.balance, 0),
  payoutsDue: PAYOUTS.reduce((a, p) => a + p.due, 0) + MANAGER_PAYOUTS.reduce((a, m) => a + m.due, 0),
  outstandingAr: INVOICES.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.amount, 0),
};

// ---- Settings (module 13): global config the other modules read ----
export interface SlaTarget { firstResponseH: number; resolutionH: number }
export interface EmailTemplate { id: string; name: string; subject: string; body: string; vars: string[] }
export interface Integration { key: string; name: string; status: 'connected' | 'disconnected'; detail: string; icon: string }
export interface AdminAccount { id: string; name: string; email: string; role: 'Master admin' | 'Admin'; lastActive: string; status: 'active' | 'invited' | 'disabled'; twoFA: boolean }
export interface AdminSettings {
  business: { name: string; supportEmail: string; address: string; timezone: string; currency: string; locale: string; brandColor: string };
  sla: { orders: Record<'high' | 'med' | 'low', SlaTarget>; tickets: Record<'urgent' | 'standard', SlaTarget> };
  routing: { skillWeight: number; capacityPenalty: number; roundRobin: boolean };
  scoring: { quality: number; onTime: number; throughput: number };
  email: EmailTemplate[];
  integrations: Integration[];
  admins: AdminAccount[];
}

export const ADMIN_SETTINGS: AdminSettings = {
  business: { name: 'HevaSEO', supportEmail: 'support@hevaseo.com', address: '123 Market St, San Francisco, CA 94103', timezone: 'America/Los_Angeles', currency: 'USD', locale: 'en-US', brandColor: '#2563eb' },
  sla: {
    orders: { high: { firstResponseH: 2, resolutionH: 24 }, med: { firstResponseH: 4, resolutionH: 48 }, low: { firstResponseH: 8, resolutionH: 72 } },
    tickets: { urgent: { firstResponseH: 1, resolutionH: 8 }, standard: { firstResponseH: 4, resolutionH: 24 } },
  },
  routing: { skillWeight: 60, capacityPenalty: 120, roundRobin: true },
  scoring: { quality: 50, onTime: 30, throughput: 20 },
  email: [
    { id: 'order_confirmed', name: 'Order confirmed', subject: 'Your order {{order_code}} is confirmed', body: 'Hi {{customer}},\n\nWe’ve confirmed {{order_code}} ({{service}}). You can track progress anytime in your dashboard.\n\n— The {{business}} team', vars: ['customer', 'order_code', 'service', 'business'] },
    { id: 'deliverable_ready', name: 'Deliverable ready', subject: '{{order_code}} is ready for your review', body: 'Hi {{customer}},\n\nYour deliverable for {{order_code}} is ready. Review and approve it in your dashboard.\n\n— {{business}}', vars: ['customer', 'order_code', 'business'] },
    { id: 'refund_issued', name: 'Refund issued', subject: 'A refund of {{amount}} has been issued', body: 'Hi {{customer}},\n\nWe’ve issued a refund of {{amount}} for {{order_code}}. It should appear in 5–10 business days.\n\n— {{business}}', vars: ['customer', 'amount', 'order_code', 'business'] },
    { id: 'ticket_reply', name: 'Support reply', subject: 'Re: {{ticket_subject}}', body: 'Hi {{customer}},\n\n{{reply_body}}\n\n— {{agent}}, {{business}} support', vars: ['customer', 'ticket_subject', 'reply_body', 'agent', 'business'] },
  ],
  integrations: [
    { key: 'stripe', name: 'Stripe', status: 'connected', detail: 'acct_1Hx9Qz · live mode', icon: 'ph-credit-card' },
    { key: 'smtp', name: 'Email · Postmark', status: 'connected', detail: 'smtp.postmarkapp.com', icon: 'ph-envelope-simple' },
    { key: 'turnstile', name: 'Cloudflare Turnstile', status: 'connected', detail: 'bot protection on public forms', icon: 'ph-shield-check' },
    { key: 'slack', name: 'Slack', status: 'disconnected', detail: 'route ops alerts to a channel', icon: 'ph-chats-circle' },
  ],
  admins: [
    { id: 'ad1', name: 'You', email: 'admin@hevaseo.com', role: 'Master admin', lastActive: 'just now', status: 'active', twoFA: true },
    { id: 'ad2', name: 'Sofia Marin', email: 'sofia@hevaseo.com', role: 'Admin', lastActive: '2h ago', status: 'active', twoFA: true },
    { id: 'ad3', name: 'Ken Rivera', email: 'ken@hevaseo.com', role: 'Admin', lastActive: 'pending invite', status: 'invited', twoFA: false },
  ],
};

// ---- Time-off / leave requests (decision 3 / §9) ----
// Staff submit these from /staff/settings; admin approves/declines in the leave queue.
export type LeaveStatus = 'pending' | 'approved' | 'declined';
export interface LeaveRequest {
  id: string; staffId: string; staffName: string; role: string;
  from: string; to: string; days: number; reason: string;
  status: LeaveStatus; requestedAt: string;
}
export const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'lv1', staffId: 's2', staffName: 'Linh P.', role: 'Backlink Specialist', from: '2026-07-03', to: '2026-07-07', days: 5, reason: 'Family trip — planned months ago.', status: 'pending', requestedAt: '2026-06-25' },
  { id: 'lv2', staffId: 's4', staffName: 'Diego R.', role: 'Content Specialist', from: '2026-06-30', to: '2026-06-30', days: 1, reason: 'Medical appointment in the afternoon.', status: 'pending', requestedAt: '2026-06-26' },
  { id: 'lv3', staffId: 's5', staffName: 'Aria K.', role: 'SEO Analyst', from: '2026-07-14', to: '2026-07-18', days: 5, reason: 'Annual leave.', status: 'pending', requestedAt: '2026-06-24' },
  { id: 'lv4', staffId: 's1', staffName: 'Mai T.', role: 'Senior SEO Specialist', from: '2026-06-19', to: '2026-06-20', days: 2, reason: 'Conference attendance.', status: 'approved', requestedAt: '2026-06-12' },
  { id: 'lv5', staffId: 's6', staffName: 'Tom B.', role: 'Link Builder', from: '2026-06-10', to: '2026-06-14', days: 5, reason: 'Personal time.', status: 'declined', requestedAt: '2026-06-02' },
];
