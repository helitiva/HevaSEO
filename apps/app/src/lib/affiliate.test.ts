import { describe, it, expect } from 'vitest';
import {
  AFFILIATE_TIERS, tierFor, nextTierProgress, commissionFor,
  nextTierUpside, projectMonth, earningStreak,
  rollupKpis, pctDelta, monthlySeries, funnelStats, prevMonthKey,
  genCode, isCodeValid, buildAffiliateUrl, buildDeepLink,
  type Referral, type CommissionEvent,
} from './affiliate';

const referrals: Referral[] = [
  { id: 'r1', customer: 'Acme',  joinedAt: '2026-01-12', orders: 3, volume: 9000,  lastOrderAt: '2026-06-02', status: 'active' },
  { id: 'r2', customer: 'Bolt',  joinedAt: '2026-03-05', orders: 1, volume: 1200,  lastOrderAt: '2026-03-05', status: 'active' },
  { id: 'r3', customer: 'Cedar', joinedAt: '2026-06-20', orders: 0, volume: 0,     lastOrderAt: '2026-06-20', status: 'churned' },
];

const events: CommissionEvent[] = [
  { id: 'e1', at: '2026-05-10', referralId: 'r1', customer: 'Acme', orderCode: 'O-1', orderValue: 4000, rate: 0.15, amount: 600, status: 'paid' },
  { id: 'e2', at: '2026-06-02', referralId: 'r1', customer: 'Acme', orderCode: 'O-2', orderValue: 5000, rate: 0.15, amount: 750, status: 'cleared' },
  { id: 'e3', at: '2026-06-18', referralId: 'r2', customer: 'Bolt', orderCode: 'O-3', orderValue: 1200, rate: 0.10, amount: 120, status: 'pending' },
];

describe('tierFor', () => {
  it('returns Bronze at zero volume', () => {
    expect(tierFor(0).id).toBe('bronze');
  });
  it('picks the highest tier whose threshold is reached', () => {
    expect(tierFor(4999).id).toBe('bronze');
    expect(tierFor(5000).id).toBe('silver');
    expect(tierFor(20000).id).toBe('gold');
    expect(tierFor(999999).id).toBe('platinum');
  });
  it('tiers are declared ascending by threshold', () => {
    const vols = AFFILIATE_TIERS.map((t) => t.minVolume);
    expect([...vols].sort((a, b) => a - b)).toEqual(vols);
  });
});

describe('nextTierProgress', () => {
  it('reports progress within the current band', () => {
    const p = nextTierProgress(2500); // halfway from Bronze(0) to Silver(5000)
    expect(p.next?.id).toBe('silver');
    expect(p.pct).toBe(50);
    expect(p.remaining).toBe(2500);
  });
  it('caps at the top tier', () => {
    const p = nextTierProgress(60000);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(100);
    expect(p.remaining).toBe(0);
  });
});

describe('commissionFor', () => {
  it('applies the tier rate to the order value', () => {
    expect(commissionFor(1000, tierFor(0))).toBe(100);       // 10%
    expect(commissionFor(1000, tierFor(20000))).toBe(200);   // 20%
  });
});

describe('nextTierUpside', () => {
  it('values the rate gap against volume already driven', () => {
    // Gold (20%) → Platinum (25%) on $30k = 5% * 30000 = 1500
    const u = nextTierUpside(30000);
    expect(u.next?.id).toBe('platinum');
    expect(u.gapValue).toBe(1500);
  });
  it('is zero at the top tier', () => {
    expect(nextTierUpside(60000)).toEqual({ next: null, gapValue: 0 });
  });
});

describe('projectMonth', () => {
  it('extrapolates the month from the run-rate so far', () => {
    // $1400 by the 14th of a 28-day month → $2800 projected
    expect(projectMonth(1400, '2026-02-14')).toBe(2800);
  });
  it('does not divide by zero on day one', () => {
    expect(projectMonth(100, '2026-03-01')).toBe(3100);
  });
});

describe('earningStreak', () => {
  it('counts consecutive months up to the latest activity', () => {
    const evs: CommissionEvent[] = [
      { id: 'a', at: '2026-04-01', referralId: 'r', customer: 'c', orderCode: 'o', orderValue: 100, rate: 0.1, amount: 10, status: 'paid' },
      { id: 'b', at: '2026-05-01', referralId: 'r', customer: 'c', orderCode: 'o', orderValue: 100, rate: 0.1, amount: 10, status: 'paid' },
      { id: 'c', at: '2026-06-01', referralId: 'r', customer: 'c', orderCode: 'o', orderValue: 100, rate: 0.1, amount: 10, status: 'paid' },
    ];
    expect(earningStreak(evs)).toBe(3);
  });
  it('breaks the streak on a gap month', () => {
    const evs: CommissionEvent[] = [
      { id: 'a', at: '2026-03-01', referralId: 'r', customer: 'c', orderCode: 'o', orderValue: 100, rate: 0.1, amount: 10, status: 'paid' },
      { id: 'c', at: '2026-06-01', referralId: 'r', customer: 'c', orderCode: 'o', orderValue: 100, rate: 0.1, amount: 10, status: 'paid' },
    ];
    expect(earningStreak(evs)).toBe(1); // only June, March is not contiguous
  });
  it('is zero with no events', () => {
    expect(earningStreak([])).toBe(0);
  });
});

describe('prevMonthKey', () => {
  it('rolls back across a year boundary', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(prevMonthKey('2026-06')).toBe('2026-05');
  });
});

describe('rollupKpis', () => {
  const k = rollupKpis(referrals, events, 540, '2026-06-15');

  it('counts signups and active customers', () => {
    expect(k.signups).toBe(3);
    expect(k.activeCustomers).toBe(2);
  });
  it('sums lifetime referred volume from referrals', () => {
    expect(k.totalVolume).toBe(10200);
  });
  it('sums lifetime commission from events', () => {
    expect(k.commissionLifetime).toBe(1470);
  });
  it('splits this-month vs last-month commission around `now`', () => {
    expect(k.commissionThisMonth).toBe(870); // e2 + e3 (June)
    expect(k.commissionLastMonth).toBe(600); // e1 (May)
  });
  it('counts signups that joined in the current month', () => {
    expect(k.signupsThisMonth).toBe(1); // Cedar joined 2026-06
  });
});

describe('pctDelta', () => {
  it('computes percent change', () => {
    expect(pctDelta(150, 100)).toBe(50);
    expect(pctDelta(50, 100)).toBe(-50);
  });
  it('handles a zero base', () => {
    expect(pctDelta(0, 0)).toBe(0);
    expect(pctDelta(10, 0)).toBeNull();
  });
});

describe('monthlySeries', () => {
  it('buckets events by month, ascending', () => {
    const s = monthlySeries(events);
    expect(s.map((p) => p.month)).toEqual(['2026-05', '2026-06']);
    expect(s[1].commission).toBe(870);
    expect(s[1].volume).toBe(6200);
  });
});

describe('funnelStats', () => {
  it('steps clicks → signups → first order → repeat with relative rates', () => {
    const f = funnelStats({ clicks: 600, referrals });
    expect(f.map((s) => s.value)).toEqual([600, 3, 2, 1]);
    expect(f[1].rate).toBe(1);   // 3/600 → ~1% (rounded)
    expect(f[2].rate).toBe(67);  // 2/3
    expect(f[3].rate).toBe(50);  // 1/2
  });
});

describe('genCode', () => {
  it('derives an uppercased alnum code from a name', () => {
    expect(genCode('Jane Rivera')).toBe('JANERIVERA');
    expect(genCode('A.J. O’Neil!')).toBe('AJONEIL');
  });
  it('falls back when nothing usable remains', () => {
    expect(genCode('—')).toBe('PARTNER');
  });
  it('caps at 20 chars', () => {
    expect(genCode('abcdefghijklmnopqrstuvwxyz').length).toBe(20);
  });
});

describe('isCodeValid', () => {
  it('accepts 3–20 uppercase alnum codes', () => {
    expect(isCodeValid('JANE')).toBe(true);
    expect(isCodeValid('KOL2026')).toBe(true);
  });
  it('rejects bad codes', () => {
    expect(isCodeValid('ab')).toBe(false);       // too short
    expect(isCodeValid('jane')).toBe(false);     // lowercase
    expect(isCodeValid('JA NE')).toBe(false);    // space
    expect(isCodeValid('A'.repeat(21))).toBe(false); // too long
  });
});

describe('links', () => {
  it('builds a ref URL on the marketing origin', () => {
    expect(buildAffiliateUrl('JANE')).toBe('https://hevaseo.com/?ref=JANE');
  });
  it('builds a tracked deep link, normalising the path', () => {
    expect(buildDeepLink('JANE', 'services/backlink')).toBe('https://hevaseo.com/services/backlink?ref=JANE');
    expect(buildDeepLink('JANE', '/audit')).toBe('https://hevaseo.com/audit?ref=JANE');
  });
});
