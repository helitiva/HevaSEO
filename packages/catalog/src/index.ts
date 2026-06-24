/**
 * Shared add-on (upsell) catalog — the SINGLE place to edit cross-sell offers.
 *
 * Both the marketing order pages (apps/web, Astro) and the dashboard order flow
 * (apps/app, Next) read add-ons from here, so editing once updates everywhere.
 * Each add-on can offer one OR several purchasable tiers (gói mua kèm).
 *
 * When a backend lands, swap ADDONS for a DB-backed loader — the consumer shape
 * (AddOn / AddOnTier / FieldDef) stays the same.
 */

export type Hue = 'sky' | 'violet' | 'amber' | 'emerald' | 'rose';

export interface FieldOption {
  value: string;
  label: string;
}

/** A form-field definition for an add-on's extra brief. */
export interface FieldDef {
  label: string;
  name: string;
  as?: 'input' | 'textarea' | 'select' | 'keyword-rows';
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  rows?: number;          // 'keyword-rows': number of article rows
  icon?: string;
  colSpan?: 1 | 2;
  options?: FieldOption[];
}

/** One purchasable package within an add-on. */
export interface AddOnTier {
  id: string;
  name: string;
  price: number;          // USD added to the order
  strike?: number;        // original price (struck through to show the discount)
  summary?: string;
  fields?: FieldDef[];    // extra brief collected when this tier is chosen
}

/** A cross-sell add-on offered as an upsell on other services. */
export interface AddOn {
  id: string;
  name: string;
  headline: string;
  icon: string;           // phosphor icon
  hue?: Hue;
  tiers: AddOnTier[];     // one or more gói
}

// Reused field groups (kept DRY across tiers) -------------------------------

const articleRows = (rows: number): FieldDef[] => [
  { label: 'Articles — one keyword per row', name: 'content_articles', as: 'keyword-rows', rows, colSpan: 2, hint: 'One article per row — add an internal-link target and a reference URL if you have them.' },
  { label: 'Brand voice / tone', name: 'content_tone', colSpan: 2, icon: 'ph-microphone-stage', placeholder: 'e.g. friendly expert, formal, playful' },
];

const keywordFields: FieldDef[] = [
  { label: 'Primary goal', name: 'keyword_goal', as: 'select', colSpan: 1, options: [
    { value: '', label: 'Select a goal…' },
    { value: 'traffic', label: 'Grow organic traffic' },
    { value: 'leads', label: 'Generate leads / sales' },
    { value: 'compete', label: 'Outrank specific competitors' },
  ] },
  { label: 'Target market / language', name: 'keyword_market', colSpan: 1, icon: 'ph-map-pin', placeholder: 'e.g. United States · English' },
];

const backlinkFields: FieldDef[] = [
  { label: 'Target URL to boost', name: 'backlink_target', type: 'url', colSpan: 1, icon: 'ph-link-simple', placeholder: 'https://yoursite.com/page' },
  { label: 'Preferred anchor / keywords', name: 'backlink_anchor', colSpan: 1, icon: 'ph-anchor', placeholder: 'brand name, primary keyword' },
];

const optimizationFields: FieldDef[] = [
  { label: 'Platform / CMS', name: 'optimization_platform', colSpan: 1, icon: 'ph-stack', placeholder: 'WordPress, Shopify, custom…' },
];

const auditFields: FieldDef[] = [
  { label: 'Anything specific to check?', name: 'audit_focus', as: 'textarea', colSpan: 2, placeholder: 'Optional — e.g. a recent traffic drop, a specific page.' },
];

// The canonical add-on catalog --------------------------------------------

export const ADDONS: Record<string, AddOn> = {
  content: {
    id: 'content',
    name: 'SEO articles',
    headline: 'Turn your keywords into ranking articles.',
    icon: 'ph-pen-nib',
    hue: 'violet',
    tiers: [
      { id: 'a3', name: '3 articles', price: 33, strike: 36, summary: '~1,000 words each', fields: articleRows(3) },
      { id: 'a5', name: '5 articles', price: 54, strike: 60, summary: '~1,000 words each', fields: articleRows(5) },
      { id: 'a10', name: '10 articles', price: 99, strike: 120, summary: '~1,000 words each · best value', fields: articleRows(10) },
    ],
  },
  keyword: {
    id: 'keyword',
    name: 'Keyword Research',
    headline: 'Target the right keywords first.',
    icon: 'ph-tree-structure',
    hue: 'sky',
    tiers: [
      { id: 'std', name: 'Standard', price: 33, strike: 39, summary: '3–5 clusters · ~150 keywords', fields: keywordFields },
    ],
  },
  backlinks: {
    id: 'backlinks',
    name: 'Backlink boost',
    headline: 'Build authority to the pages that matter.',
    icon: 'ph-share-network',
    hue: 'emerald',
    tiers: [
      { id: 'pyr-starter', name: 'Pyramid Starter', price: 32, strike: 36, summary: 'Tier-1 → Tier-2', fields: backlinkFields },
      { id: 'pyr-growth', name: 'Pyramid Growth', price: 54, strike: 64, summary: 'Denser Tier-1', fields: backlinkFields },
      { id: 'pyr-power', name: 'Pyramid Power', price: 90, strike: 104, summary: '3 tiers (T1–T3)', fields: backlinkFields },
    ],
  },
  optimization: {
    id: 'optimization',
    name: 'Technical SEO tune-up',
    headline: 'Make sure those pages are fast and convert.',
    icon: 'ph-gauge',
    hue: 'amber',
    tiers: [
      { id: 'std', name: 'Standard', price: 36, strike: 40, summary: 'Speed · on-page fixes', fields: optimizationFields },
    ],
  },
  audit: {
    id: 'audit',
    name: 'Pre-optimization audit',
    headline: 'Audit first so you fix the right things.',
    icon: 'ph-magnifying-glass',
    hue: 'sky',
    tiers: [
      { id: 'quick', name: 'Quick audit', price: 17, strike: 19, summary: 'Health snapshot', fields: auditFields },
    ],
  },
};

export const getAddOn = (id: string): AddOn | undefined => ADDONS[id];

/** Resolve a list of add-on ids to their definitions (skipping unknown ids). */
export const resolveAddOns = (ids: readonly string[]): AddOn[] =>
  ids.map((id) => ADDONS[id]).filter((a): a is AddOn => Boolean(a));
