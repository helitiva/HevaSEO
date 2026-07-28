import { describe, it, expect } from 'vitest';
import { portalDataFor, DEFAULT_AFFILIATE_ID } from './affiliatePortal';
import { adminAffiliates } from './adminAffiliate';

describe('portalDataFor', () => {
  it('returns the authored demo partner for the default id', () => {
    const d = portalDataFor(DEFAULT_AFFILIATE_ID);
    expect(d.affiliate.code).toBe('JANESEO');
    expect(d.referrals.length).toBeGreaterThan(0);
  });

  it('falls back to the demo partner for an unknown id', () => {
    expect(portalDataFor('nope').affiliate.code).toBe('JANESEO');
  });

  it('synthesises a partner whose totals match their admin aggregates', () => {
    const marco = adminAffiliates().find((a) => a.id === 'af-marco')!;
    const d = portalDataFor('af-marco');

    expect(d.affiliate.code).toBe(marco.code);
    expect(d.referrals).toHaveLength(marco.refs);
    // referred volume reconciles exactly with the admin number
    expect(d.referrals.reduce((s, r) => s + r.volume, 0)).toBe(marco.volume);
    // commission events reconcile exactly with the admin number
    expect(d.events.reduce((s, e) => s + e.amount, 0)).toBe(marco.commission);
  });

  it('handles a partner with no referrals (synthesises an empty portal)', () => {
    // Pending partners have zero refs/volume — must not throw, just render empty.
    const lena = adminAffiliates().find((a) => a.id === 'af-lena')!;
    const d = portalDataFor('af-lena');
    expect(lena.refs).toBe(0);
    expect(d.referrals).toHaveLength(0);
    expect(d.events).toHaveLength(0);
  });
});
