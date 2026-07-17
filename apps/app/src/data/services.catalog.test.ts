import { describe, it, expect } from 'vitest';
import { SERVICE_CATALOG } from './services';
import { orderServices } from '@heva/catalog/orders';

/**
 * The dashboard and the marketing site must never quote different prices for the same package.
 *
 * They did. Five packages carried `price: 0` beside a `priceLabel: 'from $79'` on the public side and
 * the real number on the dashboard side. It went unnoticed because both surfaces quote those plans, so
 * the number was never charged — it was simply wrong somewhere nobody read. SERVICE_CATALOG now derives
 * its plans from @heva/catalog/orders, and these tests fail if anyone re-introduces a local copy.
 */

type AnySvc = { packages?: unknown[]; groups?: unknown[]; packageGroups?: unknown[] };
const flat = (svc: AnySvc | undefined): { id: string; price: number; priceLabel?: string }[] => [
  ...((svc?.packages ?? []) as never[]),
  ...((svc?.groups ?? []) as { packages?: never[] }[]).flatMap((g) => g.packages ?? []),
  ...((svc?.packageGroups ?? []) as { packages?: never[] }[]).flatMap((g) => g.packages ?? []),
];

/** dashboard ServiceKey → the shared catalog's slug. The only thing the two vocabularies disagree on. */
const PAIRS: [string, string][] = [
  ['audit', 'audit'],
  ['backlink', 'backlink'],
  ['content', 'content'],
  ['keyword', 'keyword-research'],
  ['optimize', 'website-optimization'],
  ['design', 'seo-web-design'],
  ['indexer', 'indexer'],
];

describe('service catalog is a single source of truth', () => {
  it.each(PAIRS)('%s: every package price matches the shared catalog', (dashKey, slug) => {
    const dash = flat((SERVICE_CATALOG as Record<string, AnySvc>)[dashKey]);
    const pub = flat((orderServices as unknown as Record<string, AnySvc>)[slug]);
    // same ground: no package may exist on only one side
    expect(dash.map((p) => p.id).sort()).toEqual(pub.map((p) => p.id).sort());
    for (const a of dash) {
      const b = pub.find((p) => p.id === a.id)!;
      expect(`${a.id}=${a.price}/${a.priceLabel ?? ''}`).toBe(`${b.id}=${b.price}/${b.priceLabel ?? ''}`);
    }
  });

  it('a price of 0 always means "quote me", never "free"', () => {
    // create_order rejects p_value <= 0 and the order action turns priceLabel plans into quotes, so a
    // 0 with no label would be a package nobody can buy and nobody can quote — a dead end, silently.
    for (const [dashKey] of PAIRS) {
      for (const p of flat((SERVICE_CATALOG as Record<string, AnySvc>)[dashKey])) {
        if (p.price === 0) expect(p.priceLabel, `${dashKey}/${p.id} is 0 with no priceLabel`).toBeTruthy();
      }
    }
  });

  it('a priceLabel that names a number agrees with the price', () => {
    // 'from $79' next to price: 0 is how the drift started. If the label says a number, the field says
    // the same number — the specialist quoting the job reads that field.
    for (const [dashKey] of PAIRS) {
      for (const p of flat((SERVICE_CATALOG as Record<string, AnySvc>)[dashKey])) {
        const m = p.priceLabel?.match(/\$([\d,]+)/);
        if (m) expect(p.price, `${dashKey}/${p.id} says "${p.priceLabel}"`).toBe(Number(m[1].replace(/,/g, '')));
      }
    }
  });
});
