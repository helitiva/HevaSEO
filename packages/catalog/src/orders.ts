/**
 * Single source of truth for the quick-order flow (`/order/<slug>`).
 *
 * Every service shares the same order *format* (see components/order/OrderShell.astro);
 * only the package list and the service-specific brief fields differ. To add a service,
 * append an entry here and create `src/pages/order/<slug>.astro` that passes its own
 * brief fields into the `brief` slot.
 */

import type { Hue } from './index';
import { resolveAddOns } from './index';

// Upsells live alongside in this same shared catalog so marketing + dashboard stay in sync.
export type { AddOn, AddOnTier } from './index';

export type PricingMode = 'fixed' | 'usage';

export interface OrderPackage {
  id: string;            // url-safe, used by ?plan= deep-link, e.g. 'standard'
  name: string;          // 'Standard'
  icon: string;          // phosphor icon for the gradient header tile, e.g. 'ph-star'
  hue: Hue;              // gradient-card hue (sky | violet | amber | emerald | rose)
  price: number;         // USD; 0 when priceLabel carries a "from"/"consult" label
  priceLabel?: string;   // overrides the rendered price, e.g. 'from $120'
  sla: string;           // delivery estimate, e.g. '4 days'
  popular?: boolean;     // pre-selected + badged
  summary: string;       // who it's for
  features: string[];    // what's included (shown in card + order summary)
}

export interface OrderStepPoint {
  icon: string;          // phosphor icon for the bullet
  text: string;          // supports inline <b> via set:html
}
export interface OrderStep {
  icon: string;          // phosphor icon, e.g. 'ph-cursor-click'
  title: string;
  desc: string;
  points?: OrderStepPoint[];  // richer detail bullets shown under the description
}

/** A form-field definition — drives the service brief (Step 2) and add-on extra fields alike. */
export interface FieldDef {
  label: string;
  name: string;          // namespaced when on a bump, e.g. 'backlink_target'
  as?: 'input' | 'textarea' | 'select' | 'keyword-rows';
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  rows?: number;
  icon?: string;
  colSpan?: 1 | 2;
  autocomplete?: string;
  inputmode?: string;
  options?: { value: string; label: string }[];
}

/** Bulk-quantity ordering: the selected package price is a per-unit price multiplied by a count. */
export interface BulkConfig {
  unit: string;          // 'article'
  unitPlural: string;    // 'articles'
  countNoun: string;     // 'keyword'
  minDiscountQty: number;// qty at/above which the bulk discount applies
  discountPct: number;   // e.g. 10
  defaultQty: number;    // starting count for the upload/sheet method
  sampleUrl?: string;    // link to a pre-formatted sample Google Sheet
}

/** Usage-based pricing: count a submitted list, apply a volume rate (highest matching tier). */
export interface UsageTier {
  min: number;           // applies when count >= min; the highest matching tier wins
  rate: number;          // price per unit
  label: string;         // 'Default'
  sub?: string;          // '1 – 5,000 links'
}
export interface UsageConfig {
  unit: string;          // 'link'
  unitPlural: string;    // 'links'
  countNoun: string;     // 'URL'
  tiers: UsageTier[];    // ascending by min
  defaultQty: number;    // starting count for upload/sheet
  sampleUrl?: string;    // pre-formatted sample sheet
}

/** A titled set of packages (for services whose plans split into types, e.g. backlink). */
export interface PackageGroup {
  id: string;
  title: string;         // 'Entity backlinks'
  subtitle?: string;     // one-line description of the type
  icon?: string;         // phosphor icon
  cols?: 1 | 2 | 3 | 4 | 5; // overrides the auto column count
  packages: OrderPackage[];
}

export interface OrderService {
  slug: string;          // route segment, e.g. 'keyword-research'
  name: string;          // 'Keyword Research'
  tagline: string;       // one-line value prop under the title
  icon: string;          // phosphor icon for the header tile
  servicePath: string;   // back-link to the marketing page, e.g. '/keyword-strategy'
  pricingMode: PricingMode;
  packages?: OrderPackage[];        // flat list — use this OR packageGroups
  packageGroups?: PackageGroup[];   // grouped plans (single selection across all groups)
  brief?: FieldDef[];    // Step-2 brief fields (service-specific); reused via the shared shell
  steps?: OrderStep[];   // "what happens next" row; falls back to DEFAULT_STEPS
  addons?: string[];     // checkout upsells — ids into the shared @heva/catalog ADDONS
  bulk?: BulkConfig;     // when set, the picker price is per-unit × a keyword-list count
  usage?: UsageConfig;   // when set (pricingMode 'usage'), price = tiered rate × submitted-list count
  submitLabel?: string;  // summary button text; defaults to 'Place order'
  metaTitle?: string;    // <title>; defaults to `Order ${name} — HevaSEO`
  metaDescription?: string;
}

/** Generic "what happens next" steps — shared by every service unless it overrides `steps`. */
export const DEFAULT_STEPS: OrderStep[] = [
  {
    icon: 'ph-paper-plane-tilt',
    title: 'You submit',
    desc: 'Pick a plan and tell us about your site.',
    points: [
      { icon: 'ph-credit-card', text: '<b>No payment yet</b> — nothing is charged at this step' },
      { icon: 'ph-user-circle-dashed', text: 'No account needed — just your email' },
    ],
  },
  {
    icon: 'ph-chats-circle',
    title: 'We confirm in 24h',
    desc: 'A specialist confirms the scope and final price.',
    points: [
      { icon: 'ph-envelope-simple', text: 'A <b>confirmation email</b> lands in your inbox' },
      { icon: 'ph-identification-badge', text: '<b>Dashboard login</b> to track progress in real time' },
    ],
  },
  {
    icon: 'ph-package',
    title: 'Delivered — two ways',
    desc: 'Receive your report whichever way suits you.',
    points: [
      { icon: 'ph-gauge', text: 'Log in to your <b>dashboard</b> to view results live' },
      { icon: 'ph-link-simple', text: 'Or open the <b>report URL</b> + download the attached file' },
    ],
  },
];

export const orderServices: Record<string, OrderService> = {
  'keyword-research': {
    slug: 'keyword-research',
    name: 'Keyword Research',
    tagline: 'Know exactly which keywords to target — and where you stand against competitors — before you spend a dollar on SEO.',
    icon: 'ph-target',
    servicePath: '/keyword-strategy',
    pricingMode: 'fixed',
    metaTitle: 'Order Keyword Research — HevaSEO',
    metaDescription: 'Order an SEO keyword research package: keyword clusters, search volume & difficulty, competitor comparison and a strategy roadmap. Pick a plan and brief us — no charge until you approve the scope.',
    brief: [
      { label: 'Website URL', name: 'website', type: 'url', required: true, icon: 'ph-globe', placeholder: 'https://yoursite.com', hint: "The site you want to rank. New site? Paste a draft or competitor URL." },
      { label: 'What does your site offer?', name: 'offering', as: 'textarea', required: true, rows: 4, placeholder: 'Products, services or topics you want to be found for — and who your ideal customer is.', hint: 'The more context you give, the sharper the keyword clusters.' },
      { label: 'Target market / language', name: 'market', colSpan: 1, icon: 'ph-map-pin', placeholder: 'e.g. United States · English' },
      { label: 'Primary goal', name: 'goal', as: 'select', colSpan: 1, options: [
        { value: '', label: 'Select a goal…' },
        { value: 'traffic', label: 'Grow organic traffic' },
        { value: 'leads', label: 'Generate leads / sales' },
        { value: 'launch', label: 'Plan content for a new site' },
        { value: 'compete', label: 'Outrank specific competitors' },
      ] },
      { label: 'Known competitors', name: 'competitors', as: 'textarea', rows: 3, placeholder: 'competitor-one.com\ncompetitor-two.com', hint: "One URL per line. Optional — we'll find them if you're not sure." },
    ],
    packages: [
      {
        id: 'basic',
        name: 'Basic',
        icon: 'ph-magnifying-glass',
        hue: 'sky',
        price: 19,
        sla: '5 days',
        summary: 'For small or new sites',
        features: [
          '1 core keyword cluster',
          '~50 keywords',
          'Search volume + difficulty',
        ],
      },
      {
        id: 'standard',
        name: 'Standard',
        icon: 'ph-star',
        hue: 'violet',
        price: 39,
        sla: '4 days',
        popular: true,
        summary: 'The right fit for most businesses',
        features: [
          '3–5 keyword clusters',
          '~150 keywords',
          'Volume + difficulty + search intent',
          'Compare 3 competitors (spider chart)',
          'SEO strategy suggestions',
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        icon: 'ph-crown',
        hue: 'amber',
        price: 79,
        sla: '3 days',
        summary: 'For large or in-depth sites',
        features: [
          'Unlimited clusters',
          '~300+ keywords',
          'Volume + difficulty + search intent',
          'SWOT + 5-competitor benchmark',
          '3–6 month SEO roadmap',
          'Priority — skips the extra questions',
        ],
      },
    ],
    addons: ['content', 'backlinks', 'optimization'],
  },

  audit: {
    slug: 'audit',
    name: 'Website Audit',
    tagline: "A full map of what's holding your site back — every issue ranked by priority, with exactly how to fix it.",
    icon: 'ph-magnifying-glass',
    servicePath: '/audit',
    pricingMode: 'fixed',
    metaTitle: 'Order a Website SEO Audit — HevaSEO',
    metaDescription: 'Order an SEO audit: technical, on-page, content, schema, Core Web Vitals and index coverage — scored and prioritised, delivered as a dashboard report plus a downloadable PDF. No charge until you approve the scope.',
    brief: [
      { label: 'Website URL', name: 'website', type: 'url', required: true, icon: 'ph-globe', placeholder: 'https://yoursite.com', hint: 'The site you want audited.' },
      { label: 'What should the audit focus on?', name: 'focus', as: 'textarea', required: true, rows: 3, placeholder: 'Rankings, page speed, a recent traffic drop, a migration, AI visibility…', hint: "Tell us what's worrying you — we'll still check everything, but we'll lead with this." },
      { label: 'Target market / language', name: 'market', colSpan: 1, icon: 'ph-map-pin', placeholder: 'e.g. United States · English' },
      { label: 'Share GSC / Analytics access?', name: 'access', as: 'select', colSpan: 1, hint: 'Optional — lets us go deeper (great for Pro).', options: [
        { value: '', label: 'Select…' },
        { value: 'after', label: "I'll share after we confirm" },
        { value: 'no', label: 'Not now — audit from the outside' },
      ] },
      { label: 'Competitors to benchmark against', name: 'competitors', as: 'textarea', rows: 2, placeholder: 'competitor-one.com\ncompetitor-two.com', hint: "Optional — one per line. We'll find them if you're not sure." },
    ],
    packages: [
      {
        id: 'basic',
        name: 'Basic',
        icon: 'ph-gauge',
        hue: 'sky',
        price: 19,
        sla: '~2 days',
        summary: "A quick snapshot of your site's SEO health",
        features: [
          'Technical SEO & basic on-page audit',
          'Index coverage check',
          'Overall SEO Health Score',
          'Dashboard report + downloadable PDF, issues by priority',
        ],
      },
      {
        id: 'standard',
        name: 'Standard',
        icon: 'ph-magnifying-glass-plus',
        hue: 'violet',
        price: 39,
        sla: '~2–3 days',
        popular: true,
        summary: 'A deeper audit of content, schema & Core Web Vitals',
        features: [
          'Everything in Basic, plus:',
          'Content & on-page audit',
          'Schema / structured data check',
          'Core Web Vitals (LCP / INP / CLS)',
          'A detailed, prioritized fix roadmap',
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        icon: 'ph-crown',
        hue: 'amber',
        price: 69,
        sla: '~3–4 days',
        summary: 'A full audit before a major SEO campaign',
        features: [
          'Everything in Standard, plus:',
          'Deep Core Web Vitals analysis',
          'Backlink profile + toxic backlink analysis',
          'Competitor benchmark + content gap',
          'Prioritized fix list with impact estimate',
          'Optional GSC / Analytics access',
        ],
      },
    ],
    addons: ['optimization', 'keyword', 'content'],
  },

  'website-optimization': {
    slug: 'website-optimization',
    name: 'Website Optimization',
    tagline: 'Faster, cleaner and AI-ready (GEO) — measured before/after, with the new build deployed for you. Every plan includes a full website audit.',
    icon: 'ph-gauge',
    servicePath: '/website-optimization',
    pricingMode: 'fixed',
    metaTitle: 'Order Website Optimization — HevaSEO',
    metaDescription: 'Order a website optimization package: speed, on-page SEO, schema, Core Web Vitals and AI-readiness (GEO), measured before/after and deployed for you. Every plan includes a full audit. No charge until you approve the scope.',
    brief: [
      { label: 'Website URL', name: 'website', type: 'url', required: true, icon: 'ph-globe', placeholder: 'https://yoursite.com', hint: 'The site you want optimized.' },
      { label: 'Platform / CMS', name: 'platform', colSpan: 1, icon: 'ph-stack', placeholder: 'WordPress, Shopify, custom, headless…' },
      { label: 'Can you grant source / hosting access?', name: 'access', as: 'select', colSpan: 1, hint: 'We always back up before any change.', options: [
        { value: '', label: 'Select…' },
        { value: 'after', label: "I'll grant access after we confirm" },
        { value: 'guidance', label: 'Need guidance on access' },
      ] },
      { label: 'What do you most want to improve?', name: 'improve', as: 'textarea', required: true, rows: 3, placeholder: 'Page speed, Core Web Vitals, on-page SEO, AI-readiness (GEO)…', hint: "Tell us the priority — we'll confirm the plan against a quick audit." },
    ],
    packages: [
      {
        id: 'basic',
        name: 'Basic',
        icon: 'ph-lightning',
        hue: 'sky',
        price: 40,
        sla: '~3–5 days',
        summary: 'Make a slow site fast',
        features: [
          'Full website audit',
          'Speed — compression, caching, minify, lazy-load',
          'Mobile & responsive fixes',
          'Source backup + deploy',
          'Before/after report',
        ],
      },
      {
        id: 'standard',
        name: 'Standard',
        icon: 'ph-sparkle',
        hue: 'violet',
        price: 79,
        sla: '~5–7 days',
        popular: true,
        summary: 'Fast, clean & AI-ready',
        features: [
          'Everything in Basic, plus:',
          'On-page SEO + schema markup',
          'Core Web Vitals into the green',
          'AI-ready / GEO — structured, entity optimization',
          '1 month of support',
        ],
      },
      {
        id: 'ultra',
        name: 'Ultra',
        icon: 'ph-crown',
        hue: 'amber',
        price: 0,
        priceLabel: 'Consult',
        sla: '~7–10 days',
        summary: 'Deep technical + advanced GEO',
        features: [
          'Everything in Standard, plus:',
          'Deep technical SEO',
          'JavaScript / render optimization',
          'Internal linking architecture',
          'Advanced GEO + 3 months support',
        ],
      },
      {
        id: 'custom',
        name: 'Custom',
        icon: 'ph-sliders-horizontal',
        hue: 'emerald',
        price: 0,
        priceLabel: 'Consult',
        sla: 'By scope',
        summary: 'Large or complex sites',
        features: [
          'Tailored to your codebase & scale',
          'Large catalogs, headless & webapps',
          'Phased rollout & staging',
          'Dedicated specialist',
          'SLA & support by agreement',
        ],
      },
    ],
    addons: ['audit', 'content', 'backlinks'],
  },

  'seo-web-design': {
    slug: 'seo-web-design',
    name: 'SEO Web Design',
    tagline: 'Send your idea (text, images or AI chat) → get a web draft in 2 days → confirm the full build. Every site is built to rank from day one.',
    icon: 'ph-browsers',
    servicePath: '/seo-web-design',
    pricingMode: 'fixed',
    submitLabel: 'Request draft & quote',
    metaTitle: 'Order an SEO-Ready Website — HevaSEO',
    metaDescription: 'Order an SEO web design build: fast loads, green Core Web Vitals, clean on-page and schema, mobile-first. Pick a type, brief us, and get a draft in 2 days plus a full-site quote. No charge until you approve.',
    brief: [
      { label: 'Existing website / domain', name: 'website', type: 'url', colSpan: 1, icon: 'ph-globe', placeholder: 'https://yoursite.com (optional)' },
      { label: 'Google Maps listing', name: 'maps', type: 'url', colSpan: 1, icon: 'ph-map-pin', placeholder: 'Maps link — pulls info + photos' },
      { label: 'Tell us about your business', name: 'business', as: 'textarea', required: true, rows: 3, placeholder: 'What you do, who you serve, and the goal for the site.', hint: 'The clearer this is, the closer the 2-day draft will be.' },
      { label: 'Reference sites you like', name: 'refs', as: 'textarea', rows: 2, placeholder: 'Competitors or sites you admire — one URL per line.' },
      { label: 'Brand colors / fonts', name: 'brand', colSpan: 1, icon: 'ph-palette', placeholder: 'e.g. navy + gold, modern sans' },
      { label: 'Logo & image links', name: 'assets', colSpan: 1, icon: 'ph-image', placeholder: 'Drive / Figma link to logo & photos' },
    ],
    packages: [
      {
        id: 'landing',
        name: 'Landing page',
        icon: 'ph-cursor-click',
        hue: 'sky',
        price: 0,
        priceLabel: 'from $79',
        sla: '~1 week · draft in 2 days',
        summary: 'A single high-converting page',
        features: ['1 page', 'Responsive · on-page SEO', 'Basic speed optimization', 'Draft in 2 days, then a full quote'],
      },
      {
        id: 'statistic',
        name: 'Statistic web',
        icon: 'ph-chart-bar',
        hue: 'violet',
        price: 0,
        priceLabel: 'from $119',
        sla: '~1–2 weeks',
        summary: 'A brochure / company site',
        features: ['5–7 pages', 'Responsive · on-page SEO', 'Schema & sitemap', 'Standard speed optimization'],
      },
      {
        id: 'blog',
        name: 'Blog',
        icon: 'ph-article',
        hue: 'amber',
        price: 0,
        priceLabel: 'from $159',
        sla: '~2 weeks',
        summary: 'A content-first site',
        features: ['5–7+ pages', 'Blog / CMS included', 'Schema & sitemap', 'Standard speed optimization'],
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        icon: 'ph-shopping-cart',
        hue: 'emerald',
        price: 0,
        priceLabel: 'from $279',
        sla: '~3–4 weeks',
        popular: true,
        summary: 'A store built to sell',
        features: ['Unlimited pages', 'Sales / cart module', 'Advanced speed optimization', '3 months post-handover support'],
      },
      {
        id: 'webapp',
        name: 'Webapp',
        icon: 'ph-app-window',
        hue: 'rose',
        price: 0,
        priceLabel: 'Custom quote',
        sla: 'By scope',
        summary: 'App logic & integrations',
        features: ['Custom features / CRO', 'App logic & integrations', '6 months support', 'Scoped & quoted to your needs'],
      },
    ],
    addons: ['keyword', 'content', 'backlinks'],
  },

  backlink: {
    slug: 'backlink',
    name: 'Backlinks',
    tagline: 'Build authority with safe, white-hat links — every package includes our Indexer free, with a live per-link report and index %.',
    icon: 'ph-share-network',
    servicePath: '/backlink',
    pricingMode: 'fixed',
    metaTitle: 'Order Backlinks — HevaSEO',
    metaDescription: 'Order backlinks — Entity, Pyramid, Guest Post or PR. Safe, white-hat links with the Indexer included free, a live per-link report and index %. Pick a type and tier, brief us — no charge until you approve.',
    brief: [
      { label: 'Your website / brand', name: 'website', type: 'url', required: true, icon: 'ph-globe', placeholder: 'https://yoursite.com' },
      { label: 'Target URL(s) to boost', name: 'targets', as: 'textarea', rows: 2, placeholder: 'https://yoursite.com/page', hint: 'One per line — the pages you want to rank. Entity? Your homepage is fine.' },
      { label: 'Preferred anchors / keywords', name: 'anchors', as: 'textarea', rows: 2, placeholder: 'brand name, primary keyword, naked URL', hint: "We'll keep a safe, natural anchor ratio." },
      { label: 'Niche / industry', name: 'niche', colSpan: 1, icon: 'ph-tag', placeholder: 'e.g. SaaS, dental, fashion' },
      { label: 'Language / market', name: 'market', colSpan: 1, icon: 'ph-map-pin', placeholder: 'e.g. United States · English' },
    ],
    packageGroups: [
      {
        id: 'entity',
        title: 'Entity',
        subtitle: 'Brand trust — profiles, NAP & citations · index 80–95%',
        icon: 'ph-buildings',
        packages: [
          { id: 'entity-300', name: 'Entity 300', icon: 'ph-buildings', hue: 'sky', price: 52, sla: '7–10 days', summary: '300 authority links', features: ['300 authority links', 'Business profile links', 'NAP citations (name · address · phone)', 'Social profile citations', 'Safe, diversified anchors', '80–95% indexed · live per-link report'] },
          { id: 'entity-500', name: 'Entity 500', icon: 'ph-buildings', hue: 'sky', price: 79, popular: true, sla: '10–14 days', summary: '500 links + directory listings', features: ['500 authority links', 'Profiles · NAP · social citations', 'Trusted directory listings', 'Diversified anchor profile', 'White-hat, Google-safe placements', '80–95% indexed · live report'] },
          { id: 'entity-1000', name: 'Entity 1000', icon: 'ph-buildings', hue: 'sky', price: 139, sla: '14–21 days', summary: '1,000 links + web 2.0', features: ['1,000 authority links', 'Profiles · NAP · social · directory', 'Web 2.0 / extended entity links', 'Widest brand footprint', 'Natural, diversified anchors', '80–95% indexed · live report'] },
        ],
      },
      {
        id: 'pyramid',
        title: 'Pyramid',
        subtitle: 'Funnel power to one URL through tiered links · index ~70%',
        icon: 'ph-stack',
        packages: [
          { id: 'pyramid-starter', name: 'Pyramid Starter', icon: 'ph-stack', hue: 'violet', price: 36, sla: '10 days', summary: 'Tier-1 → Tier-2', features: ['Tier-1 contextual links', 'Tier-2 support layer', 'Power funneled to 1 target URL', 'Safe, white-hat tiers', '~70% indexed · live report'] },
          { id: 'pyramid-growth', name: 'Pyramid Growth', icon: 'ph-stack', hue: 'violet', price: 64, popular: true, sla: '14 days', summary: 'Denser Tier-1', features: ['Denser Tier-1 contextual links', 'Tier-2 support layer', 'Stronger power to your URL', 'Safe anchor distribution', '~70% indexed · live report'] },
          { id: 'pyramid-power', name: 'Pyramid Power', icon: 'ph-stack', hue: 'violet', price: 104, sla: '18 days', summary: '3 tiers (T1–T3)', features: ['3 tiers (T1 → T2 → T3)', 'Deeper power flow', 'Boost a competitive URL / category', 'Safe, white-hat structure', '~70% indexed · live report'] },
          { id: 'pyramid-max', name: 'Pyramid Max', icon: 'ph-stack', hue: 'violet', price: 159, sla: '21 days', summary: 'Full 3 tiers + power', features: ['Full 3 tiers + extra strong links', 'Maximum power funnel', 'For your most competitive targets', 'Advanced Indexer push', '~70%+ indexed · live report'] },
        ],
      },
      {
        id: 'guest',
        title: 'Guest Post',
        subtitle: 'Article written + placed on real blogs · index ~100%',
        icon: 'ph-newspaper-clipping',
        packages: [
          { id: 'guest-3', name: 'Guest 3', icon: 'ph-newspaper-clipping', hue: 'amber', price: 104, sla: '2–3 weeks', summary: 'DR30+ blogs', features: ['3 guest posts on DR30+ blogs', 'SEO article written for each', 'Manual outreach + placement', 'Contextual, in-content links', '~100% indexed · live report'] },
          { id: 'guest-5', name: 'Guest 5', icon: 'ph-newspaper-clipping', hue: 'amber', price: 180, popular: true, sla: '~3 weeks', summary: 'DR40+ blogs', features: ['5 guest posts on DR40+ blogs', 'SEO article written for each', 'Manual outreach + placement', 'Higher-authority, real-traffic sites', '~100% indexed · live report'] },
          { id: 'guest-5-pro', name: 'Guest 5 Pro', icon: 'ph-newspaper-clipping', hue: 'amber', price: 280, sla: '3–4 weeks', summary: 'DR50+ + Pyramid', features: ['5 guest posts on DR50+ blogs', '+ Pyramid boost per post', 'SEO article written for each', 'Premium, high-traffic publications', '~100% indexed · live report'] },
        ],
      },
      {
        id: 'pr',
        title: 'PR — International press',
        subtitle: 'Published on news sites · quoted per outlet · index ~100%',
        icon: 'ph-megaphone',
        packages: [
          { id: 'pr', name: 'PR feature', icon: 'ph-megaphone', hue: 'rose', price: 0, priceLabel: 'from $120', sla: 'By scope', summary: 'International press coverage', features: ['Published on international news sites', 'Sites & cost proposed to your budget & niche', '~100% indexed', 'A link to the published article'] },
        ],
      },
    ],
    addons: ['content', 'keyword', 'optimization'],
  },

  content: {
    slug: 'content',
    name: 'SEO Content Writing',
    tagline: 'Articles built to rank — AI-powered for speed or human-written for deepest E-E-A-T. Every piece ships with a Content Score & Methodology report.',
    icon: 'ph-pen-nib',
    servicePath: '/content',
    pricingMode: 'fixed',
    metaTitle: 'Order SEO Content Writing — HevaSEO',
    metaDescription: 'Order SEO articles in bulk from a keyword list — AI-powered (fast) or human-written (deep E-E-A-T). One article per keyword, paste or upload your list, with a Content Score & Methodology report per piece. No charge until you approve.',
    bulk: { unit: 'article', unitPlural: 'articles', countNoun: 'keyword', minDiscountQty: 10, discountPct: 10, defaultQty: 10, sampleUrl: 'https://docs.google.com/spreadsheets/d/1HevaSEO-sample-keyword-sheet/edit?usp=sharing' },
    brief: [
      { label: 'Website', name: 'website', type: 'url', required: true, icon: 'ph-globe', placeholder: 'https://yoursite.com' },
      { label: 'Tone / brand voice', name: 'tone', colSpan: 1, icon: 'ph-microphone-stage', placeholder: 'e.g. friendly expert, formal, playful' },
      { label: 'Language', name: 'language', colSpan: 1, icon: 'ph-translate', placeholder: 'e.g. English (US)' },
      { label: 'Style & guidelines for the batch', name: 'guidelines', as: 'textarea', rows: 3, placeholder: "Anything that applies to every article — angle, do's & don'ts, examples, audience." },
    ],
    packageGroups: [
      {
        id: 'ai',
        title: 'AI-powered',
        subtitle: 'AI ~70% + human editor · fast & cost-efficient · for established sites',
        icon: 'ph-sparkle',
        packages: [
          { id: 'a1000', name: 'A1000', icon: 'ph-file-text', hue: 'sky', price: 12, sla: '2–3 days', summary: '~1,000 words · standard', features: ['1 SEO article (~1,000 words) + images', 'On-page: title / meta / headings / density / internal links', 'Plagiarism & AI-detection checked', 'HTML preview · DOC · TXT · images', 'Content Score & Methodology report'] },
          { id: 'a2000', name: 'A2000', icon: 'ph-files', hue: 'violet', price: 19, popular: true, sla: '~3 days', summary: '~2,000 words · in-depth', features: ['In-depth 2,000-word article + images', 'Full on-page optimization', 'Internal links + outbound citations', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'a3000', name: 'A3000', icon: 'ph-newspaper-clipping', hue: 'amber', price: 28, sla: '3–4 days', summary: '~3,000 words · pillar', features: ['Pillar-length 3,000-word article + images', 'Full on-page optimization', 'Topic-cluster ready + internal linking', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
        ],
      },
      {
        id: 'human',
        title: 'Human-written',
        subtitle: 'Human 70–80% + AI assist · deepest E-E-A-T · for new / YMYL sites',
        icon: 'ph-pen-nib',
        packages: [
          { id: 'h1000', name: 'H1000', icon: 'ph-file-text', hue: 'sky', price: 24, sla: '3–4 days', summary: '~1,000 words · human', features: ['Human-written SEO article (~1,000 words) + images', 'E-E-A-T — real expertise & cited sources', 'On-page: title / meta / headings / density', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'h2000', name: 'H2000', icon: 'ph-files', hue: 'violet', price: 39, popular: true, sla: '~4 days', summary: '~2,000 words · in-depth', features: ['In-depth 2,000-word human-written article + images', 'Deep E-E-A-T, expert sourcing & references', 'Full on-page optimization + internal links', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
          { id: 'h3000', name: 'H3000', icon: 'ph-newspaper-clipping', hue: 'amber', price: 56, sla: '~5 days', summary: '~3,000 words · pillar', features: ['Pillar-length 3,000-word human-written article + images', 'Deepest E-E-A-T & topical authority', 'Full on-page + internal linking', 'Plagiarism & AI-detection checked', 'Content Score & Methodology report'] },
        ],
      },
    ],
    addons: ['keyword', 'backlinks', 'optimization'],
  },

  indexer: {
    slug: 'indexer',
    name: 'Backlink Indexer',
    tagline: "Push the backlinks you built into Google's index — pay per link, cheaper at volume, with a per-link status report. Already free with every Backlink package.",
    icon: 'ph-list-checks',
    servicePath: '/indexer',
    pricingMode: 'usage',
    submitLabel: 'Submit links & order',
    metaTitle: 'Order Backlink Indexing — HevaSEO',
    metaDescription: 'Order standalone backlink indexing — submit your URLs and we push them into Google\'s index. Pay per link from $0.008, cheaper at volume, with a per-link status report and a plugin to verify. No charge until you approve.',
    usage: {
      unit: 'link',
      unitPlural: 'links',
      countNoun: 'URL',
      defaultQty: 1000,
      sampleUrl: 'https://docs.google.com/spreadsheets/d/1HevaSEO-sample-links/edit?usp=sharing',
      tiers: [
        { min: 0, rate: 0.008, label: 'Default', sub: '1 – 5,000 links' },
        { min: 5001, rate: 0.006, label: 'Over 5,000 links', sub: 'Save 25%' },
        { min: 20001, rate: 0.004, label: 'Over 20,000 links', sub: 'Save 50% — best value' },
      ],
    },
    brief: [
      { label: 'Anything we should know?', name: 'notes', as: 'textarea', rows: 2, colSpan: 2, placeholder: 'e.g. where the links came from, priority URLs, re-index requests.' },
    ],
  },
};

export const getOrderService = (slug: string): OrderService | undefined => orderServices[slug];

// ─── Server-trusted pricing (quick-checkout chốt 1) ──────────────────────────────────────────────
// Mirrors the OrderShell pricing math so the public checkout route handler can re-derive the price from
// the package/qty/add-on selection WITHOUT trusting any client-sent total. Pure + shared, so the price
// the visitor saw on the marketing site and the price the server charges come from one source.
export type QuickOrderSelection = { packageId?: string; qty?: number; addonPicks?: Record<string, string> };
export type QuickOrderPrice = {
  value: number; subtotal: number; bulkDiscount: number; addonsTotal: number;
  hasNumericTotal: boolean; plan?: OrderPackage;
};

export function priceQuickOrder(service: OrderService, sel: QuickOrderSelection): QuickOrderPrice {
  const all = service.packageGroups ? service.packageGroups.flatMap((g) => g.packages) : (service.packages ?? []);
  const plan = all.find((p) => p.id === sel.packageId) ?? all[0];
  const isUsage = service.pricingMode === 'usage' || !!service.usage;
  const qty = sel.qty ?? service.usage?.defaultQty ?? service.bulk?.defaultQty ?? 1;

  let usageRate = 0;
  if (service.usage) {
    usageRate = service.usage.tiers[0]?.rate ?? 0;
    for (const t of service.usage.tiers) if (qty >= t.min) usageRate = t.rate;
  }
  const subtotal = isUsage ? usageRate * qty : service.bulk ? (plan?.price ?? 0) * qty : (plan?.price ?? 0);
  const bulkDiscount = service.bulk && qty >= service.bulk.minDiscountQty
    ? Math.round(subtotal * service.bulk.discountPct) / 100 : 0;

  const picks = sel.addonPicks ?? {};
  const addonsTotal = resolveAddOns(service.addons ?? [])
    .filter((a) => a.id in picks)
    .reduce((s, a) => s + (a.tiers.find((t) => t.id === picks[a.id]) ?? a.tiers[0]).price, 0);

  // a 'consult'/'from' plan (priceLabel, no numeric price) can't be auto-charged at checkout.
  const hasNumericTotal = isUsage || !plan?.priceLabel;
  return { value: subtotal - bulkDiscount + addonsTotal, subtotal, bulkDiscount, addonsTotal, hasNumericTotal, plan };
}
