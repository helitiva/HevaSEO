/**
 * Service catalog for the in-dashboard "browse & order a service" flow.
 * Mirrors the marketing catalog (apps/web) but shaped for the portal. Only services
 * with a SERVICE_CATALOG entry are orderable; the rest show a "coming soon" state.
 */
import type { ServiceKey } from './mock';
import type { FieldDef } from '@heva/catalog';

/** Form field — unified with the shared catalog so add-on + brief fields share one shape. */
export type SvcField = FieldDef;

export interface SvcPackage {
  id: string;
  name: string;
  price: number;          // USD; 0 when priceLabel carries a quote
  priceLabel?: string;
  sla: string;            // '~2 days'
  popular?: boolean;
  summary: string;
  features: string[];
}

export interface SvcBullet {
  icon: string;           // phosphor
  title: string;
  desc: string;
}

/** Bulk-quantity ordering: the chosen package is a per-unit price × a keyword-list count. */
export interface SvcBulk {
  unit: string;          // 'article'
  unitPlural: string;    // 'articles'
  countNoun: string;     // 'keyword'
  minDiscountQty: number;
  discountPct: number;
  defaultQty: number;
  sampleUrl?: string;
}

/** Usage-based pricing: count a submitted list, apply a volume rate (highest matching tier). */
export interface SvcUsageTier {
  min: number;           // applies when count >= min; highest matching wins
  rate: number;          // price per unit
  label: string;
  sub?: string;
}
export interface SvcUsage {
  unit: string;          // 'link'
  unitPlural: string;    // 'links'
  countNoun: string;     // 'URL'
  tiers: SvcUsageTier[];
  defaultQty: number;
  sampleUrl?: string;
}

/** A titled set of packages (for services whose plans split into types, e.g. backlink). */
export interface SvcGroup {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  packages: SvcPackage[];
}

export interface SvcCatalog {
  key: ServiceKey;
  name: string;
  tagline: string;
  icon: string;
  hero: string;           // intro paragraph
  included: SvcBullet[];  // what the service covers
  steps: SvcBullet[];     // how it works
  packages?: SvcPackage[];  // flat list — use this OR groups
  groups?: SvcGroup[];      // grouped plans (single selection across all groups)
  fields: SvcField[];     // order brief
  bulk?: SvcBulk;         // when set, price = chosen package per-unit × keyword-list count
  usage?: SvcUsage;       // when set, no packages — price = tiered rate × submitted-list count
  addons?: string[];      // checkout upsells — ids into the shared @heva/catalog ADDONS
  faqs?: { q: string; a: string }[];
  orderTitle: string;     // board card title, e.g. 'Website audit'
  orderCode: string;      // board id prefix, e.g. 'AD'
}

/** Short blurbs for the catalog grid — covers every service (orderable or not yet). */
export const SERVICE_BLURBS: Record<ServiceKey, string> = {
  audit: 'A full, prioritized map of what holds your site back — with how to fix it.',
  backlink: 'Safe, white-hat authority links — Entity, Pyramid, Guest & PR, indexed.',
  content: 'Articles built to rank — AI-powered or human-written, scored.',
  indexer: 'Push the links you built into Google\'s index — pay per link.',
  optimize: 'Faster, cleaner & AI-ready — measured before/after and deployed.',
  keyword: 'Know which keywords to target — and where you stand vs competitors.',
  design: 'A website built to rank from day one — draft in 2 days.',
};

export const SERVICE_CATALOG: Partial<Record<ServiceKey, SvcCatalog>> = {
  audit: {
    key: 'audit',
    name: 'Website Audit',
    tagline: "A full map of what's holding your site back — every issue ranked by priority, with how to fix it.",
    icon: 'ph-stethoscope',
    orderTitle: 'Website audit',
    orderCode: 'AD',
    hero: "We crawl your site across every dimension Google cares about — technical, on-page, content, schema, Core Web Vitals and index coverage — then hand you a scored dashboard report and a downloadable PDF, with issues sorted by severity and an estimated impact for each fix.",
    included: [
      { icon: 'ph-wrench', title: 'Technical SEO', desc: 'Crawlability, indexation, redirects, sitemaps & robots.' },
      { icon: 'ph-file-text', title: 'On-page & content', desc: 'Titles, meta, headings, structure and content quality.' },
      { icon: 'ph-code', title: 'Schema & structured data', desc: 'Markup coverage and validity for rich results.' },
      { icon: 'ph-gauge', title: 'Core Web Vitals', desc: 'LCP, INP and CLS — real-world performance.' },
      { icon: 'ph-share-network', title: 'Backlink profile', desc: 'Authority and toxic-link analysis (Pro).' },
      { icon: 'ph-magnifying-glass', title: 'Index coverage', desc: "What Google has indexed — and what it hasn't." },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a plan and the project. No payment yet.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'A specialist confirms scope within 24h.' },
      { icon: 'ph-magnifying-glass', title: 'We crawl & analyze', desc: 'A full crawl across every dimension.' },
      { icon: 'ph-file-text', title: 'You receive', desc: 'A scored dashboard report + downloadable PDF.' },
    ],
    packages: [
      {
        id: 'basic',
        name: 'Basic',
        price: 19,
        sla: '~2 days',
        summary: "A quick snapshot of your site's SEO health",
        features: ['Technical SEO & basic on-page audit', 'Index coverage check', 'Overall SEO Health Score', 'Dashboard report + downloadable PDF'],
      },
      {
        id: 'standard',
        name: 'Standard',
        price: 39,
        sla: '~2–3 days',
        popular: true,
        summary: 'A deeper audit of content, schema & Core Web Vitals',
        features: ['Everything in Basic', 'Content & on-page audit', 'Schema / structured data check', 'Core Web Vitals (LCP / INP / CLS)', 'A detailed, prioritized fix roadmap'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 69,
        sla: '~3–4 days',
        summary: 'A full audit before a major SEO campaign',
        features: ['Everything in Standard', 'Deep Core Web Vitals analysis', 'Backlink profile + toxic-link analysis', 'Competitor benchmark + content gap', 'Prioritized fix list with impact estimate'],
      },
    ],
    fields: [
      { label: 'Website / domain to audit', name: 'website', type: 'url', required: true, colSpan: 2, placeholder: 'https://yoursite.com' },
      { label: 'What should the audit focus on?', name: 'focus', as: 'textarea', required: true, colSpan: 2, placeholder: 'Rankings, page speed, a recent traffic drop, a migration, AI visibility…', hint: "We'll check everything, but we'll lead with this." },
      { label: 'Share GSC / Analytics access?', name: 'access', as: 'select', options: [
        { value: '', label: 'Select…' },
        { value: 'after', label: "I'll share after we confirm" },
        { value: 'no', label: 'Not now — audit from the outside' },
      ] },
      { label: 'Target market / language', name: 'market', placeholder: 'e.g. United States · English' },
      { label: 'Competitors to benchmark', name: 'competitors', as: 'textarea', colSpan: 2, placeholder: 'competitor-one.com\ncompetitor-two.com' },
    ],
    addons: ['optimization', 'keyword', 'content'],
    faqs: [
      { q: 'What access do you need?', a: 'Nothing to start. For a deeper audit (great on Pro) you can share Google Search Console / Analytics access after we confirm scope.' },
      { q: 'Can you fix the issues too?', a: 'Yes — add Website Optimization and we implement the prioritized fixes, not just list them.' },
      { q: 'Can I re-audit after fixes?', a: 'Absolutely. Many clients run a follow-up audit to confirm the before/after improvement.' },
    ],
  },

  backlink: {
    key: 'backlink',
    name: 'Backlinks',
    tagline: 'Build authority with safe, white-hat links — every package includes our Indexer free.',
    icon: 'ph-share-network',
    orderTitle: 'Backlinks',
    orderCode: 'BL',
    hero: "Authority that compounds — across the four link systems Google trusts: Entity, Pyramid, Guest Post and PR. Every package runs through our Indexer free, with a live per-link report, an index-rate guarantee, and dead-link replacement. Pick a type and tier, and we handle the build, outreach and indexing.",
    included: [
      { icon: 'ph-list-checks', title: 'Indexer included free', desc: 'Every link pushed into Google\'s index — Entity 80–95%, Guest & PR ~100%.' },
      { icon: 'ph-file-text', title: 'Live per-link report', desc: 'Live URL, target, anchor, DR/DA, date and status.' },
      { icon: 'ph-shield-check', title: 'White-hat & safe', desc: 'Diversified, natural anchors and Google-safe placements.' },
      { icon: 'ph-arrow-counter-clockwise', title: 'Dead-link replacement', desc: 'Any link that drops is replaced free.' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a type, a tier and the project.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'A specialist confirms targets & anchors within 24–48h.' },
      { icon: 'ph-share-network', title: 'We build & index', desc: 'Build + outreach, with the Indexer running alongside.' },
      { icon: 'ph-file-text', title: 'You receive', desc: 'A live report + Excel with every link and its index status.' },
    ],
    groups: [
      {
        id: 'entity', title: 'Entity', subtitle: 'Brand trust — profiles, NAP & citations · index 80–95%', icon: 'ph-buildings',
        packages: [
          { id: 'entity-300', name: 'Entity 300', price: 52, sla: '7–10 days', summary: '300 authority links', features: ['300 authority links', 'Business profiles + NAP citations', 'Social profile citations', 'Safe, diversified anchors', '80–95% indexed · live report'] },
          { id: 'entity-500', name: 'Entity 500', price: 79, popular: true, sla: '10–14 days', summary: '500 links + directory listings', features: ['500 authority links', 'Profiles · NAP · social citations', 'Trusted directory listings', 'White-hat, Google-safe placements', '80–95% indexed · live report'] },
          { id: 'entity-1000', name: 'Entity 1000', price: 139, sla: '14–21 days', summary: '1,000 links + web 2.0', features: ['1,000 authority links', 'Profiles · NAP · social · directory', 'Web 2.0 / extended entity links', 'Widest brand footprint', '80–95% indexed · live report'] },
        ],
      },
      {
        id: 'pyramid', title: 'Pyramid', subtitle: 'Funnel power to one URL through tiered links · index ~70%', icon: 'ph-stack',
        packages: [
          { id: 'pyramid-starter', name: 'Pyramid Starter', price: 36, sla: '10 days', summary: 'Tier-1 → Tier-2', features: ['Tier-1 contextual links', 'Tier-2 support layer', 'Power funneled to 1 URL', '~70% indexed · live report'] },
          { id: 'pyramid-growth', name: 'Pyramid Growth', price: 64, popular: true, sla: '14 days', summary: 'Denser Tier-1', features: ['Denser Tier-1 contextual links', 'Tier-2 support layer', 'Stronger power to your URL', '~70% indexed · live report'] },
          { id: 'pyramid-power', name: 'Pyramid Power', price: 104, sla: '18 days', summary: '3 tiers (T1–T3)', features: ['3 tiers (T1 → T2 → T3)', 'Deeper power flow', 'For a competitive URL / category', '~70% indexed · live report'] },
          { id: 'pyramid-max', name: 'Pyramid Max', price: 159, sla: '21 days', summary: 'Full 3 tiers + power', features: ['Full 3 tiers + extra strong links', 'Maximum power funnel', 'Advanced Indexer push', '~70%+ indexed · live report'] },
        ],
      },
      {
        id: 'guest', title: 'Guest Post', subtitle: 'Article written + placed on real blogs · index ~100%', icon: 'ph-newspaper-clipping',
        packages: [
          { id: 'guest-3', name: 'Guest 3', price: 104, sla: '2–3 weeks', summary: 'DR30+ blogs', features: ['3 guest posts on DR30+ blogs', 'SEO article written for each', 'Manual outreach + placement', '~100% indexed · live report'] },
          { id: 'guest-5', name: 'Guest 5', price: 180, popular: true, sla: '~3 weeks', summary: 'DR40+ blogs', features: ['5 guest posts on DR40+ blogs', 'SEO article written for each', 'Higher-authority, real-traffic sites', '~100% indexed · live report'] },
          { id: 'guest-5-pro', name: 'Guest 5 Pro', price: 280, sla: '3–4 weeks', summary: 'DR50+ + Pyramid', features: ['5 guest posts on DR50+ blogs', '+ Pyramid boost per post', 'Premium, high-traffic publications', '~100% indexed · live report'] },
        ],
      },
      {
        id: 'pr', title: 'PR — International press', subtitle: 'Published on news sites · quoted per outlet · index ~100%', icon: 'ph-megaphone',
        packages: [
          { id: 'pr', name: 'PR feature', price: 120, priceLabel: 'from $120', sla: 'By scope', summary: 'International press coverage', features: ['Published on international news sites', 'Outlets & cost proposed to your budget', '~100% indexed', 'Link to the published article'] },
        ],
      },
    ],
    fields: [
      { label: 'Target URL(s) to boost', name: 'targets', as: 'textarea', colSpan: 2, placeholder: 'https://yoursite.com/page', hint: 'One per line — the pages you want to rank. Entity? Your homepage is fine.' },
      { label: 'Preferred anchors / keywords', name: 'anchors', as: 'textarea', colSpan: 2, placeholder: 'brand name, primary keyword, naked URL', hint: "We'll keep a safe, natural anchor ratio." },
      { label: 'Niche / industry', name: 'niche', placeholder: 'e.g. SaaS, dental, fashion' },
      { label: 'Language / market', name: 'market', placeholder: 'e.g. United States · English' },
    ],
    addons: ['content', 'keyword', 'optimization'],
    faqs: [
      { q: 'Is the Indexer really free?', a: 'Yes — every Backlink package runs through our Indexer at no extra cost, with a 2-week index-rate guarantee.' },
      { q: 'What DR / DA do the links have?', a: 'It depends on the type. Guest Post placements start at DR30+/DR40+/DR50+; Entity builds profiles & citations; PR lands on international news outlets.' },
      { q: 'Are the links safe?', a: 'Yes — white-hat placements with diversified, natural anchors. Any dead link is replaced free.' },
    ],
  },

  content: {
    key: 'content',
    name: 'SEO Content Writing',
    tagline: 'Articles built to rank — AI-powered for speed or human-written for deepest E-E-A-T. One article per keyword.',
    icon: 'ph-pen-nib',
    orderTitle: 'SEO content',
    orderCode: 'CT',
    hero: 'Pick the article type and length, then drop in your keyword list — one ranking-ready article per keyword. Every piece is on-page optimized, plagiarism & AI-checked, and ships with a Content Score & Methodology report. Order 10+ and the bulk discount kicks in automatically.',
    included: [
      { icon: 'ph-sparkle', title: 'AI or human-written', desc: 'Fast & cost-efficient, or deepest E-E-A-T.' },
      { icon: 'ph-magnifying-glass', title: 'On-page optimized', desc: 'Title, meta, headings, density, internal links.' },
      { icon: 'ph-shield-check', title: 'Plagiarism & AI-checked', desc: 'Original, Google-safe, helpful content.' },
      { icon: 'ph-chart-bar', title: 'Content Score report', desc: 'A quality score + methodology per article.' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a type/length and paste your keyword list.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'A specialist confirms scope & the final count.' },
      { icon: 'ph-pen-nib', title: 'We write', desc: 'One optimized article per keyword.' },
      { icon: 'ph-file-text', title: 'You receive', desc: 'HTML preview · DOC · TXT · images + score report.' },
    ],
    groups: [
      {
        id: 'ai', title: 'AI-powered', subtitle: 'AI ~70% + human editor · fast & cost-efficient', icon: 'ph-sparkle',
        packages: [
          { id: 'a1000', name: 'A1000', price: 12, sla: '2–3 days', summary: '~1,000 words · standard', features: ['~1,000-word SEO article + images', 'Full on-page optimization', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'a2000', name: 'A2000', price: 19, popular: true, sla: '~3 days', summary: '~2,000 words · in-depth', features: ['In-depth ~2,000-word article + images', 'Internal links + outbound citations', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'a3000', name: 'A3000', price: 28, sla: '3–4 days', summary: '~3,000 words · pillar', features: ['Pillar-length ~3,000-word article + images', 'Topic-cluster ready + internal linking', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
        ],
      },
      {
        id: 'human', title: 'Human-written', subtitle: 'Human 70–80% + AI assist · deepest E-E-A-T', icon: 'ph-pen-nib',
        packages: [
          { id: 'h1000', name: 'H1000', price: 24, sla: '3–4 days', summary: '~1,000 words · human', features: ['Human-written ~1,000-word article + images', 'E-E-A-T — real expertise & cited sources', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'h2000', name: 'H2000', price: 39, popular: true, sla: '~4 days', summary: '~2,000 words · in-depth', features: ['In-depth ~2,000-word human article + images', 'Deep E-E-A-T, expert sourcing & references', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'h3000', name: 'H3000', price: 56, sla: '~5 days', summary: '~3,000 words · pillar', features: ['Pillar-length ~3,000-word human article + images', 'Deepest E-E-A-T & topical authority', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
        ],
      },
    ],
    bulk: { unit: 'article', unitPlural: 'articles', countNoun: 'keyword', minDiscountQty: 10, discountPct: 10, defaultQty: 10, sampleUrl: 'https://docs.google.com/spreadsheets/d/1HevaSEO-sample-keyword-sheet/edit?usp=sharing' },
    fields: [
      { label: 'Tone / brand voice', name: 'tone', colSpan: 1, icon: 'ph-microphone-stage', placeholder: 'e.g. friendly expert, formal, playful' },
      { label: 'Language', name: 'language', colSpan: 1, placeholder: 'e.g. English (US)' },
      { label: 'Style & guidelines for the batch', name: 'guidelines', as: 'textarea', colSpan: 2, placeholder: "Anything that applies to every article — angle, do's & don'ts, examples, audience." },
    ],
    addons: ['keyword', 'backlinks', 'optimization'],
    faqs: [
      { q: 'How does pricing work?', a: 'You pick the article type/length (a per-article price), then your keyword list sets the quantity — one article per keyword. 10+ articles get a 10% bulk discount automatically.' },
      { q: 'AI or human — which should I pick?', a: 'AI-powered is fast and cost-efficient for established sites. Human-written gives the deepest E-E-A-T for new or YMYL sites.' },
      { q: 'Can I send a Google Sheet?', a: "Yes — paste your list, upload an .xlsx/.csv, or share a Sheet link (give us access). We'll confirm the exact count before charging." },
    ],
  },

  keyword: {
    key: 'keyword',
    name: 'Keyword Research',
    tagline: 'Know exactly which keywords to target — and where you stand vs competitors — before you spend on SEO.',
    icon: 'ph-tree-structure',
    orderTitle: 'Keyword research',
    orderCode: 'KW',
    hero: 'We map the keyword clusters that convert for your niche, with search volume, difficulty and intent — plus a competitor comparison and a strategy roadmap so you know exactly where to focus.',
    included: [
      { icon: 'ph-tree-structure', title: 'Keyword clusters', desc: 'Grouped by topic, with volume & difficulty.' },
      { icon: 'ph-target', title: 'Search intent', desc: 'Informational, commercial, transactional.' },
      { icon: 'ph-chart-bar', title: 'Competitor compare', desc: 'Spider chart + gap analysis.' },
      { icon: 'ph-map-trifold', title: 'SEO roadmap', desc: 'A prioritized plan (Pro: 3–6 months).' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a plan and tell us about your site.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'A specialist confirms the niche within 24h.' },
      { icon: 'ph-magnifying-glass', title: 'We research', desc: 'Clusters, competitors, intent & strategy.' },
      { icon: 'ph-file-text', title: 'You receive', desc: 'A report dashboard + downloadable sheet.' },
    ],
    packages: [
      { id: 'basic', name: 'Basic', price: 19, sla: '5 days', summary: 'For small or new sites', features: ['1 core keyword cluster', '~50 keywords', 'Search volume + difficulty'] },
      { id: 'standard', name: 'Standard', price: 39, popular: true, sla: '4 days', summary: 'The right fit for most businesses', features: ['3–5 clusters · ~150 keywords', 'Volume + difficulty + search intent', 'Compare 3 competitors (spider chart)', 'SEO strategy suggestions'] },
      { id: 'pro', name: 'Pro', price: 79, sla: '3 days', summary: 'For large or in-depth sites', features: ['Unlimited clusters · ~300+ keywords', 'SWOT + 5-competitor benchmark', '3–6 month SEO roadmap', 'Priority — skips the extra questions'] },
    ],
    fields: [
      { label: 'Website URL', name: 'website', type: 'url', colSpan: 2, placeholder: 'https://yoursite.com (optional — we can research by topic)' },
      { label: 'What does your site offer?', name: 'offering', as: 'textarea', required: true, colSpan: 2, placeholder: 'Products, services or topics you want to be found for — and who your ideal customer is.' },
      { label: 'Target market / language', name: 'market', placeholder: 'e.g. United States · English' },
      { label: 'Primary goal', name: 'goal', as: 'select', options: [
        { value: '', label: 'Select a goal…' },
        { value: 'traffic', label: 'Grow organic traffic' },
        { value: 'leads', label: 'Generate leads / sales' },
        { value: 'compete', label: 'Outrank specific competitors' },
      ] },
      { label: 'Known competitors', name: 'competitors', as: 'textarea', colSpan: 2, placeholder: 'competitor-one.com\ncompetitor-two.com' },
    ],
    addons: ['content', 'backlinks', 'optimization'],
    faqs: [
      { q: 'How long does it take?', a: 'Basic ~5 days, Standard ~4 days, Pro ~3 days with priority.' },
      { q: 'Do I get content suggestions?', a: 'Yes — clusters come topic-ready, and you can add the Content add-on to write them.' },
    ],
  },

  optimize: {
    key: 'optimize',
    name: 'Website Optimization',
    tagline: 'Faster, cleaner and AI-ready (GEO) — measured before/after, with the new build deployed for you.',
    icon: 'ph-gauge',
    orderTitle: 'Website optimization',
    orderCode: 'OP',
    hero: 'We optimize speed, on-page SEO, Core Web Vitals and AI-readiness (GEO), measured before/after and deployed for you. Every plan includes a full audit; we always back up before any change.',
    included: [
      { icon: 'ph-lightning', title: 'Speed', desc: 'Compression, caching, minify, lazy-load.' },
      { icon: 'ph-gauge', title: 'Core Web Vitals', desc: 'LCP / INP / CLS into the green.' },
      { icon: 'ph-sparkle', title: 'AI-ready (GEO)', desc: 'Structured, entity-optimized for AI search.' },
      { icon: 'ph-cloud-arrow-up', title: 'Backup + deploy', desc: 'Source backup, then deploy the new build.' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a plan and the project.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'We assess the site + request access.' },
      { icon: 'ph-wrench', title: 'We optimize', desc: 'Backup → optimize speed/SEO/GEO.' },
      { icon: 'ph-rocket-launch', title: 'We deploy', desc: 'Before/after report + the new build live.' },
    ],
    packages: [
      { id: 'basic', name: 'Basic', price: 40, sla: '~3–5 days', summary: 'Make a slow site fast', features: ['Full website audit', 'Speed — compression, caching, minify, lazy-load', 'Mobile & responsive fixes', 'Source backup + deploy + before/after report'] },
      { id: 'standard', name: 'Standard', price: 79, popular: true, sla: '~5–7 days', summary: 'Fast, clean & AI-ready', features: ['Everything in Basic', 'On-page SEO + schema markup', 'Core Web Vitals into the green', 'AI-ready / GEO optimization', '1 month of support'] },
      { id: 'ultra', name: 'Ultra', price: 0, priceLabel: 'Consult', sla: '~7–10 days', summary: 'Deep technical + advanced GEO', features: ['Everything in Standard', 'Deep technical SEO', 'JS / render optimization', 'Internal linking architecture', 'Advanced GEO + 3 months support'] },
      { id: 'custom', name: 'Custom', price: 0, priceLabel: 'Consult', sla: 'By scope', summary: 'Large or complex sites', features: ['Tailored to your codebase & scale', 'Large catalogs, headless & webapps', 'Phased rollout & staging', 'Dedicated specialist · SLA by agreement'] },
    ],
    fields: [
      { label: 'Website URL', name: 'website', type: 'url', required: true, colSpan: 2, placeholder: 'https://yoursite.com' },
      { label: 'Platform / CMS', name: 'platform', placeholder: 'WordPress, Shopify, custom, headless…' },
      { label: 'Can you grant source / hosting access?', name: 'access', as: 'select', options: [
        { value: '', label: 'Select…' },
        { value: 'after', label: "I'll grant access after we confirm" },
        { value: 'guidance', label: 'Need guidance on access' },
      ] },
      { label: 'What do you most want to improve?', name: 'improve', as: 'textarea', required: true, colSpan: 2, placeholder: 'Page speed, Core Web Vitals, on-page SEO, AI-readiness (GEO)…' },
    ],
    addons: ['audit', 'content', 'backlinks'],
    faqs: [
      { q: 'Could you break my site?', a: 'No — we back up the source before any change and deploy to staging first when needed.' },
      { q: 'What is AI-ready / GEO?', a: 'Structured, entity-optimized content so AI search & generative engines can cite your site.' },
    ],
  },

  design: {
    key: 'design',
    name: 'SEO Web Design',
    tagline: 'Send your idea → get a web draft in 2 days → confirm the full build. Built to rank from day one.',
    icon: 'ph-palette',
    orderTitle: 'Website design',
    orderCode: 'WD',
    hero: 'Pick a site type and brief us — you get a draft in 2 days plus a full-site quote. Every build is fast, mobile-first, on-page clean and schema-ready so it can rank from launch.',
    included: [
      { icon: 'ph-browsers', title: 'SEO-ready build', desc: 'Fast, mobile-first, clean on-page + schema.' },
      { icon: 'ph-clock-countdown', title: 'Draft in 2 days', desc: 'See a draft to your idea, then quote the full site.' },
      { icon: 'ph-arrows-clockwise', title: 'Revisions by plan', desc: 'Each plan includes a set number of revisions.' },
      { icon: 'ph-link', title: 'Yours to keep', desc: 'Source + domain guidance; optional managed hosting.' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Pick a type and describe your business.' },
      { icon: 'ph-clock-countdown', title: 'Draft in 2 days', desc: 'A draft + full-site quote per your plan.' },
      { icon: 'ph-hammer', title: 'We build', desc: 'Build + revisions to the agreed scope.' },
      { icon: 'ph-rocket-launch', title: 'We deliver', desc: 'Finished site + audit metrics + domain guide.' },
    ],
    packages: [
      { id: 'landing', name: 'Landing page', price: 79, priceLabel: 'from $79', sla: '~1 week · draft in 2 days', summary: 'A single high-converting page', features: ['1 page', 'Responsive · on-page SEO', 'Basic speed optimization', 'Draft in 2 days, then a full quote'] },
      { id: 'statistic', name: 'Statistic web', price: 119, priceLabel: 'from $119', sla: '~1–2 weeks', summary: 'A brochure / company site', features: ['5–7 pages', 'Responsive · on-page SEO', 'Schema & sitemap', 'Standard speed optimization'] },
      { id: 'blog', name: 'Blog', price: 159, priceLabel: 'from $159', sla: '~2 weeks', summary: 'A content-first site', features: ['5–7+ pages', 'Blog / CMS included', 'Schema & sitemap', 'Standard speed optimization'] },
      { id: 'ecommerce', name: 'E-commerce', price: 279, priceLabel: 'from $279', popular: true, sla: '~3–4 weeks', summary: 'A store built to sell', features: ['Unlimited pages', 'Sales / cart module', 'Advanced speed optimization', '3 months post-handover support'] },
      { id: 'webapp', name: 'Webapp', price: 0, priceLabel: 'Custom quote', sla: 'By scope', summary: 'App logic & integrations', features: ['Custom features / CRO', 'App logic & integrations', '6 months support', 'Scoped & quoted to your needs'] },
    ],
    fields: [
      { label: 'Existing website / domain', name: 'website', type: 'url', placeholder: 'https://yoursite.com (optional)' },
      { label: 'Google Maps listing', name: 'maps', type: 'url', placeholder: 'Maps link — pulls info + photos' },
      { label: 'Tell us about your business', name: 'business', as: 'textarea', required: true, colSpan: 2, placeholder: 'What you do, who you serve, and the goal for the site.' },
      { label: 'Reference sites you like', name: 'refs', as: 'textarea', colSpan: 2, placeholder: 'Competitors or sites you admire — one URL per line.' },
      { label: 'Brand colors / fonts', name: 'brand', placeholder: 'e.g. navy + gold, modern sans' },
      { label: 'Logo & image links', name: 'assets', placeholder: 'Drive / Figma link to logo & photos' },
    ],
    addons: ['keyword', 'content', 'backlinks'],
    faqs: [
      { q: 'How many revisions?', a: 'Each plan includes a set number; extra rounds are billed. We confirm the count in the quote.' },
      { q: 'Do I keep the source & domain?', a: 'Yes — the source and domain are yours. We can also host & maintain for a fee.' },
    ],
  },

  indexer: {
    key: 'indexer',
    name: 'Backlink Indexer',
    tagline: "Push the backlinks you built into Google's index — pay per link, cheaper at volume.",
    icon: 'ph-magnifying-glass',
    orderTitle: 'Backlink indexing',
    orderCode: 'IDX',
    hero: "Submit your backlink URLs and we push them into Google's index, with a per-link status report and a plugin to verify it yourself. Pay per link — from $0.008, dropping to $0.004 at volume. Already free with every Backlink package.",
    included: [
      { icon: 'ph-list-checks', title: 'Per-link status', desc: 'A report showing what indexed and what is pending.' },
      { icon: 'ph-coins', title: 'Pay per link', desc: 'From $0.008/link, cheaper at volume — no minimum.' },
      { icon: 'ph-puzzle-piece', title: 'Verify yourself', desc: 'An index-check plugin to confirm on demand.' },
      { icon: 'ph-gift', title: 'Free with backlinks', desc: 'Standalone here is for links built elsewhere.' },
    ],
    steps: [
      { icon: 'ph-paper-plane-tilt', title: 'You submit', desc: 'Paste, upload or link your backlink URLs.' },
      { icon: 'ph-chats-circle', title: 'We confirm', desc: 'We confirm the count & rate within 24h.' },
      { icon: 'ph-magnifying-glass', title: 'We index', desc: 'Each URL pushed into Google, with retries.' },
      { icon: 'ph-list-checks', title: 'You receive', desc: 'A per-link index-status report.' },
    ],
    usage: {
      unit: 'link', unitPlural: 'links', countNoun: 'URL', defaultQty: 1000,
      sampleUrl: 'https://docs.google.com/spreadsheets/d/1HevaSEO-sample-links/edit?usp=sharing',
      tiers: [
        { min: 0, rate: 0.008, label: 'Default', sub: '1 – 5,000 links' },
        { min: 5001, rate: 0.006, label: 'Over 5,000 links', sub: 'Save 25%' },
        { min: 20001, rate: 0.004, label: 'Over 20,000 links', sub: 'Save 50% — best value' },
      ],
    },
    fields: [
      { label: 'Anything we should know?', name: 'notes', as: 'textarea', colSpan: 2, placeholder: 'e.g. where the links came from, priority URLs, re-index requests.' },
    ],
    faqs: [
      { q: 'How is pricing calculated?', a: 'Per link, cheaper at volume: $0.008 by default, $0.006 over 5,000, $0.004 over 20,000. No packages, no minimum.' },
      { q: 'Is it free with backlinks?', a: 'Yes — every Backlink package includes indexing free. This standalone is for links built elsewhere.' },
    ],
  },
};

export const getCatalog = (key: string): SvcCatalog | undefined =>
  SERVICE_CATALOG[key as ServiceKey];
