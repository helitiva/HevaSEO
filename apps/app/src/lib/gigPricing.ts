import { ORDERS } from '@/data/adminMock';
import { gigKey } from './payOverrides';

// Customer-facing price of each gig, derived from the order data — the same source GIG_PACKAGES
// comes from, so service/package names always match. Lets the admin see what a gig sells for
// right next to the pay rate they set for it. Phase-0: list price = the highest value seen for
// that combo (discounted orders shouldn't drag the headline price down).
const PKG_PRICE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const o of ORDERS) {
    const k = gigKey(o.service, o.pkg);
    if (o.value > (m[k] ?? 0)) m[k] = o.value;
  }
  return m;
})();

export function packagePrice(service: string, pkg: string): number | undefined {
  return PKG_PRICE[gigKey(service, pkg)];
}

// The price span across a service's packages, for the service-level row.
export function servicePriceRange(service: string): [number, number] | undefined {
  const vals = ORDERS.filter((o) => o.service === service).map((o) => o.value);
  if (vals.length === 0) return undefined;
  return [Math.min(...vals), Math.max(...vals)];
}
