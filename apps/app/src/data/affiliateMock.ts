// Affiliate (KOL) mock — the ONLY file with concrete data for the /affiliate surface.
// One demo KOL ("Jane Rivera / @janeseo"), the customers she referred, the commission
// those customers' orders generated, her payout history, and the marketing assets she
// can grab. Pure logic (tiers, rollups, links) lives in lib/affiliate.ts.
//
// Money-leak invariant (see lib/affiliate.ts): every number is Jane's OWN commission,
// derived only from her referrals' order volume — never staff pay or platform margin.

import type {
  Referral, CommissionEvent, PayoutRequest, PayoutMethodKind,
} from '@/lib/affiliate';

// ---- The demo affiliate ----
export interface Affiliate {
  name: string;
  handle: string;
  code: string;
  email: string;
  avatarInitials: string;
  platform: string;       // primary platform
  audience: string;       // bucketed audience size
  niche: string;
  joinedAt: string;       // YYYY-MM-DD
  status: 'active';
  payoutKind: PayoutMethodKind;
  payoutLabel: string;    // masked
}

const AFFILIATE: Affiliate = {
  name: 'Jane Rivera',
  handle: '@janeseo',
  code: 'JANESEO',
  email: 'jane@janeseo.com',
  avatarInitials: 'JR',
  platform: 'YouTube',
  audience: '250k–500k',
  niche: 'SEO & Marketing',
  joinedAt: '2025-11-01',
  status: 'active',
  payoutKind: 'paypal',
  payoutLabel: 'PayPal ••jane@…',
};

export const myAffiliate = (): Affiliate => AFFILIATE;

// ---- Referrals (signup metadata) ----
// Aggregate stats (orders / volume / lastOrderAt) are DERIVED from EVENTS below so the
// two can never drift. Only the things events can't tell us are authored here.
interface ReferralMeta {
  id: string;
  customer: string;
  joinedAt: string;
  status: Referral['status'];
}

const REFERRAL_META: ReferralMeta[] = [
  { id: 'r1', customer: 'Acme Digital',   joinedAt: '2025-11-03', status: 'active' },
  { id: 'r2', customer: 'Bolt Media',     joinedAt: '2025-12-10', status: 'active' },
  { id: 'r3', customer: 'Cedar Labs',     joinedAt: '2026-02-02', status: 'active' },
  { id: 'r4', customer: 'Drift Co',       joinedAt: '2026-03-22', status: 'active' },
  { id: 'r5', customer: 'Evergreen SaaS', joinedAt: '2026-04-15', status: 'active' },
  { id: 'r6', customer: 'Forge Studio',   joinedAt: '2026-05-25', status: 'active' },
  { id: 'r7', customer: 'Glint App',      joinedAt: '2026-06-21', status: 'churned' }, // signed up, no order yet
];

// ---- Commission events (the source of truth for orders & volume) ----
// Rate climbs over time as Jane crossed tiers (Bronze 10% → Silver 15% → Gold 20%).
const EVENTS: CommissionEvent[] = [
  { id: 'e01', at: '2025-11-15', referralId: 'r1', customer: 'Acme Digital',   orderCode: 'O-1042', orderValue: 1800, rate: 0.10, amount: 180, status: 'paid' },
  { id: 'e02', at: '2025-12-18', referralId: 'r2', customer: 'Bolt Media',     orderCode: 'O-1071', orderValue: 1500, rate: 0.10, amount: 150, status: 'paid' },
  { id: 'e03', at: '2026-01-20', referralId: 'r1', customer: 'Acme Digital',   orderCode: 'O-1130', orderValue: 2600, rate: 0.15, amount: 390, status: 'paid' },
  { id: 'e04', at: '2026-02-20', referralId: 'r3', customer: 'Cedar Labs',     orderCode: 'O-1180', orderValue: 3400, rate: 0.15, amount: 510, status: 'paid' },
  { id: 'e05', at: '2026-03-14', referralId: 'r2', customer: 'Bolt Media',     orderCode: 'O-1241', orderValue: 2200, rate: 0.15, amount: 330, status: 'paid' },
  { id: 'e06', at: '2026-03-28', referralId: 'r4', customer: 'Drift Co',       orderCode: 'O-1260', orderValue: 1200, rate: 0.15, amount: 180, status: 'paid' },
  { id: 'e07', at: '2026-04-08', referralId: 'r1', customer: 'Acme Digital',   orderCode: 'O-1320', orderValue: 3200, rate: 0.20, amount: 640, status: 'cleared' },
  { id: 'e08', at: '2026-04-19', referralId: 'r5', customer: 'Evergreen SaaS', orderCode: 'O-1338', orderValue: 2100, rate: 0.20, amount: 420, status: 'cleared' },
  { id: 'e09', at: '2026-05-12', referralId: 'r3', customer: 'Cedar Labs',     orderCode: 'O-1390', orderValue: 2800, rate: 0.20, amount: 560, status: 'cleared' },
  { id: 'e10', at: '2026-05-30', referralId: 'r4', customer: 'Drift Co',       orderCode: 'O-1432', orderValue: 2600, rate: 0.20, amount: 520, status: 'cleared' },
  { id: 'e11', at: '2026-06-02', referralId: 'r1', customer: 'Acme Digital',   orderCode: 'O-1455', orderValue: 2400, rate: 0.20, amount: 480, status: 'pending' },
  { id: 'e12', at: '2026-06-10', referralId: 'r6', customer: 'Forge Studio',   orderCode: 'O-1470', orderValue: 4400, rate: 0.20, amount: 880, status: 'pending' },
  { id: 'e13', at: '2026-06-18', referralId: 'r2', customer: 'Bolt Media',     orderCode: 'O-1488', orderValue: 1900, rate: 0.20, amount: 380, status: 'pending' },
];

export const myCommissionEvents = (): CommissionEvent[] =>
  [...EVENTS].sort((a, b) => b.at.localeCompare(a.at));

/** Referrals with order count / volume / last order derived from the events. */
export const myReferrals = (): Referral[] =>
  REFERRAL_META.map((m) => {
    const evs = EVENTS.filter((e) => e.referralId === m.id);
    return {
      ...m,
      orders: evs.length,
      volume: evs.reduce((s, e) => s + e.orderValue, 0),
      lastOrderAt: evs.reduce((mx, e) => (e.at > mx ? e.at : mx), m.joinedAt),
    };
  });

/** Total clicks on Jane's links (no per-click table in the mock — one headline figure). */
export const myClicks = (): number => 642;

// ---- Payouts ----
const PAYOUTS: PayoutRequest[] = [
  { id: 'p1', at: '2026-02-10', amount: 1200, method: 'PayPal ••jane@…', status: 'paid' },
  { id: 'p2', at: '2026-04-12', amount: 1400, method: 'PayPal ••jane@…', status: 'paid' },
  { id: 'p3', at: '2026-06-20', amount: 900,  method: 'PayPal ••jane@…', status: 'requested' },
];

export const myPayouts = (): PayoutRequest[] =>
  [...PAYOUTS].sort((a, b) => b.at.localeCompare(a.at));

// ---- Marketing assets ----
export type AssetKind = 'banner' | 'social' | 'copy';
export interface MarketingAsset {
  id: string;
  kind: AssetKind;
  title: string;
  meta: string;       // dimensions for images, or "snippet" for copy
  icon: string;       // phosphor
  body?: string;      // the copy itself, for kind: 'copy'
}

const ASSETS: MarketingAsset[] = [
  { id: 'a1', kind: 'banner', title: 'Leaderboard banner', meta: '728 × 90', icon: 'ph-image' },
  { id: 'a2', kind: 'banner', title: 'Medium rectangle',   meta: '300 × 250', icon: 'ph-image' },
  { id: 'a3', kind: 'social', title: 'Instagram square',   meta: '1080 × 1080', icon: 'ph-instagram-logo' },
  { id: 'a4', kind: 'social', title: 'YouTube end card',   meta: '1280 × 720', icon: 'ph-youtube-logo' },
  {
    id: 'a5', kind: 'copy', title: 'Short post', meta: 'X / threads', icon: 'ph-chat-text',
    body: 'I trust @hevaseo to run SEO for my own sites — real rankings, no fluff. Get started with my link 👇',
  },
  {
    id: 'a6', kind: 'copy', title: 'Caption', meta: 'Instagram / TikTok', icon: 'ph-chat-text',
    body: 'The SEO team I actually recommend. Use my code for a head start — link in bio.',
  },
  {
    id: 'a7', kind: 'copy', title: 'Newsletter blurb', meta: 'Email / blog', icon: 'ph-chat-text',
    body: 'HevaSEO handles the technical SEO grind so you can focus on the business. I partnered with them because the work holds up — here’s my link.',
  },
];

export const marketingAssets = (): MarketingAsset[] => ASSETS;

// ---- Deep-link targets (which marketing pages Jane can build a tracked link to) ----
export interface LinkTarget { label: string; path: string; icon: string }
export const LINK_TARGETS: LinkTarget[] = [
  { label: 'Homepage',         path: '/',                 icon: 'ph-house' },
  { label: 'Free SEO audit',   path: '/audit',            icon: 'ph-stethoscope' },
  { label: 'SEO web design',   path: '/seo-web-design',   icon: 'ph-palette' },
  { label: 'Keyword strategy', path: '/keyword-strategy', icon: 'ph-tree-structure' },
  { label: 'Blog',             path: '/blog',             icon: 'ph-newspaper' },
];
