import { resolveAddOns } from '@heva/catalog';
import { MEMBERSHIP_DISCOUNT } from '@/data/mock';
import type { SvcCatalog } from '@/data/services';

// Lane B inc-B2 — the single source of truth for an order's price, ported verbatim from the formula
// in ServiceOrder.tsx so the SERVER can reprice an order (the DB create_order trusts p_value, so the
// price must be computed server-side, never taken from the client). Pure + unit-tested. Mirrors:
// subtotal (base / usage-rate×qty / bulk per-unit×qty) − bulk discount + add-on bumps − VIP 15%.

export type OrderSelection = {
  packageId?: string;
  qty?: number;
  /** addonId → chosen tierId (the customer's upsell picks) */
  addonPicks?: Record<string, string>;
  /** the customer's VIP membership status (15% off numeric totals) */
  isVip?: boolean;
};

export type PriceBreakdown = {
  value: number;          // final charge (what create_order debits)
  subtotal: number;
  bulkDiscount: number;
  addonsTotal: number;
  vipOff: number;
  /** false for "Consult"/"Custom quote" packages (priceLabel set, non-usage) → no numeric charge */
  hasNumericTotal: boolean;
};

export function computeOrderPrice(catalog: SvcCatalog, sel: OrderSelection): PriceBreakdown {
  const allPackages = catalog.groups ? catalog.groups.flatMap((g) => g.packages) : (catalog.packages ?? []);
  const plan = allPackages.find((p) => p.id === sel.packageId) ?? allPackages[0];
  const isUsage = !!catalog.usage;
  const qty = sel.qty ?? catalog.usage?.defaultQty ?? catalog.bulk?.defaultQty ?? 1;

  // usage: rate from the highest tier whose `min` the count meets
  let usageRate = 0;
  if (catalog.usage) {
    usageRate = catalog.usage.tiers[0]?.rate ?? 0;
    for (const t of catalog.usage.tiers) if (qty >= t.min) usageRate = t.rate;
  }

  const subtotal = isUsage ? usageRate * qty : catalog.bulk ? (plan?.price ?? 0) * qty : (plan?.price ?? 0);
  const bulkDiscount = catalog.bulk && qty >= catalog.bulk.minDiscountQty
    ? Math.round(subtotal * catalog.bulk.discountPct) / 100
    : 0;

  const picks = sel.addonPicks ?? {};
  const addonsTotal = resolveAddOns(catalog.addons ?? [])
    .filter((a) => a.id in picks)
    .reduce((s, a) => s + ((a.tiers.find((t) => t.id === picks[a.id]) ?? a.tiers[0]).price), 0);

  const total = subtotal - bulkDiscount + addonsTotal;
  const hasNumericTotal = isUsage || !plan?.priceLabel;
  const vipOff = sel.isVip && hasNumericTotal
    ? (isUsage ? Math.round(total * MEMBERSHIP_DISCOUNT * 100) / 100 : Math.round(total * MEMBERSHIP_DISCOUNT))
    : 0;

  return { value: total - vipOff, subtotal, bulkDiscount, addonsTotal, vipOff, hasNumericTotal };
}
