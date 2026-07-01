// Affiliate (KOL referral program) — pure types + math for the /affiliate surface.
// Lives in lib (no data) so it can be unit-tested in isolation, mirroring lib/staffFinance.ts.
//
// Money-leak invariant: every figure here is the AFFILIATE'S OWN commission, derived only
// from the order volume of customers they referred. Nothing in this module references staff
// pay, internal margins, or what the platform keeps — a number here can only ever be
// reverse-engineered into this affiliate's own earnings, never anyone else's pay.

// ---- Tiers ----
// Rate scales with LIFETIME referred order volume; it applies to each qualifying order's value.
export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AffiliateTier {
  id: TierId;
  label: string;
  minVolume: number; // lifetime referred volume (USD) to reach this tier
  rate: number;      // commission rate, 0..1
  hue: string;       // tailwind-ish accent token used by the UI
}

// Ascending by minVolume. The single place tier economics are declared.
export const AFFILIATE_TIERS: readonly AffiliateTier[] = [
  { id: 'bronze',   label: 'Bronze',   minVolume: 0,     rate: 0.10, hue: 'amber'   },
  { id: 'silver',   label: 'Silver',   minVolume: 5_000, rate: 0.15, hue: 'slate'   },
  { id: 'gold',     label: 'Gold',     minVolume: 20_000, rate: 0.20, hue: 'yellow' },
  { id: 'platinum', label: 'Platinum', minVolume: 50_000, rate: 0.25, hue: 'violet' },
];

// ── Ladder-parameterized tier math (inc-E10) ──────────────────────────────────
// The lib AFFILIATE_TIERS is the default ladder; the admin can override thresholds/rates via the
// program config (affiliate_tier_config). These generic fns take ANY ladder so the same math drives
// both the default and the config-driven tiers. Defensive sort lets a config ladder be out of order.
/** Minimal tier shape shared by the lib ladder and admin-configured tiers. */
export type TierLike = { id: TierId; label: string; minVolume: number; rate: number };

const sortedLadder = <T extends TierLike>(ladder: readonly T[]): T[] =>
  [...ladder].sort((a, b) => a.minVolume - b.minVolume);

/** The highest tier in `ladder` whose threshold `volume` has reached. */
export function tierForIn<T extends TierLike>(volume: number, ladder: readonly T[]): T {
  const s = sortedLadder(ladder);
  let current = s[0];
  for (const t of s) if (volume >= t.minVolume) current = t;
  return current;
}

/** Progress toward the next tier in `ladder`: next (null at top), % filled, USD remaining. */
export function tierProgressIn<T extends TierLike>(volume: number, ladder: readonly T[]): { next: T | null; pct: number; remaining: number } {
  const s = sortedLadder(ladder);
  const current = tierForIn(volume, s);
  const idx = s.findIndex((t) => t.id === current.id);
  const next = s[idx + 1] ?? null;
  if (!next) return { next: null, pct: 100, remaining: 0 };
  const band = next.minVolume - current.minVolume;
  const into = volume - current.minVolume;
  const pct = band <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((into / band) * 100)));
  return { next, pct, remaining: Math.max(0, next.minVolume - volume) };
}

/** Loss-aversion upside: what the driven volume would earn at the next tier's rate. */
export function tierUpsideIn<T extends TierLike>(volume: number, ladder: readonly T[]): { next: T | null; gapValue: number } {
  const s = sortedLadder(ladder);
  const current = tierForIn(volume, s);
  const idx = s.findIndex((t) => t.id === current.id);
  const next = s[idx + 1] ?? null;
  if (!next) return { next: null, gapValue: 0 };
  return { next, gapValue: Math.round(volume * (next.rate - current.rate)) };
}

/** The highest tier whose threshold the lifetime volume has reached (default lib ladder). */
export function tierFor(lifetimeVolume: number): AffiliateTier {
  return tierForIn(lifetimeVolume, AFFILIATE_TIERS);
}

/** Progress toward the next tier (default lib ladder). */
export function nextTierProgress(lifetimeVolume: number): { next: AffiliateTier | null; pct: number; remaining: number } {
  return tierProgressIn(lifetimeVolume, AFFILIATE_TIERS);
}

/** Commission a single order earns at a given tier. */
export function commissionFor(orderValue: number, tier: AffiliateTier): number {
  return Math.round(orderValue * tier.rate);
}

/**
 * The "money left on the table": how much MORE the volume already driven would have
 * paid at the next tier's rate. A pure loss-aversion number — what staying put costs.
 * Zero at the top tier (nothing higher to miss). Default lib ladder.
 */
export function nextTierUpside(lifetimeVolume: number): { next: AffiliateTier | null; gapValue: number } {
  return tierUpsideIn(lifetimeVolume, AFFILIATE_TIERS);
}

/**
 * Linear run-rate projection of the current month's commission to month end.
 * `now` is an ISO date inside the month being projected.
 */
export function projectMonth(commissionSoFar: number, now: string): number {
  const [y, m, d] = now.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.max(1, d);
  return Math.round((commissionSoFar / day) * daysInMonth);
}

/**
 * Consecutive months (ending at the latest month with activity) that earned commission.
 * The "don't break your streak" number.
 */
export function earningStreak(events: readonly CommissionEvent[]): number {
  if (!events.length) return 0;
  const months = new Set(events.map((e) => e.at.slice(0, 7)));
  let cursor = events.reduce((mx, e) => (e.at > mx ? e.at : mx), events[0].at).slice(0, 7);
  let streak = 0;
  while (months.has(cursor)) {
    streak += 1;
    cursor = prevMonthKey(cursor);
  }
  return streak;
}

// ---- Referrals & commission events ----
export type ReferralStatus = 'active' | 'churned';

export interface Referral {
  id: string;
  customer: string;     // referred customer / company display name
  joinedAt: string;     // YYYY-MM-DD — when they signed up via the affiliate link
  orders: number;       // lifetime order count
  volume: number;       // lifetime order value (USD) they've placed
  lastOrderAt: string;  // YYYY-MM-DD
  status: ReferralStatus;
}

export type CommissionStatus = 'pending' | 'cleared' | 'paid';

export interface CommissionEvent {
  id: string;
  at: string;            // YYYY-MM-DD the referred order was placed
  referralId: string;
  customer: string;
  orderCode: string;
  orderValue: number;    // the referred order's value (USD)
  rate: number;          // tier rate applied at the time (0..1)
  amount: number;        // commission earned (USD)
  status: CommissionStatus;
}

// ---- Payouts ----
export type PayoutStatus = 'requested' | 'approved' | 'paid' | 'rejected';
export type PayoutMethodKind = 'paypal' | 'bank' | 'crypto';

export interface PayoutRequest {
  id: string;
  at: string;      // YYYY-MM-DD
  amount: number;  // USD
  method: string;  // masked label, e.g. "PayPal ••jane@…"
  status: PayoutStatus;
}

// ---- KPI rollup ----
export interface AffiliateKpis {
  clicks: number;
  signups: number;          // total referred customers
  activeCustomers: number;  // referrals still ordering
  totalVolume: number;      // lifetime referred order volume (drives the tier)
  commissionLifetime: number;
  commissionThisMonth: number;
  commissionLastMonth: number;
  volumeThisMonth: number;
  volumeLastMonth: number;
  signupsThisMonth: number;
}

const monthKey = (isoDate: string) => isoDate.slice(0, 7); // 'YYYY-MM'

/** Previous calendar month for a 'YYYY-MM' key. */
export function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Roll referrals + commission events into the headline numbers. `now` anchors the
 * this-month / last-month split; it defaults to the most recent event so the mock
 * is self-consistent without wall-clock coupling.
 */
export function rollupKpis(
  referrals: readonly Referral[],
  events: readonly CommissionEvent[],
  clicks: number,
  now?: string,
): AffiliateKpis {
  const latest = events.reduce((mx, e) => (e.at > mx ? e.at : mx), events[0]?.at ?? '2026-01-01');
  const thisMonth = monthKey(now ?? latest);
  const lastMonth = prevMonthKey(thisMonth);

  const sumWhere = (pred: (e: CommissionEvent) => boolean, pick: (e: CommissionEvent) => number) =>
    events.filter(pred).reduce((s, e) => s + pick(e), 0);

  return {
    clicks,
    signups: referrals.length,
    activeCustomers: referrals.filter((r) => r.status === 'active').length,
    totalVolume: referrals.reduce((s, r) => s + r.volume, 0),
    commissionLifetime: events.reduce((s, e) => s + e.amount, 0),
    commissionThisMonth: sumWhere((e) => monthKey(e.at) === thisMonth, (e) => e.amount),
    commissionLastMonth: sumWhere((e) => monthKey(e.at) === lastMonth, (e) => e.amount),
    volumeThisMonth: sumWhere((e) => monthKey(e.at) === thisMonth, (e) => e.orderValue),
    volumeLastMonth: sumWhere((e) => monthKey(e.at) === lastMonth, (e) => e.orderValue),
    signupsThisMonth: referrals.filter((r) => monthKey(r.joinedAt) === thisMonth).length,
  };
}

/** Month-over-month percent change, rounded. Returns null when there's no base to compare. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface MonthPoint {
  month: string;     // 'YYYY-MM'
  commission: number;
  volume: number;
}

/** Per-month commission + referred-volume series, sorted ascending, for the earnings chart. */
export function monthlySeries(events: readonly CommissionEvent[]): MonthPoint[] {
  const byMonth = new Map<string, MonthPoint>();
  for (const e of events) {
    const k = monthKey(e.at);
    const p = byMonth.get(k) ?? { month: k, commission: 0, volume: 0 };
    p.commission += e.amount;
    p.volume += e.orderValue;
    byMonth.set(k, p);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ---- Conversion funnel ----
export interface FunnelStage {
  key: 'clicks' | 'signups' | 'firstOrder' | 'repeat';
  label: string;
  value: number;
  rate: number; // % of the PREVIOUS stage (100 for the first stage)
}

/**
 * clicks → signups → placed a first order → became a repeat buyer.
 * Each stage's rate is relative to the stage before it.
 */
export function funnelStats(input: {
  clicks: number;
  referrals: readonly Referral[];
}): FunnelStage[] {
  const { clicks, referrals } = input;
  const signups = referrals.length;
  const firstOrder = referrals.filter((r) => r.orders >= 1).length;
  const repeat = referrals.filter((r) => r.orders >= 2).length;
  const rate = (cur: number, prev: number) => (prev === 0 ? 0 : Math.round((cur / prev) * 100));
  return [
    { key: 'clicks', label: 'Link clicks', value: clicks, rate: 100 },
    { key: 'signups', label: 'Signed up', value: signups, rate: rate(signups, clicks) },
    { key: 'firstOrder', label: 'First order', value: firstOrder, rate: rate(firstOrder, signups) },
    { key: 'repeat', label: 'Repeat buyer', value: repeat, rate: rate(repeat, firstOrder) },
  ];
}

// ---- Affiliate code + links ----
const CODE_MIN = 3;
const CODE_MAX = 20;

/** A vanity code derived from a name: A–Z/0–9 only, uppercased, capped. */
export function genCode(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length >= CODE_MIN) return cleaned.slice(0, CODE_MAX);
  return 'PARTNER';
}

/** Format rule for a (possibly user-edited) vanity code. */
export function isCodeValid(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${CODE_MIN},${CODE_MAX}}$`).test(code);
}

// The public marketing site is where referred traffic lands; ?ref carries the code.
export const REF_ORIGIN = 'https://hevaseo.com';

export function buildAffiliateUrl(code: string): string {
  return `${REF_ORIGIN}/?ref=${encodeURIComponent(code)}`;
}

// The tracked share link (inc-E16): routes through the app's /r/:code endpoint, which records the click
// then 302s to the marketing site with ?ref. `origin` is the app origin (env in prod, window origin
// client-side); empty → a relative path (still works when the app serves it).
export function buildTrackedUrl(code: string, origin = ''): string {
  return `${origin}/r/${encodeURIComponent(code)}`;
}

/** A tracked deep link to a specific service/landing path. */
export function buildDeepLink(code: string, servicePath: string): string {
  const path = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
  return `${REF_ORIGIN}${path}?ref=${encodeURIComponent(code)}`;
}
