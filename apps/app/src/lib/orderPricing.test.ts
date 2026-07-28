import { describe, it, expect } from 'vitest';
import { computeOrderPrice } from './orderPricing';
import type { SvcCatalog } from '@/data/services';

// Minimal catalog fixtures — computeOrderPrice only reads packages/groups/bulk/usage/addons.
const cat = (c: Partial<SvcCatalog>): SvcCatalog => c as SvcCatalog;

const flat = cat({ packages: [
  { id: 'std', name: 'Standard', price: 39, sla: '5d', summary: '', features: [] },
  { id: 'pro', name: 'Pro', price: 79, sla: '3d', summary: '', features: [] },
] });

const consult = cat({ packages: [
  { id: 'ent', name: 'Enterprise', price: 0, priceLabel: 'Custom quote', sla: '—', summary: '', features: [] },
] });

const bulk = cat({
  packages: [{ id: 'kw', name: 'Per keyword', price: 2, sla: '5d', summary: '', features: [] }],
  bulk: { unit: 'kw', unitPlural: 'kws', countNoun: 'keywords', minDiscountQty: 50, discountPct: 10, defaultQty: 10 },
});

const usage = cat({
  usage: { unit: 'url', unitPlural: 'urls', countNoun: 'URLs', defaultQty: 100,
    tiers: [{ min: 1, rate: 0.5, label: '' }, { min: 100, rate: 0.3, label: '' }, { min: 1000, rate: 0.1, label: '' }] },
});

describe('computeOrderPrice', () => {
  it('flat package: picks the selected package price', () => {
    expect(computeOrderPrice(flat, { packageId: 'pro' }).value).toBe(79);
    expect(computeOrderPrice(flat, { packageId: 'std' }).value).toBe(39);
  });

  it('unknown/missing packageId falls back to the first package', () => {
    expect(computeOrderPrice(flat, {}).value).toBe(39);
  });

  it('Consult/quote package → no numeric total, no VIP discount', () => {
    const p = computeOrderPrice(consult, { packageId: 'ent', isVip: true });
    expect(p.hasNumericTotal).toBe(false);
    expect(p.vipOff).toBe(0);
    expect(p.value).toBe(0);
  });

  it('bulk: per-unit × qty, with discount once qty ≥ minDiscountQty', () => {
    expect(computeOrderPrice(bulk, { packageId: 'kw', qty: 10 }).value).toBe(20);      // 2×10, below threshold
    // 2×50 = 100; discountPct 10 → round(100*10)/100 = 10 (a 10% discount)
    const big = computeOrderPrice(bulk, { packageId: 'kw', qty: 50 });
    expect(big.subtotal).toBe(100);
    expect(big.bulkDiscount).toBe(10);
    expect(big.value).toBe(90);
  });

  it('usage: highest tier rate whose min ≤ qty, × qty', () => {
    expect(computeOrderPrice(usage, { qty: 50 }).value).toBeCloseTo(25, 5);   // 0.5×50
    expect(computeOrderPrice(usage, { qty: 100 }).value).toBeCloseTo(30, 5);  // 0.3×100
    expect(computeOrderPrice(usage, { qty: 1000 }).value).toBeCloseTo(100, 5);// 0.1×1000
  });

  it('add-ons: adds the chosen tier price (real @heva/catalog addon)', () => {
    const withAddon = cat({ ...flat, addons: ['content'] });
    const p = computeOrderPrice(withAddon, { packageId: 'std', addonPicks: { content: 'a5' } });
    expect(p.addonsTotal).toBe(54);   // content/a5 = $54
    expect(p.value).toBe(39 + 54);
  });

  it('ignores addon picks not offered by the catalog', () => {
    const p = computeOrderPrice(flat, { packageId: 'std', addonPicks: { content: 'a5' } });
    expect(p.addonsTotal).toBe(0);    // flat has no addons
    expect(p.value).toBe(39);
  });

  it('VIP: 15% off a numeric flat total (rounded)', () => {
    const p = computeOrderPrice(flat, { packageId: 'pro', isVip: true });
    expect(p.vipOff).toBe(Math.round(79 * 0.15)); // 12
    expect(p.value).toBe(79 - Math.round(79 * 0.15));
  });

  it('non-VIP pays full price', () => {
    expect(computeOrderPrice(flat, { packageId: 'pro', isVip: false }).vipOff).toBe(0);
  });
});
