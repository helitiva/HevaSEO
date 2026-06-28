// Knowledge base — technical docs the admin/managers publish for staff to READ.
// Access is scoped by SKILL: a doc tagged `backlink` is delivered ONLY to staff whose
// skills include `backlink`. A content writer never receives backlink docs and vice-versa.
// The gate lives here at the data layer (docsForStaff / docById) — pages can't accidentally
// leak a doc, because they never receive one outside the viewer's permitted set.
import { SKILL_META } from './adminMock';

// A doc's audience tag. Concrete skills mirror the SKILL_META taxonomy; `general` = every
// staffer AND every manager; `manager` = managers only (ops playbooks); `customer` = the
// client portal (tutorials/tips admin publishes to users).
//
// A doc can target MORE THAN ONE audience (admin distributes one doc to, say, staff +
// customers). Seeds carry a single `audience`; admin-created docs carry `audiences[]`.
// Always read a doc's targets through `audiencesOf()` so both shapes work.
export type DocAudience = keyof typeof SKILL_META | 'general' | 'manager' | 'customer';

// All audience tags an admin can distribute to, in display order (for the compose form).
export const DISTRIBUTABLE_AUDIENCES: DocAudience[] = ['customer', 'general', 'manager', 'keyword', 'backlink', 'content', 'optimize'];
export type DocFormat = 'guide' | 'sop' | 'checklist' | 'template' | 'policy' | 'video';

export interface DocResource { kind: 'link' | 'file' | 'video'; url: string; label: string }

// Body is a small structured block list — no raw HTML, so nothing here can inject markup.
export type DocBlock =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'callout'; tone: 'info' | 'tip' | 'warn'; text: string };

export interface StaffDoc {
  id: string;
  title: string;
  audience: DocAudience; // primary/legacy single audience (always set)
  audiences?: DocAudience[]; // multi-target distribution (admin-created docs); falls back to [audience]
  format: DocFormat;
  summary: string;
  tags: string[];
  author: string;
  updatedAt: string; // ISO date
  readMins: number;
  body: DocBlock[]; // structured blocks (built-in seeds)
  html?: string; // sanitized rich-text HTML (admin-authored docs); when set, the reader renders this
  resources: DocResource[];
  pinned?: boolean;
  system?: boolean; // true for built-in seeds (read-only); false/undefined for admin-created
}

// The audiences a doc is distributed to — multi-target if set, else the single seed audience.
export function audiencesOf(doc: StaffDoc): DocAudience[] {
  return doc.audiences && doc.audiences.length ? doc.audiences : [doc.audience];
}

export const FORMAT_META: Record<DocFormat, { label: string; icon: string }> = {
  guide: { label: 'Guide', icon: 'ph-book-open' },
  sop: { label: 'SOP', icon: 'ph-list-checks' },
  checklist: { label: 'Checklist', icon: 'ph-check-square' },
  template: { label: 'Template', icon: 'ph-file-dashed' },
  policy: { label: 'Policy', icon: 'ph-shield-check' },
  video: { label: 'Video', icon: 'ph-play-circle' },
};

// Visual meta for a doc's audience (general gets its own neutral chip).
export function audienceMeta(audience: DocAudience): { label: string; icon: string; color: string } {
  if (audience === 'general') return { label: 'All staff', icon: 'ph-users-three', color: '#64748b' };
  if (audience === 'manager') return { label: 'Managers', icon: 'ph-user-circle-gear', color: '#0ea5e9' };
  if (audience === 'customer') return { label: 'Customers', icon: 'ph-user', color: '#22c55e' };
  return SKILL_META[audience] ?? { label: audience, icon: 'ph-circle', color: '#64748b' };
}

// ── Seed library ──────────────────────────────────────────────────────────
export const DOCS: StaffDoc[] = [
  // —— General (every staffer) ——
  {
    id: 'd-onboarding', title: 'Staff handbook & onboarding', audience: 'general', format: 'guide',
    summary: 'How we work: your day, the task lifecycle, who reviews your output, and where to ask for help.',
    tags: ['onboarding', 'process', 'start-here'], author: 'Ops', updatedAt: '2026-06-10', readMins: 6, pinned: true,
    body: [
      { type: 'p', text: 'Welcome to the delivery team. This handbook is the fastest way to understand how work reaches you and how it gets shipped.' },
      { type: 'h', text: 'The task lifecycle' },
      { type: 'ol', items: [
        'Admin confirms an order and routes it to your board based on your skills.',
        'You pick it up from My Tasks → move it to In progress.',
        'You submit a deliverable. It goes to Internal review.',
        'A manager QAs it — approved, or sent back as Changes requested.',
        'Approved work is delivered to the customer and your scorecard updates.',
      ] },
      { type: 'callout', tone: 'tip', text: 'Keep a self-note on multi-step tasks so you can resume after a context switch without losing your place.' },
      { type: 'h', text: 'Where to ask' },
      { type: 'p', text: 'Ping your manager early when a brief is unclear — that beats a rework round. Account-level questions go through admin.' },
    ],
    resources: [{ kind: 'link', url: 'https://example.com/handbook', label: 'Full handbook (web)' }],
  },
  {
    id: 'd-data-policy', title: 'Client data & security policy', audience: 'general', format: 'policy',
    summary: 'What you may and may not do with client credentials, files, and access. Read before touching any client account.',
    tags: ['security', 'privacy', 'compliance'], author: 'Ops', updatedAt: '2026-06-18', readMins: 4, pinned: true,
    body: [
      { type: 'callout', tone: 'warn', text: 'Never store client passwords in a personal note, chat, or spreadsheet. Use the access the platform grants you, nothing more.' },
      { type: 'ul', items: [
        'Access client accounts only for the task assigned to you.',
        'Do not download client data to personal devices.',
        'Report any suspected exposure to admin immediately.',
        'Delete temporary working files once a task is approved.',
      ] },
    ],
    resources: [],
  },
  {
    id: 'd-brand-voice', title: 'Brand voice & tone reference', audience: 'general', format: 'guide',
    summary: 'House style for anything customer-facing: warm, specific, confident — never hypey.',
    tags: ['voice', 'style', 'writing'], author: 'Ken Rivera', updatedAt: '2026-05-30', readMins: 3,
    body: [
      { type: 'ul', items: [
        'Plain words over jargon. If a customer would not say it, do not write it.',
        'Lead with the outcome, then the detail.',
        'No exclamation-mark stacking. One, sparingly.',
      ] },
    ],
    resources: [],
  },

  // —— Content ——
  {
    id: 'd-content-sop', title: 'Content writing SOP', audience: 'content', format: 'sop',
    summary: 'The standard operating procedure for every article: research → outline → draft → on-page → self-QA.',
    tags: ['content', 'workflow', 'articles'], author: 'Ken Rivera', updatedAt: '2026-06-22', readMins: 7, pinned: true,
    body: [
      { type: 'h', text: 'Before you write' },
      { type: 'ol', items: [
        'Confirm the target keyword and search intent from the brief.',
        'Pull the top 5 SERP competitors and note their angle and gaps.',
        'Draft an H2/H3 outline before writing a single paragraph.',
      ] },
      { type: 'h', text: 'On-page, every time' },
      { type: 'ul', items: [
        'Meta title (≤ 60 chars) and meta description (≤ 155 chars).',
        '2–3 internal links to relevant money/cluster pages.',
        'One descriptive H1, logical H2/H3 hierarchy.',
        'Alt text on every image.',
      ] },
      { type: 'callout', tone: 'warn', text: 'Most rework rounds come from missing internal links + meta. Self-QA these before you submit.' },
    ],
    resources: [
      { kind: 'link', url: 'https://docs.google.com/document/d/content-brief-template', label: 'Article brief template' },
    ],
  },
  {
    id: 'd-onpage-checklist', title: 'On-page SEO checklist', audience: 'content', format: 'checklist',
    summary: 'Run this before submitting any page. If every box is ticked, it passes first-time QA.',
    tags: ['content', 'on-page', 'qa'], author: 'Ken Rivera', updatedAt: '2026-06-20', readMins: 2,
    body: [
      { type: 'ul', items: [
        'Primary keyword in title, H1, first 100 words, and one H2.',
        'Meta title + description written (not auto-generated).',
        '2–3 internal links with natural anchors.',
        'No keyword stuffing — reads naturally aloud.',
        'Images compressed + alt text set.',
        'Plagiarism check passed.',
      ] },
    ],
    resources: [],
  },
  {
    id: 'd-meta-formula', title: 'Meta title & description formulas', audience: 'content', format: 'template',
    summary: 'Copy-paste patterns for titles and descriptions that earn the click.',
    tags: ['content', 'meta', 'ctr'], author: 'Ken Rivera', updatedAt: '2026-05-12', readMins: 3,
    body: [
      { type: 'h', text: 'Title patterns' },
      { type: 'code', text: '{Primary Keyword} — {Benefit} | {Brand}\n{Number} {Primary Keyword} for {Audience} ({Year})' },
      { type: 'h', text: 'Description pattern' },
      { type: 'code', text: '{Promise in 1 sentence}. {Proof or specifics}. {Soft CTA}.' },
    ],
    resources: [],
  },

  // —— Keyword ——
  {
    id: 'd-keyword-method', title: 'Keyword research methodology', audience: 'keyword', format: 'sop',
    summary: 'How we build a keyword map: seed → expand → cluster → prioritise by intent and difficulty.',
    tags: ['keyword', 'research', 'mapping'], author: 'Sofia Marin', updatedAt: '2026-06-19', readMins: 6, pinned: true,
    body: [
      { type: 'ol', items: [
        'Gather seed terms from the client brief and existing rankings.',
        'Expand with the tool of record; export volume + difficulty.',
        'Cluster by topic and by search intent.',
        'Prioritise: high intent + achievable difficulty first.',
      ] },
      { type: 'callout', tone: 'tip', text: 'Always add a search-intent column to the map — it is the most common QA note on keyword work.' },
    ],
    resources: [],
  },
  {
    id: 'd-intent-mapping', title: 'Search intent mapping guide', audience: 'keyword', format: 'guide',
    summary: 'Classify every keyword as informational, commercial, transactional, or navigational — and what each implies.',
    tags: ['keyword', 'intent'], author: 'Sofia Marin', updatedAt: '2026-05-28', readMins: 4,
    body: [
      { type: 'ul', items: [
        'Informational → blog/guide. Optimise for depth + featured snippet.',
        'Commercial → comparison/review. Optimise for trust signals.',
        'Transactional → product/service page. Optimise for conversion.',
        'Navigational → brand page. Usually already owned.',
      ] },
    ],
    resources: [],
  },

  // —— Backlink ——
  {
    id: 'd-outreach-sop', title: 'Link building & outreach SOP', audience: 'backlink', format: 'sop',
    summary: 'Prospecting, vetting, outreach, and placement — the full link acquisition workflow.',
    tags: ['backlink', 'outreach', 'workflow'], author: 'Sofia Marin', updatedAt: '2026-06-21', readMins: 7, pinned: true,
    body: [
      { type: 'h', text: 'Workflow' },
      { type: 'ol', items: [
        'Share target domains with your manager before any outreach.',
        'Vet each prospect (see referring-domain quality doc).',
        'Personalise every email — no mass blasts.',
        'Log placements with live URLs for QA.',
      ] },
      { type: 'callout', tone: 'warn', text: 'Quality over volume. One DR50 placement beats three weak ones — and weak placements can hurt the client.' },
    ],
    resources: [],
  },
  {
    id: 'd-anchor-policy', title: 'Anchor text policy', audience: 'backlink', format: 'policy',
    summary: 'Keep the anchor profile natural. Over-optimised exact-match anchors are a penalty risk.',
    tags: ['backlink', 'anchors', 'risk'], author: 'Sofia Marin', updatedAt: '2026-06-02', readMins: 3,
    body: [
      { type: 'ul', items: [
        'Favour branded + naked-URL anchors as the bulk of the profile.',
        'Use exact-match sparingly and only where contextually natural.',
        'Vary partial-match anchors; never repeat the same phrase.',
      ] },
    ],
    resources: [],
  },
  {
    id: 'd-domain-vetting', title: 'Vetting referring domains', audience: 'backlink', format: 'checklist',
    summary: 'A go/no-go checklist before you pursue any placement.',
    tags: ['backlink', 'vetting', 'quality'], author: 'Sofia Marin', updatedAt: '2026-05-15', readMins: 2,
    body: [
      { type: 'ul', items: [
        'Real organic traffic (not just a high DR).',
        'Topical relevance to the client.',
        'Clean outbound link profile — no link farms.',
        'Indexed and actively published.',
      ] },
    ],
    resources: [],
  },

  // —— Optimization / technical ——
  {
    id: 'd-audit-runbook', title: 'Technical audit runbook', audience: 'optimize', format: 'sop',
    summary: 'Crawl → triage → prioritise. How to turn a raw site crawl into an actionable fix list.',
    tags: ['optimize', 'audit', 'technical'], author: 'Ken Rivera', updatedAt: '2026-06-24', readMins: 8, pinned: true,
    body: [
      { type: 'ol', items: [
        'Run the crawl; wait for completion before triaging large sites.',
        'Bucket issues: indexability, on-page, performance, structure.',
        'Prioritise by impact × effort — indexability blockers first.',
        'Write fixes as concrete, assignable actions.',
      ] },
      { type: 'callout', tone: 'tip', text: 'For large sites (4k+ URLs) the crawl can take a while — start it early and come back to triage.' },
    ],
    resources: [],
  },
  {
    id: 'd-cwv-fixes', title: 'Core Web Vitals fix playbook', audience: 'optimize', format: 'guide',
    summary: 'The common LCP / CLS / INP offenders and the fix for each.',
    tags: ['optimize', 'performance', 'cwv'], author: 'Ken Rivera', updatedAt: '2026-06-08', readMins: 5,
    body: [
      { type: 'ul', items: [
        'LCP: preload hero image + font; set explicit dimensions.',
        'CLS: reserve space for images/ads; avoid late-injected content.',
        'INP: break up long tasks; defer non-critical JS.',
      ] },
      { type: 'callout', tone: 'warn', text: 'Always cite before/after metrics with a source when reporting optimisation work.' },
    ],
    resources: [],
  },
  {
    id: 'd-indexing', title: 'Indexing playbook', audience: 'optimize', format: 'guide',
    summary: 'Get new and updated pages discovered and indexed faster.',
    tags: ['optimize', 'indexing'], author: 'Ken Rivera', updatedAt: '2026-04-30', readMins: 4,
    body: [
      { type: 'ol', items: [
        'Confirm the page is crawlable (robots, canonical, noindex).',
        'Add it to the sitemap and ping the search console.',
        'Build at least one internal link from an indexed page.',
      ] },
    ],
    resources: [],
  },

  // —— Managers only ——
  {
    id: 'd-pod-playbook', title: 'Running your pod', audience: 'manager', format: 'guide',
    summary: 'How to balance load, route work, and keep your team’s quality and on-time rates healthy.',
    tags: ['management', 'workload', 'process'], author: 'Ops', updatedAt: '2026-06-25', readMins: 6, pinned: true,
    body: [
      { type: 'h', text: 'Your daily loop' },
      { type: 'ol', items: [
        'Clear the assignment queue — route new work to the best-fit, least-loaded teammate.',
        'Triage anything overdue or due today before assigning more.',
        'Work the review queue so deliverables don’t age past SLA.',
        'Scan tickets for breaches and reassign if an owner is overloaded.',
      ] },
      { type: 'callout', tone: 'tip', text: 'Utilization above ~90% on any teammate is a re-balance signal — pull from them before they slip.' },
      { type: 'h', text: 'What you don’t handle' },
      { type: 'p', text: 'Pay, payouts, customer billing and refunds are admin-only — escalate those rather than acting on them.' },
    ],
    resources: [],
  },
  {
    id: 'd-review-standard', title: 'QA review standard', audience: 'manager', format: 'sop',
    summary: 'The bar every deliverable must clear before it ships, and how to write a useful change request.',
    tags: ['management', 'qa', 'review'], author: 'Ops', updatedAt: '2026-06-23', readMins: 5, pinned: true,
    body: [
      { type: 'ul', items: [
        'Check completeness against the order’s included scope first.',
        'Then quality: on-page, accuracy, brand voice, no stuffing.',
        'Approve only when you’d be happy sending it to the client as-is.',
      ] },
      { type: 'callout', tone: 'warn', text: 'A change request without a specific, actionable note just causes another round. Say exactly what to fix and where.' },
    ],
    resources: [],
  },
  {
    id: 'd-escalation', title: 'Escalation & coverage', audience: 'manager', format: 'policy',
    summary: 'When to escalate to admin, and how to cover a teammate’s queue during leave.',
    tags: ['management', 'escalation', 'leave'], author: 'Ops', updatedAt: '2026-06-15', readMins: 3,
    body: [
      { type: 'ul', items: [
        'Escalate billing disputes, refunds and credit issues to admin.',
        'For approved leave, redistribute the open queue before the first day off.',
        'Flag repeated quality misses early — don’t let them compound.',
      ] },
    ],
    resources: [],
  },

  // —— Customers (the client portal) ——
  {
    id: 'd-getting-started', title: 'Getting started with HevaSEO', audience: 'customer', format: 'guide',
    summary: 'How to place an order, track progress, approve deliverables and top up credit — your first 10 minutes.',
    tags: ['getting-started', 'orders', 'tutorial'], author: 'HevaSEO Team', updatedAt: '2026-06-26', readMins: 4, pinned: true,
    body: [
      { type: 'p', text: 'Welcome! Here’s the quickest path from signing in to seeing results land in your dashboard.' },
      { type: 'h', text: 'Place your first order' },
      { type: 'ol', items: [
        'Open Browse services and pick the service that matches your goal.',
        'Choose a package, fill in the brief (the more detail, the better the result), and confirm.',
        'Track it live on the Orders board as it moves through delivery.',
      ] },
      { type: 'callout', tone: 'tip', text: 'A clear brief — target pages, keywords, and brand voice — is the single biggest lever on quality.' },
      { type: 'h', text: 'Approve & give feedback' },
      { type: 'p', text: 'When a deliverable is ready you’ll get it in the order. Review it, approve, or request a tweak — your feedback goes straight to the specialist.' },
    ],
    resources: [{ kind: 'link', url: 'https://example.com/help', label: 'Help center' }],
  },
  {
    id: 'd-brief-tips', title: 'How to write a brief that gets great results', audience: 'customer', format: 'guide',
    summary: 'Five things to include in every order brief so the work comes back right the first time.',
    tags: ['briefs', 'tips', 'quality'], author: 'HevaSEO Team', updatedAt: '2026-06-20', readMins: 3, pinned: true,
    body: [
      { type: 'ul', items: [
        'Target URL(s) — the exact page(s) you want to rank or improve.',
        'Primary keywords or the outcome you’re chasing.',
        'Audience & brand voice — who reads this and how it should sound.',
        'Any must-include or must-avoid points (claims, competitors, compliance).',
        'Examples you like — a link or two speaks louder than a paragraph.',
      ] },
      { type: 'callout', tone: 'info', text: 'Not sure? Start an order anyway and add notes — your specialist will ask if anything’s unclear.' },
    ],
    resources: [],
  },
  {
    id: 'd-reading-results', title: 'Understanding your SEO results', audience: 'customer', format: 'guide',
    summary: 'What the deliverables mean, realistic timelines, and how to read the wins.',
    tags: ['results', 'reporting', 'tutorial'], author: 'HevaSEO Team', updatedAt: '2026-06-12', readMins: 5,
    body: [
      { type: 'p', text: 'SEO compounds. Some changes (on-page, technical fixes) show up in weeks; authority and rankings build over months.' },
      { type: 'ul', items: [
        'On-page & content — live immediately; indexing follows within days.',
        'Backlinks — value accrues as pages are crawled and trusted.',
        'Technical fixes — often the fastest measurable win (speed, crawlability).',
      ] },
      { type: 'callout', tone: 'tip', text: 'Top up credit ahead of time so your specialist never pauses mid-program waiting on funds.' },
    ],
    resources: [],
  },
];

// ── Access gates ──────────────────────────────────────────────────────────────
// One audience-match per role, all reading a doc's targets through audiencesOf so a
// multi-target admin doc reaches every audience it was distributed to. The list/reader
// views funnel through these, so a doc outside the viewer's audience can't render.

// A staffer reads `general` docs + any doc tagged with one of their skills.
export function canRead(doc: StaffDoc, skills: string[]): boolean {
  return audiencesOf(doc).some((a) => a === 'general' || skills.includes(a));
}
// A manager reads `manager` + `general` docs.
export function canReadManager(doc: StaffDoc): boolean {
  return audiencesOf(doc).some((a) => a === 'manager' || a === 'general');
}
// A customer reads `customer` docs only.
export function canReadCustomer(doc: StaffDoc): boolean {
  return audiencesOf(doc).includes('customer');
}

// Pinned first, then newest. Shared sort so every audience list is ordered the same.
function byPinnedThenNewest(a: StaffDoc, b: StaffDoc): number {
  return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt);
}

// Audience views operate on a `docs` argument (seeds + any admin-created docs from the
// store), so newly distributed docs reach their audience. Callers pass the merged list.
export function docsForStaff(docs: StaffDoc[], skills: string[]): StaffDoc[] {
  return docs.filter((d) => canRead(d, skills)).sort(byPinnedThenNewest);
}
export function docsForManager(docs: StaffDoc[]): StaffDoc[] {
  return docs.filter(canReadManager).sort(byPinnedThenNewest);
}
export function docsForCustomer(docs: StaffDoc[]): StaffDoc[] {
  return docs.filter(canReadCustomer).sort(byPinnedThenNewest);
}

// Permission-checked single-doc lookups. Undefined when the doc doesn't exist OR the
// viewer may not read it — pages treat both as notFound, so existence never leaks.
export function docForStaff(docs: StaffDoc[], id: string, skills: string[]): StaffDoc | undefined {
  const doc = docs.find((d) => d.id === id);
  return doc && canRead(doc, skills) ? doc : undefined;
}
export function docForManager(docs: StaffDoc[], id: string): StaffDoc | undefined {
  const doc = docs.find((d) => d.id === id);
  return doc && canReadManager(doc) ? doc : undefined;
}
export function docForCustomer(docs: StaffDoc[], id: string): StaffDoc | undefined {
  const doc = docs.find((d) => d.id === id);
  return doc && canReadCustomer(doc) ? doc : undefined;
}
