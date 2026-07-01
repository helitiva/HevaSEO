import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { money, MOCK_TODAY, type RevenuePoint, type ServiceMixRow, type RevKpi } from '@/data/adminMock';

// inc-analytics — real revenue analytics (admin RLS = all tenant orders). Derives KPIs + a 90-day daily
// series + service mix + revenue-by-source + top customers from real orders. Audience/geo/support panels
// stay mock (no events/geo/tickets data source). "Revenue" = booked order value, excluding new/canceled.
const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#14b8a6'];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];
const EXCLUDED = new Set(['new', 'canceled']);

export type AnalyticsData = {
  kpis: RevKpi[];
  daily: RevenuePoint[];
  serviceMix: ServiceMixRow[];
  bySource: { label: string; value: number; color: string }[];
  bySourceTotal: number;
  topCustomers: { id: string; name: string; company: string; spend: number }[];
};

type OrderRow = { value: number | string; service: string | null; source: string | null; state: string; created_at: string; customer_id: string | null };
type CustRow = { id: string; name: string | null; company: string | null };

export async function getAnalytics(): Promise<AnalyticsData> {
  const supabase = await createClient();
  const [ordersRes, custRes] = await Promise.all([
    supabase.from('orders').select('value, service, source, state, created_at, customer_id').returns<OrderRow[]>(),
    supabase.from('customers').select('id, name, company').returns<CustRow[]>(),
  ]);
  if (ordersRes.error) throw new Error(`getAnalytics: ${ordersRes.error.message}`);
  if (custRes.error) throw new Error(`getAnalytics customers: ${custRes.error.message}`);

  const orders = (ordersRes.data ?? []).filter((o) => !EXCLUDED.has(o.state));
  const custById = new Map((custRes.data ?? []).map((c) => [c.id, c]));

  const revenue = orders.reduce((s, o) => s + Number(o.value), 0);
  const count = orders.length;
  const completed = orders.filter((o) => o.state === 'completed').reduce((s, o) => s + Number(o.value), 0);
  const activeCustomers = new Set(orders.map((o) => o.customer_id).filter(Boolean)).size;

  // 30d vs prior-30d revenue delta, anchored to MOCK_TODAY (the seed's "now")
  const end = new Date(`${MOCK_TODAY}T23:59:59`);
  const d30 = new Date(end); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(end); d60.setDate(d60.getDate() - 60);
  const inRange = (o: OrderRow, from: Date, to: Date) => { const t = new Date(o.created_at); return t > from && t <= to; };
  const rev30 = orders.filter((o) => inRange(o, d30, end)).reduce((s, o) => s + Number(o.value), 0);
  const revPrev = orders.filter((o) => inRange(o, d60, d30)).reduce((s, o) => s + Number(o.value), 0);
  const delta = revPrev > 0 ? Math.round(((rev30 - revPrev) / revPrev) * 100) : undefined;

  const kpis: RevKpi[] = [
    { key: 'revenue', icon: 'ph-currency-circle-dollar', label: 'Booked revenue', value: money(revenue), delta, deltaGood: (delta ?? 0) >= 0 },
    { key: 'orders', icon: 'ph-shopping-cart-simple', label: 'Orders', value: String(count) },
    { key: 'avg', icon: 'ph-scales', label: 'Avg order', value: money(count ? Math.round(revenue / count) : 0) },
    { key: 'completed', icon: 'ph-check-circle', label: 'Completed value', value: money(completed) },
    { key: 'customers', icon: 'ph-users-three', label: 'Active customers', value: String(activeCustomers) },
    { key: 'rev30', icon: 'ph-calendar-check', label: 'Revenue · 30d', value: money(rev30), delta, deltaGood: (delta ?? 0) >= 0 },
  ];

  // 90-day daily series (fill gaps with 0), anchored to MOCK_TODAY
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const iso = new Date(o.created_at).toISOString().slice(0, 10);
    const cur = byDay.get(iso) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.value); cur.orders += 1; byDay.set(iso, cur);
  }
  const daily: RevenuePoint[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const b = byDay.get(iso) ?? { revenue: 0, orders: 0 };
    daily.push({ iso, date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: b.revenue, orders: b.orders });
  }

  // service mix
  const svc = new Map<string, { orders: number; value: number }>();
  for (const o of orders) { const k = o.service ?? '—'; const c = svc.get(k) ?? { orders: 0, value: 0 }; c.orders += 1; c.value += Number(o.value); svc.set(k, c); }
  const serviceMix: ServiceMixRow[] = [...svc.entries()].sort((a, b) => b[1].value - a[1].value)
    .map(([service, v], i) => ({ service, orders: v.orders, value: v.value, color: colorFor(i) }));

  // revenue by source
  const src = new Map<string, number>();
  for (const o of orders) { const k = o.source ?? 'other'; src.set(k, (src.get(k) ?? 0) + Number(o.value)); }
  const bySource = [...src.entries()].sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: colorFor(i) }));
  const bySourceTotal = bySource.reduce((s, x) => s + x.value, 0);

  // top customers by booked spend
  const spend = new Map<string, number>();
  for (const o of orders) if (o.customer_id) spend.set(o.customer_id, (spend.get(o.customer_id) ?? 0) + Number(o.value));
  const topCustomers = [...spend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, s]) => {
    const c = custById.get(id);
    return { id, name: c?.name ?? 'Customer', company: c?.company ?? '', spend: s };
  });

  return { kpis, daily, serviceMix, bySource, bySourceTotal, topCustomers };
}
