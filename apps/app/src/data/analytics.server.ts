import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { money, GEO, type ServiceMixRow, type RevKpi, type GeoRow } from '@/data/adminMock';
import { RECOGNIZED_STATES, isBookedState } from '@/data/adminRevenue.server';

// inc-analytics — real revenue analytics (admin RLS = all tenant orders). Derives KPIs + a 90-day daily
// series + service mix + revenue-by-source + top customers from real orders. Audience/geo panels stay
// mock (no events/geo data source).
//
// BOOKINGS vs RECOGNIZED. This page used to call booked order value "revenue" outright, and separately
// reported a "Completed value" that counted only state='completed' — so it showed $0 earned while
// Finance showed $296.02 for the very same orders. Both numbers now come from the same rule as the
// money book: booked on created_at, recognized on delivered_at (ASC 606). See adminRevenue.server.ts.
//
// It also anchored every window to MOCK_TODAY ('2026-06-24', the Phase-0 seed's "now") while real
// orders are dated now — so the 30d KPI read $0 and the 90-day chart was a flat zero line ending a
// month before the first real order. Real clock throughout.
const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#14b8a6'];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

/** A day on the analytics chart. `booked` = order value placed; `recognized` = value delivered. */
export interface AnalyticsPoint { iso: string; date: string; booked: number; recognized: number; orders: number }

export type AnalyticsData = {
  kpis: RevKpi[];
  daily: AnalyticsPoint[];
  serviceMix: ServiceMixRow[];
  bySource: { label: string; value: number; color: string }[];
  bySourceTotal: number;
  topCustomers: { id: string; name: string; company: string; spend: number }[];
};

type OrderRow = { value: number | string; service: string | null; source: string | null; state: string; created_at: string; delivered_at: string | null; customer_id: string | null };
type CustRow = { id: string; name: string | null; company: string | null };

export async function getAnalytics(): Promise<AnalyticsData> {
  const supabase = await createClient();
  const [ordersRes, custRes] = await Promise.all([
    supabase.from('orders').select('value, service, source, state, created_at, delivered_at, customer_id').returns<OrderRow[]>(),
    supabase.from('customers').select('id, name, company').returns<CustRow[]>(),
  ]);
  if (ordersRes.error) throw new Error(`getAnalytics: ${ordersRes.error.message}`);
  if (custRes.error) throw new Error(`getAnalytics customers: ${custRes.error.message}`);

  // was `!EXCLUDED.has(o.state)` with EXCLUDED = ['new','canceled'] — it silently dropped every
  // unconfirmed order, so this page's Bookings disagreed with the money book's. Same rule now.
  const orders = (ordersRes.data ?? []).filter((o) => isBookedState(o.state));
  const custById = new Map((custRes.data ?? []).map((c) => [c.id, c]));
  const isRecognized = (o: OrderRow) => !!o.delivered_at && (RECOGNIZED_STATES as readonly string[]).includes(o.state);

  const booked = orders.reduce((s, o) => s + Number(o.value), 0);
  const count = orders.length;
  const recognized = orders.filter(isRecognized).reduce((s, o) => s + Number(o.value), 0);
  const activeCustomers = new Set(orders.map((o) => o.customer_id).filter(Boolean)).size;

  // 30d vs prior-30d bookings delta, on the real clock
  const end = new Date();
  const d30 = new Date(end); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(end); d60.setDate(d60.getDate() - 60);
  const inRange = (ts: string, from: Date, to: Date) => { const t = new Date(ts); return t > from && t <= to; };
  const book30 = orders.filter((o) => inRange(o.created_at, d30, end)).reduce((s, o) => s + Number(o.value), 0);
  const bookPrev = orders.filter((o) => inRange(o.created_at, d60, d30)).reduce((s, o) => s + Number(o.value), 0);
  const delta = bookPrev > 0 ? Math.round(((book30 - bookPrev) / bookPrev) * 100) : undefined;
  const rec30 = orders.filter((o) => isRecognized(o) && inRange(o.delivered_at!, d30, end)).reduce((s, o) => s + Number(o.value), 0);

  const kpis: RevKpi[] = [
    { key: 'recognized', icon: 'ph-currency-circle-dollar', label: 'Revenue · recognized', value: money(recognized) },
    { key: 'booked', icon: 'ph-receipt', label: 'Bookings', value: money(booked), delta, deltaGood: (delta ?? 0) >= 0 },
    { key: 'orders', icon: 'ph-shopping-cart-simple', label: 'Orders', value: String(count) },
    { key: 'avg', icon: 'ph-scales', label: 'Avg order', value: money(count ? Math.round(booked / count) : 0) },
    { key: 'customers', icon: 'ph-users-three', label: 'Active customers', value: String(activeCustomers) },
    { key: 'rec30', icon: 'ph-calendar-check', label: 'Revenue · 30d', value: money(rec30) },
  ];

  // 90-day daily series (gaps filled with 0), on the real clock. Bookings land on the day the order was
  // placed; revenue lands on the day it was delivered — the same order shows up in both, on two dates.
  const byDay = new Map<string, { booked: number; recognized: number; orders: number }>();
  const bump = (iso: string, patch: Partial<{ booked: number; recognized: number; orders: number }>) => {
    const cur = byDay.get(iso) ?? { booked: 0, recognized: 0, orders: 0 };
    byDay.set(iso, { booked: cur.booked + (patch.booked ?? 0), recognized: cur.recognized + (patch.recognized ?? 0), orders: cur.orders + (patch.orders ?? 0) });
  };
  for (const o of orders) {
    bump(o.created_at.slice(0, 10), { booked: Number(o.value), orders: 1 });
    if (isRecognized(o)) bump(o.delivered_at!.slice(0, 10), { recognized: Number(o.value) });
  }
  const daily: AnalyticsPoint[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const b = byDay.get(iso) ?? { booked: 0, recognized: 0, orders: 0 };
    daily.push({ iso, date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ...b });
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

// Support stats (SupportStats panel) — real from tickets (admin RLS). answeredToday = a reply today on
// the real clock (it was MOCK_TODAY, so it could only ever count replies dated 2026-06-24);
// avgFirstResponseH ≈ created_at → last_reply_at (hours) over replied tickets.
export type SupportStats = { open: number; pending: number; resolved: number; closed: number; answeredToday: number; avgFirstResponseH: number };

export async function getSupportStats(): Promise<SupportStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('tickets').select('status, created_at, last_reply_at')
    .returns<{ status: string; created_at: string; last_reply_at: string | null }[]>();
  if (error) throw new Error(`getSupportStats: ${error.message}`);
  const rows = data ?? [];
  const by = (s: string) => rows.filter((t) => t.status === s).length;
  const replied = rows.filter((t) => t.last_reply_at);
  const today = new Date().toISOString().slice(0, 10);
  const answeredToday = replied.filter((t) => t.last_reply_at!.slice(0, 10) === today).length;
  const avgFirstResponseH = replied.length
    ? Math.round((10 * replied.reduce((s, t) => s + (new Date(t.last_reply_at!).getTime() - new Date(t.created_at).getTime()) / 3_600_000, 0)) / replied.length) / 10
    : 0;
  return { open: by('open'), pending: by('pending'), resolved: by('resolved'), closed: by('closed'), answeredToday, avgFirstResponseH };
}

// Customers by country (GeoPanel) — real counts (admin RLS) joined to static display meta (flag/name/map
// coords) from the GEO lookup; unknown ISOs fall back to a neutral marker.
export async function getGeoStats(): Promise<GeoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('customers').select('country_iso').returns<{ country_iso: string | null }[]>();
  if (error) throw new Error(`getGeoStats: ${error.message}`);
  const meta = new Map(GEO.map((g) => [g.isoNum, g]));
  const counts = new Map<string, number>();
  for (const c of data ?? []) if (c.country_iso) counts.set(c.country_iso, (counts.get(c.country_iso) ?? 0) + 1);
  return [...counts.entries()]
    .map(([iso, users]): GeoRow => { const m = meta.get(iso); return m ? { ...m, users } : { country: iso, flag: '🌐', users, x: 0.5, y: 0.5, isoNum: iso }; })
    .sort((a, b) => b.users - a.users);
}
