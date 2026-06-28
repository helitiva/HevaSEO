import { describe, it, expect } from 'vitest';
import {
  defaultTierRows, tierStateFromRows, tierRowFor, newlyPaidTotal,
  partnerUnclaimed, programRollup, partnerVolumeSeries, referredServiceMix,
  referrerOf, affiliateById, type EditableTier, type AdminPayout,
} from './adminAffiliate';
import type { PayoutStatus } from '@/lib/affiliate';

describe('tierStateFromRows', () => {
  const rows = defaultTierRows(); // bronze 0/10% · silver 5k/15% · gold 20k/20% · platinum 50k/25%

  it('matches the default ladder for a mid-tier volume', () => {
    const s = tierStateFromRows(rows, 32100);
    expect(s.current.id).toBe('gold');
    expect(s.next?.id).toBe('platinum');
    expect(s.remaining).toBe(50000 - 32100);
  });

  it('honours ADMIN-EDITED thresholds and rates', () => {
    const edited: EditableTier[] = [
      { id: 'bronze', label: 'Bronze', minVolume: 0, rate: 0.10 },
      { id: 'silver', label: 'Silver', minVolume: 10000, rate: 0.18 }, // raised threshold
      { id: 'gold', label: 'Gold', minVolume: 20000, rate: 0.20 },
      { id: 'platinum', label: 'Platinum', minVolume: 50000, rate: 0.25 },
    ];
    // $8k now falls in Bronze (silver moved to $10k), not Silver.
    expect(tierRowFor(edited, 8000).id).toBe('bronze');
    expect(tierRowFor(edited, 12000).id).toBe('silver');
    expect(tierRowFor(edited, 12000).rate).toBe(0.18);
  });

  it('sorts defensively when rows are entered out of order', () => {
    const messy: EditableTier[] = [
      { id: 'gold', label: 'Gold', minVolume: 20000, rate: 0.20 },
      { id: 'bronze', label: 'Bronze', minVolume: 0, rate: 0.10 },
      { id: 'platinum', label: 'Platinum', minVolume: 50000, rate: 0.25 },
      { id: 'silver', label: 'Silver', minVolume: 5000, rate: 0.15 },
    ];
    expect(tierRowFor(messy, 0).id).toBe('bronze');
    expect(tierRowFor(messy, 60000).id).toBe('platinum');
  });

  it('caps at the top tier', () => {
    const s = tierStateFromRows(rows, 90000);
    expect(s.next).toBeNull();
    expect(s.pct).toBe(100);
    expect(s.remaining).toBe(0);
  });
});

describe('newlyPaidTotal', () => {
  const base: Record<string, PayoutStatus> = { x1: 'requested', x2: 'approved', x3: 'paid' };
  const effective: AdminPayout[] = [
    { id: 'x1', affiliateId: 'a', partner: 'A', handle: '@a', at: '2026-06-01', amount: 500, method: 'PayPal', status: 'paid' },     // newly paid
    { id: 'x2', affiliateId: 'a', partner: 'A', handle: '@a', at: '2026-06-02', amount: 300, method: 'PayPal', status: 'approved' }, // not paid yet
    { id: 'x3', affiliateId: 'a', partner: 'A', handle: '@a', at: '2026-05-01', amount: 200, method: 'PayPal', status: 'paid' },     // already paid in base
    { id: 'x4', affiliateId: 'b', partner: 'B', handle: '@b', at: '2026-06-01', amount: 999, method: 'PayPal', status: 'paid' },     // other partner
  ];

  it('counts only requests newly marked paid for the partner', () => {
    expect(newlyPaidTotal('a', effective, base)).toBe(500);
  });
  it('ignores partners other than the one asked for', () => {
    expect(newlyPaidTotal('b', effective, {})).toBe(999); // unknown base → treated as newly paid
  });
});

describe('partnerUnclaimed', () => {
  it('never goes negative', () => {
    expect(partnerUnclaimed({ commission: 100, claimed: 250 } as never)).toBe(0);
    expect(partnerUnclaimed({ commission: 5620, claimed: 2600 } as never)).toBe(3020);
  });
});

describe('programRollup', () => {
  it('owes the difference between commission earned and claimed (active partners)', () => {
    const r = programRollup();
    expect(r.totalUnclaimed).toBe(r.totalCommission - r.totalClaimed);
    expect(r.netRevenue).toBe(r.totalVolume - r.totalCommission);
  });
});

describe('partnerVolumeSeries', () => {
  it('is 12 months and sums to the partner lifetime volume', () => {
    const a = affiliateById('af-marco')!;
    const s = partnerVolumeSeries(a);
    expect(s).toHaveLength(12);
    expect(s.reduce((x, m) => x + m.volume, 0)).toBe(a.volume);
  });
  it('is all zero for a zero-volume partner', () => {
    const a = affiliateById('af-lena')!;
    expect(partnerVolumeSeries(a).every((m) => m.volume === 0)).toBe(true);
  });
});

describe('referredServiceMix', () => {
  it('aggregates the orders of a partner’s referred customers', () => {
    const mix = referredServiceMix('af-jane'); // Acme Co + Cobalt Studio
    expect(mix.length).toBeGreaterThan(0);
    const pctSum = mix.reduce((x, m) => x + m.pct, 0);
    expect(pctSum).toBeGreaterThan(90);
    expect(pctSum).toBeLessThanOrEqual(101); // rounding tolerance
  });
  it('is empty for a partner with no referred admin customers', () => {
    expect(referredServiceMix('af-noah')).toHaveLength(0);
  });
});

describe('referrerOf', () => {
  it('maps a referred customer to their acquiring partner', () => {
    expect(referrerOf('c1')?.id).toBe('af-jane');
    expect(referrerOf('c3')?.id).toBe('af-marco');
  });
  it('returns undefined for an organic customer', () => {
    expect(referrerOf('c2')).toBeUndefined();
  });
});
