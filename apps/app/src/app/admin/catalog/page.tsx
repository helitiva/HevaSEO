import { SERVICE_CATALOG } from '@/data/services';
import type { SvcPackage, SvcGroup } from '@/data/services';
import { CatalogClient } from './CatalogClient';
import type { SvcRow, PkgRow, GroupRow, TierRow } from './CatalogClient';

export const metadata = { title: 'Catalog' };

function pkgToRow(p: SvcPackage, groupId: string | null = null, groupTitle: string | null = null): PkgRow {
  const price = p.price ?? 0;
  return {
    id: p.id,
    name: p.name,
    price,
    priceLabel: p.priceLabel ?? (price > 0 ? `$${price}` : 'Custom'),
    sla: p.sla,
    popular: p.popular ?? false,
    features: p.features,
    groupId,
    groupTitle,
  };
}

function groupToRow(g: SvcGroup): GroupRow {
  return {
    id: g.id,
    title: g.title,
    subtitle: g.subtitle ?? null,
    icon: g.icon ?? null,
    packages: g.packages.map(p => pkgToRow(p, g.id, g.title)),
  };
}

export default function CatalogPage() {
  const rows: SvcRow[] = Object.values(SERVICE_CATALOG).map(s => {
    const hasUsage = !!s.usage;
    const hasGroups = !!(s.groups?.length);
    const hasBulk = !!s.bulk;

    const groups: GroupRow[] = (s.groups ?? []).map(groupToRow);

    const packages: PkgRow[] = hasGroups
      ? groups.flatMap(g => g.packages)
      : (s.packages ?? []).map(p => pkgToRow(p));

    const usageTiers: TierRow[] = (s.usage?.tiers ?? []).map(t => ({
      label: t.label,
      rate: t.rate,
      min: t.min,
      sub: t.sub ?? null,
    }));

    const paid = packages.map(p => p.price).filter(p => p > 0);
    const priceMin = paid.length ? Math.min(...paid) : 0;
    const priceMax = paid.length ? Math.max(...paid) : 0;

    let priceLabel: string;
    if (hasUsage) {
      const firstTier = s.usage?.tiers[0];
      priceLabel = firstTier ? `from $${firstTier.rate}/link` : 'Usage-based';
    } else if (paid.length === 0) {
      priceLabel = packages.length ? 'Custom' : '—';
    } else if (priceMin === priceMax) {
      priceLabel = `$${priceMin}`;
    } else {
      priceLabel = `$${priceMin}–$${priceMax}`;
    }

    return {
      key: s.key,
      name: s.name,
      tagline: s.tagline,
      icon: s.icon,
      orderCode: s.orderCode,
      packageCount: packages.length,
      priceMin,
      priceMax,
      priceLabel,
      hasBulk,
      hasUsage,
      hasGroups,
      addons: s.addons ?? [],
      packages,
      groups,
      usageTiers,
    };
  });

  const totalPackages = rows.reduce((sum, r) => sum + r.packageCount, 0);
  const allPrices = rows.flatMap(r => r.packages.map(p => p.price)).filter(p => p > 0);
  const globalMin = allPrices.length ? Math.min(...allPrices) : 0;
  const globalMax = allPrices.length ? Math.max(...allPrices) : 0;

  return (
    <CatalogClient
      rows={rows}
      totalPackages={totalPackages}
      priceMin={globalMin}
      priceMax={globalMax}
    />
  );
}
