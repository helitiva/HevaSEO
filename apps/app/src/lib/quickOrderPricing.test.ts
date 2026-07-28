import { describe, it, expect } from 'vitest';
import { getOrderService, priceQuickOrder } from '@heva/catalog/orders';

// chốt 1: the public checkout prices server-side from the shared catalog. These lock the prices the
// marketing site shows == the prices the server charges.
describe('priceQuickOrder', () => {
  it('prices a flat package by id (audit standard = $39)', () => {
    const s = getOrderService('audit')!;
    expect(priceQuickOrder(s, { packageId: 'standard' }).value).toBe(39);
    expect(priceQuickOrder(s, { packageId: 'standard' }).hasNumericTotal).toBe(true);
  });

  it('keyword-research starter = $19', () => {
    const s = getOrderService('keyword-research')!;
    expect(priceQuickOrder(s, { packageId: 'starter' }).value).toBe(19);
  });

  it('falls back to the first package when the id is unknown', () => {
    const s = getOrderService('audit')!;
    expect(priceQuickOrder(s, { packageId: 'does-not-exist' }).value).toBeGreaterThan(0);
  });

  it('adds a chosen add-on tier price on top of the package', () => {
    const s = getOrderService('audit')!;
    const base = priceQuickOrder(s, { packageId: 'standard' }).value;
    const addonId = (s.addons ?? [])[0];
    if (!addonId) return; // service has no add-ons → nothing to assert
    const withAddon = priceQuickOrder(s, { packageId: 'standard', addonPicks: { [addonId]: 'x' } });
    expect(withAddon.addonsTotal).toBeGreaterThan(0);
    expect(withAddon.value).toBe(base + withAddon.addonsTotal);
  });

  it('unknown service slug → undefined', () => {
    expect(getOrderService('nope')).toBeUndefined();
  });
});
