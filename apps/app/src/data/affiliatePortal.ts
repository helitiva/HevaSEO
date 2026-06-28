// Per-partner portal data resolver. The /affiliate portal renders for ONE partner at a
// time; normally the demo partner (Jane, authored in affiliateMock), but when an admin
// impersonates someone it must render that partner. Jane keeps her rich authored data;
// every other partner is synthesised deterministically from their admin aggregates
// (refs / volume / commission) so totals match the admin view exactly.

import { tierFor, type Referral, type CommissionEvent, type PayoutRequest } from '@/lib/affiliate';
import {
  myAffiliate as janeAffiliate, myReferrals as janeReferrals,
  myCommissionEvents as janeEvents, myPayouts as janePayouts, myClicks as janeClicks,
  type Affiliate,
} from './affiliateMock';
import { adminAffiliates, adminPayouts, type AdminAffiliate } from './adminAffiliate';

export const DEFAULT_AFFILIATE_ID = 'af-jane';

export interface PortalData {
  affiliate: Affiliate;
  referrals: Referral[];
  events: CommissionEvent[];
  payouts: PayoutRequest[];
  clicks: number;
}

// Spread N items across the last `span` months ending 2026-06, oldest first.
const SYNTH_END = { y: 2026, m: 6 };
function spreadDate(i: number, n: number): string {
  const span = Math.min(Math.max(n, 1), 8);
  const monthsBack = span - 1 - Math.floor((i / Math.max(n, 1)) * span);
  let y = SYNTH_END.y;
  let m = SYNTH_END.m - monthsBack;
  while (m <= 0) { m += 12; y -= 1; }
  const day = 6 + ((i * 7) % 20); // 6..25, deterministic
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const SYNTH_CUSTOMERS = ['Northwind', 'Lumen', 'Pixel Forge', 'Brightlane', 'Cobalt', 'Harbor', 'Vertex', 'Maple', 'Ironwood', 'Solstice', 'Quill', 'Atlas'];

function synthReferrals(a: AdminAffiliate): Referral[] {
  if (a.refs <= 0) return [];
  const per = Math.floor(a.volume / a.refs);
  const rem = a.volume - per * a.refs;
  return Array.from({ length: a.refs }, (_, i) => {
    const volume = per + (i === 0 ? rem : 0);
    const at = spreadDate(i, a.refs);
    return {
      id: `${a.id}-r${i}`,
      customer: SYNTH_CUSTOMERS[i % SYNTH_CUSTOMERS.length] + (i >= SYNTH_CUSTOMERS.length ? ` ${Math.floor(i / SYNTH_CUSTOMERS.length) + 1}` : ''),
      joinedAt: at,
      orders: volume > 0 ? 1 + (i % 3) : 0,
      volume,
      lastOrderAt: at,
      status: (volume > 0 && i % 6 !== 5) ? 'active' : 'churned',
    };
  });
}

function synthEvents(a: AdminAffiliate, referrals: Referral[]): CommissionEvent[] {
  const earning = referrals.filter((r) => r.volume > 0);
  if (earning.length === 0 || a.commission <= 0) return [];
  const totalVol = earning.reduce((s, r) => s + r.volume, 0);
  const rate = tierFor(a.volume).rate;
  let allocated = 0;
  return earning.map((r, i) => {
    const last = i === earning.length - 1;
    const amount = last ? a.commission - allocated : Math.round(a.commission * (r.volume / totalVol));
    allocated += amount;
    return {
      id: `${a.id}-e${i}`,
      at: spreadDate(i, earning.length),
      referralId: r.id,
      customer: r.customer,
      orderCode: `O-${a.id.slice(3, 6).toUpperCase()}-${100 + i}`,
      orderValue: r.volume,
      rate,
      amount,
      status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'cleared' : 'paid',
    };
  });
}

function synthAffiliate(a: AdminAffiliate): Affiliate {
  return {
    name: a.name,
    handle: a.handle,
    code: a.code,
    email: a.email,
    avatarInitials: a.avatarInitials,
    platform: a.platform,
    audience: '—',
    niche: a.niche,
    joinedAt: a.joinedAt,
    status: 'active',
    payoutKind: 'paypal',
    payoutLabel: `PayPal ••${a.email.split('@')[0].slice(0, 4)}…`,
  };
}

function synthPayouts(a: AdminAffiliate): PayoutRequest[] {
  return adminPayouts()
    .filter((p) => p.affiliateId === a.id)
    .map((p) => ({ id: p.id, at: p.at, amount: p.amount, method: p.method, status: p.status }));
}

/** Resolve everything the /affiliate portal needs for a given partner id. */
export function portalDataFor(id: string): PortalData {
  if (id === DEFAULT_AFFILIATE_ID) {
    return {
      affiliate: janeAffiliate(),
      referrals: janeReferrals(),
      events: janeEvents(),
      payouts: janePayouts(),
      clicks: janeClicks(),
    };
  }
  const a = adminAffiliates().find((x) => x.id === id);
  if (!a) {
    return { affiliate: janeAffiliate(), referrals: janeReferrals(), events: janeEvents(), payouts: janePayouts(), clicks: janeClicks() };
  }
  const referrals = synthReferrals(a);
  return {
    affiliate: synthAffiliate(a),
    referrals,
    events: synthEvents(a, referrals),
    payouts: synthPayouts(a),
    clicks: a.refs * 90 + 60,
  };
}
