import { Suspense } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { ServiceMix } from '@/components/admin/ServiceMix';
import { GeoPanel } from '@/components/admin/GeoPanel';
import { AudienceAnalytics } from '@/components/admin/AudienceAnalytics';
import { SupportStats } from '@/components/admin/SupportStats';
import { TeamPerformance } from '@/components/admin/TeamPerformance';
import { Donut } from '@/components/admin/Donut';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { PeriodSelector } from './PeriodSelector';
import { money, type RevKpi } from '@/data/adminMock';
import { getAnalytics, getSupportStats, getGeoStats } from '@/data/analytics.server';
import { getStaff } from '@/data/staff.server';

export const metadata = { title: 'Analytics' };

// inc-analytics — revenue section reads REAL aggregates from orders (getAnalytics); audience/geo/support
// panels stay mock (no events/geo/tickets data source).
export default async function AnalyticsPage() {
  const [a, staff, support, geo] = await Promise.all([getAnalytics(), getStaff(), getSupportStats(), getGeoStats()]);
  const srcSegs = a.bySource;
  const srcTotal = a.bySourceTotal || 1;
  const topRev = a.topCustomers;
  const maxSpend = Math.max(...topRev.map((c) => c.spend), 1);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Revenue, audience &amp; performance"
        actions={<Suspense><PeriodSelector /></Suspense>}
      />

      {/* ---- Revenue (lead) ---- */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {a.kpis.map((k) => <RevTile key={k.key} kpi={k} />)}
      </div>

      <RevenueChart data={a.daily} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-shopping-cart-simple text-primary" aria-hidden /> Revenue by source</p>
          <div className="flex items-center gap-4">
            <Donut segs={srcSegs} centerValue={money(srcTotal)} centerLabel="MTD" size={120} />
            <div className="space-y-2 text-xs">
              {srcSegs.map((s) => (
                <div key={s.label}>
                  <p className="flex items-center gap-1.5 font-medium"><span className="legend-dot" style={{ background: s.color }} />{s.label}</p>
                  <p className="text-muted-foreground">{money(s.value)} · {Math.round((s.value / srcTotal) * 100)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ServiceMix data={a.serviceMix} />

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-crown-simple text-primary" aria-hidden /> Top revenue</p>
            <Link href="/admin/customers" className="text-xs font-semibold text-primary hover:underline">All →</Link>
          </div>
          <div className="space-y-2.5">
            {topRev.map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between text-xs">
                  <CustomerHoverCard customer={c.id}><span className="truncate font-medium hover:underline">{c.name} <span className="text-muted-foreground">· {c.company}</span></span></CustomerHoverCard>
                  <span className="shrink-0 font-semibold">{money(c.spend)}</span>
                </div>
                <div className="bar mt-1"><i style={{ width: `${(c.spend / maxSpend) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Audience ---- */}
      <AudienceAnalytics />

      {/* ---- Performance & reach ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SupportStats stats={support} />
        <div className="lg:col-span-2"><TeamPerformance staff={staff} /></div>
      </div>
      <GeoPanel data={geo} />
    </section>
  );
}

function RevTile({ kpi }: { kpi: RevKpi }) {
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{kpi.label}</p>
          <p className="display mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
        </div>
        <i className={`ph-bold ${kpi.icon} text-lg text-primary`} />
      </div>
      {kpi.delta != null && (
        <div className="mt-auto pt-2">
          <span className={`pill ${kpi.deltaGood ? 'pill-live' : 'pill-warn'}`}>{kpi.delta > 0 ? '+' : ''}{kpi.delta}%</span>
        </div>
      )}
    </div>
  );
}
