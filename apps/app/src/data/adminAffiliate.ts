// Admin-side affiliate program mock — the ONLY data file for /admin/affiliate.
// Admins run the whole program and see ALL money (finance.view): every partner's
// referred volume, revenue driven, commission cost, and what's been claimed vs owed.
// (Contrast: a partner's own /affiliate surface sees only their own earnings.)
//
// Reuses the shared tier economics + status types from lib/affiliate so the partner
// and admin views can never disagree about what a tier is or who's at it.

import { AFFILIATE_TIERS, tierFor, type TierId, type MonthPoint, type PayoutStatus } from '@/lib/affiliate';
import { ORDERS, CUSTOMERS, SERVICE_SKILL, SKILL_META } from '@/data/adminMock';

export type PartnerStatus = 'active' | 'pending' | 'suspended';

export interface AdminAffiliate {
  id: string;
  name: string;
  handle: string;
  avatarInitials: string;
  platform: string;
  niche: string;
  email: string;
  code: string;
  status: PartnerStatus;
  joinedAt: string;        // YYYY-MM-DD
  lastActiveAt: string;    // YYYY-MM-DD
  refs: number;            // referred customers
  volume: number;          // lifetime referred order value (= revenue driven, gross)
  commission: number;      // lifetime commission earned by the partner (our cost)
  claimed: number;         // already paid out to the partner
  // unclaimed (= commission - claimed) is derived; never stored, never drifts.
}

// Tier is DERIVED from volume via the shared ladder — the admin table and the
// partner dashboard therefore always agree.
export const partnerTier = (a: AdminAffiliate): TierId => tierFor(a.volume).id;
export const partnerUnclaimed = (a: AdminAffiliate): number => Math.max(0, a.commission - a.claimed);

// Jane (JANESEO) mirrors the partner-side demo exactly: Gold, 7 refs, $32,100
// volume, $5,620 earned, $2,600 paid (the two completed payouts) → $3,020 owed.
const PARTNERS: AdminAffiliate[] = [
  { id: 'af-jane',  name: 'Jane Rivera',   handle: '@janeseo',     avatarInitials: 'JR', platform: 'YouTube',   niche: 'SEO & Marketing', email: 'jane@janeseo.com',   code: 'JANESEO',  status: 'active',    joinedAt: '2025-11-01', lastActiveAt: '2026-06-18', refs: 7,  volume: 32100, commission: 5620,  claimed: 2600 },
  { id: 'af-marco', name: 'Marco Vidal',   handle: '@marcogrowth', avatarInitials: 'MV', platform: 'YouTube',   niche: 'Growth',          email: 'marco@vidal.co',     code: 'MARCOG',   status: 'active',    joinedAt: '2025-09-12', lastActiveAt: '2026-06-25', refs: 14, volume: 58000, commission: 12400, claimed: 9000 },
  { id: 'af-devin', name: 'Devin Lee',     handle: '@devbuilds',   avatarInitials: 'DL', platform: 'X',         niche: 'Tech',            email: 'devin@devbuilds.io', code: 'DEVBUILDS',status: 'active',    joinedAt: '2025-08-03', lastActiveAt: '2026-06-27', refs: 18, volume: 72000, commission: 16200, claimed: 13000 },
  { id: 'af-aisha', name: 'Aïsha Khan',    handle: '@aishaseo',    avatarInitials: 'AK', platform: 'Instagram', niche: 'SEO',             email: 'aisha@khan.me',      code: 'AISHASEO', status: 'active',    joinedAt: '2025-12-20', lastActiveAt: '2026-06-19', refs: 9,  volume: 24500, commission: 4100,  claimed: 2000 },
  { id: 'af-priya', name: 'Priya Nair',    handle: '@priyamktg',   avatarInitials: 'PN', platform: 'Blog',      niche: 'Marketing',       email: 'priya@nair.in',      code: 'PRIYAM',   status: 'active',    joinedAt: '2026-02-14', lastActiveAt: '2026-06-15', refs: 5,  volume: 9800,  commission: 1200,  claimed: 600 },
  { id: 'af-tomas', name: 'Tomás Garcia',  handle: '@tomasg',      avatarInitials: 'TG', platform: 'TikTok',    niche: 'Business',        email: 'tomas@garcia.es',    code: 'TOMASG',   status: 'active',    joinedAt: '2026-03-08', lastActiveAt: '2026-06-22', refs: 4,  volume: 7200,  commission: 980,   claimed: 0 },
  { id: 'af-noah',  name: 'Noah Park',     handle: '@noahp',       avatarInitials: 'NP', platform: 'X',         niche: 'Tech',            email: 'noah@park.dev',      code: 'NOAHP',    status: 'active',    joinedAt: '2026-05-18', lastActiveAt: '2026-06-24', refs: 2,  volume: 2100,  commission: 210,   claimed: 0 },
  { id: 'af-sam',   name: 'Sam Doyle',     handle: '@samdeals',    avatarInitials: 'SD', platform: 'Facebook',  niche: 'Deals',           email: 'sam@deals.biz',      code: 'SAMDEALS', status: 'suspended', joinedAt: '2026-04-02', lastActiveAt: '2026-05-30', refs: 3,  volume: 0,     commission: 0,     claimed: 0 },
  { id: 'af-lena',  name: 'Lena Ortiz',    handle: '@lenacreates', avatarInitials: 'LO', platform: 'Instagram', niche: 'Lifestyle',       email: 'lena@creates.co',    code: 'LENAC',    status: 'pending',   joinedAt: '2026-06-26', lastActiveAt: '2026-06-26', refs: 0,  volume: 0,     commission: 0,     claimed: 0 },
  { id: 'af-kai',   name: 'Kai Tan',       handle: '@kaitech',     avatarInitials: 'KT', platform: 'YouTube',   niche: 'Tech',            email: 'kai@tan.sg',         code: 'KAITECH',  status: 'pending',   joinedAt: '2026-06-27', lastActiveAt: '2026-06-27', refs: 0,  volume: 0,     commission: 0,     claimed: 0 },
];

export const adminAffiliates = (): AdminAffiliate[] => PARTNERS;
export const pendingApplications = (): AdminAffiliate[] => PARTNERS.filter((p) => p.status === 'pending');
export const affiliateById = (id: string): AdminAffiliate | undefined => PARTNERS.find((p) => p.id === id);

// Which admin customers came in through a partner's link (customer id → partner id).
// The rest signed up organically and show no referrer.
export const CUSTOMER_REFERRER: Record<string, string> = {
  c1: 'af-jane',   // Acme Co
  c3: 'af-marco',  // Nova
  c5: 'af-priya',  // Peak Digital
  c7: 'af-devin',  // Orbit Labs
  c9: 'af-aisha',  // Vertex AI
  c11: 'af-jane',  // Cobalt Studio
};
export const referrerOf = (customerId: string): AdminAffiliate | undefined => {
  const id = CUSTOMER_REFERRER[customerId];
  return id ? affiliateById(id) : undefined;
};

// ---- Per-partner volume trend (for the hovercard chart: 1M / 3M / 6M / 1Y) ----
export interface VolMonth { month: string; volume: number }

// 12 months ending 2026-06, deterministic per partner, trending up, summing to the
// partner's lifetime volume. The hovercard slices the last N for each timeframe.
export function partnerVolumeSeries(a: AdminAffiliate): VolMonth[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    let y = 2026; let m = 6 - i;
    while (m <= 0) { m += 12; y -= 1; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  if (a.volume <= 0) return months.map((month) => ({ month, volume: 0 }));

  let h = 2166136261;
  for (const ch of a.id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };

  const weights = months.map((_, i) => (0.5 + i / 11) * (0.7 + 0.6 * rnd())); // upward trend + noise
  const sum = weights.reduce((s, w) => s + w, 0);
  let alloc = 0;
  return months.map((month, i) => {
    const last = i === months.length - 1;
    const volume = last ? a.volume - alloc : Math.round((a.volume * weights[i]) / sum);
    alloc += volume;
    return { month, volume };
  });
}

// ---- Service mix of the customers a partner referred ----
export interface ReferredSvc { service: string; count: number; value: number; pct: number; icon: string; color: string }

export function referredServiceMix(affiliateId: string): ReferredSvc[] {
  const companies = new Set(
    CUSTOMERS.filter((c) => CUSTOMER_REFERRER[c.id] === affiliateId).map((c) => c.company),
  );
  const orders = ORDERS.filter((o) => companies.has(o.customer));
  const total = orders.length;
  if (total === 0) return [];
  const by = new Map<string, { count: number; value: number }>();
  for (const o of orders) {
    const cur = by.get(o.service) ?? { count: 0, value: 0 };
    cur.count += 1; cur.value += o.value;
    by.set(o.service, cur);
  }
  return [...by.entries()]
    .map(([service, agg]) => {
      const meta = SKILL_META[SERVICE_SKILL[service] ?? ''] ?? { label: service, icon: 'ph-circle', color: '#64748b' };
      return { service, count: agg.count, value: agg.value, pct: Math.round((agg.count / total) * 100), icon: meta.icon, color: meta.color };
    })
    .sort((a, b) => b.count - a.count);
}

// ---- Payout queue ----
export interface AdminPayout {
  id: string;
  affiliateId: string;
  partner: string;
  handle: string;
  at: string;       // YYYY-MM-DD requested
  amount: number;
  method: string;   // masked
  status: PayoutStatus;
}

const PAYOUTS: AdminPayout[] = [
  { id: 'po-1', affiliateId: 'af-marco', partner: 'Marco Vidal',  handle: '@marcogrowth', at: '2026-06-25', amount: 3400, method: 'PayPal ••marco@…',    status: 'requested' },
  { id: 'po-2', affiliateId: 'af-aisha', partner: 'Aïsha Khan',   handle: '@aishaseo',    at: '2026-06-23', amount: 1500, method: 'Wise ••2231',         status: 'requested' },
  { id: 'po-3', affiliateId: 'af-tomas', partner: 'Tomás Garcia', handle: '@tomasg',      at: '2026-06-22', amount: 980,  method: 'PayPal ••tomas@…',    status: 'requested' },
  { id: 'po-4', affiliateId: 'af-jane',  partner: 'Jane Rivera',  handle: '@janeseo',     at: '2026-06-20', amount: 900,  method: 'PayPal ••jane@…',     status: 'approved' },
  { id: 'po-5', affiliateId: 'af-devin', partner: 'Devin Lee',    handle: '@devbuilds',   at: '2026-06-12', amount: 4000, method: 'Bank ••8841',         status: 'paid' },
  { id: 'po-6', affiliateId: 'af-jane',  partner: 'Jane Rivera',  handle: '@janeseo',     at: '2026-04-12', amount: 1400, method: 'PayPal ••jane@…',     status: 'paid' },
  { id: 'po-7', affiliateId: 'af-priya', partner: 'Priya Nair',   handle: '@priyamktg',   at: '2026-05-09', amount: 600,  method: 'PayPal ••priya@…',    status: 'paid' },
];

export const adminPayouts = (): AdminPayout[] => [...PAYOUTS].sort((a, b) => b.at.localeCompare(a.at));

// ---- Program-wide monthly trend (referred volume + commission) for the chart ----
const PROGRAM_SERIES: MonthPoint[] = [
  { month: '2025-11', commission: 2100, volume: 12400 },
  { month: '2025-12', commission: 2680, volume: 15200 },
  { month: '2026-01', commission: 3050, volume: 17800 },
  { month: '2026-02', commission: 3320, volume: 19600 },
  { month: '2026-03', commission: 4100, volume: 23400 },
  { month: '2026-04', commission: 4780, volume: 26900 },
  { month: '2026-05', commission: 5400, volume: 30200 },
  { month: '2026-06', commission: 6240, volume: 34800 },
];
export const programSeries = (): MonthPoint[] => PROGRAM_SERIES;

// ---- Program rollup ----
export interface ProgramRollup {
  partnersActive: number;
  partnersPending: number;
  partnersSuspended: number;
  totalRefs: number;
  totalVolume: number;     // revenue driven by referrals (gross)
  totalCommission: number; // lifetime commission cost
  totalClaimed: number;    // paid out
  totalUnclaimed: number;  // owed (liability)
  netRevenue: number;      // volume - commission (kept after commission)
  payoutsPending: number;  // sum of requested+approved payouts awaiting payment
}

export const programRollup = (): ProgramRollup => {
  const active = PARTNERS.filter((p) => p.status === 'active');
  const totalCommission = active.reduce((s, p) => s + p.commission, 0);
  const totalClaimed = active.reduce((s, p) => s + p.claimed, 0);
  const totalVolume = active.reduce((s, p) => s + p.volume, 0);
  return {
    partnersActive: active.length,
    partnersPending: PARTNERS.filter((p) => p.status === 'pending').length,
    partnersSuspended: PARTNERS.filter((p) => p.status === 'suspended').length,
    totalRefs: active.reduce((s, p) => s + p.refs, 0),
    totalVolume,
    totalCommission,
    totalClaimed,
    totalUnclaimed: totalCommission - totalClaimed,
    netRevenue: totalVolume - totalCommission,
    payoutsPending: PAYOUTS.filter((p) => p.status === 'requested' || p.status === 'approved').reduce((s, p) => s + p.amount, 0),
  };
};

// ---- Program rules (defaults; admin-editable in the UI, no backend yet) ----
export type ApprovalMode = 'instant' | 'manual';
export type AttributionModel = 'lifetime' | 'window';

export interface ProgramRules {
  approvalMode: ApprovalMode;
  attribution: AttributionModel;
  cookieWindowDays: number;
  holdDays: number;          // commission clears after this many days
  minPayout: number;         // minimum balance before a partner can withdraw
  selfReferralBlock: boolean;
  recurring: boolean;        // repeat orders keep paying
}

export const DEFAULT_RULES: ProgramRules = {
  approvalMode: 'instant',
  attribution: 'lifetime',
  cookieWindowDays: 60,
  holdDays: 14,
  minPayout: 50,
  selfReferralBlock: true,
  recurring: true,
};

// Editable tier rows seed from the shared ladder (lib/affiliate is the source of truth).
export interface EditableTier { id: TierId; label: string; minVolume: number; rate: number }
export const defaultTierRows = (): EditableTier[] =>
  AFFILIATE_TIERS.map((t) => ({ id: t.id, label: t.label, minVolume: t.minVolume, rate: t.rate }));

// Tier state computed from the ADMIN-EDITED rows (not the hard-coded lib ladder), so
// edits in the Rules tab actually drive what partners show. Defensive sort lets the
// admin type thresholds in any order. Same shape as lib's nextTierProgress.
export interface TierState { current: EditableTier; next: EditableTier | null; pct: number; remaining: number }
export function tierStateFromRows(rows: readonly EditableTier[], volume: number): TierState {
  const sorted = [...rows].sort((a, b) => a.minVolume - b.minVolume);
  let idx = 0;
  for (let i = 0; i < sorted.length; i++) if (volume >= sorted[i].minVolume) idx = i;
  const current = sorted[idx];
  const next = sorted[idx + 1] ?? null;
  if (!next) return { current, next: null, pct: 100, remaining: 0 };
  const band = next.minVolume - current.minVolume;
  const into = volume - current.minVolume;
  const pct = band <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((into / band) * 100)));
  return { current, next, pct, remaining: Math.max(0, next.minVolume - volume) };
}
export const tierRowFor = (rows: readonly EditableTier[], volume: number): EditableTier =>
  tierStateFromRows(rows, volume).current;

// Reconcile a partner's claimed balance with the live payout queue: any request the
// admin has marked PAID in-session (that wasn't already paid in the base data) adds to
// what they've been paid — so balances and the queue can never disagree.
export function newlyPaidTotal(
  partnerId: string,
  effectivePayouts: readonly AdminPayout[],
  baseStatusById: Record<string, PayoutStatus>,
): number {
  return effectivePayouts
    .filter((x) => x.affiliateId === partnerId && x.status === 'paid' && baseStatusById[x.id] !== 'paid')
    .reduce((s, x) => s + x.amount, 0);
}
