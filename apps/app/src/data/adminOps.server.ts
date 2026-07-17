import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OpsKpi, PipelineStage, OrderStatus } from '@/data/adminMock';

/**
 * The Command Center's operational numbers — real, RLS-scoped (admin → whole tenant). These used to come
 * from adminMock constants, so the dashboard reported a fixed $18,650/6-new-orders no matter what the
 * business actually did. Everything here is derived from the orders + tickets tables, on the REAL clock
 * (the Phase-0 MOCK_TODAY anchor would put "today" in June while live orders are dated now).
 */

type OrderRow = { state: string; assignee_id: string | null; deadline: string | null; created_at: string; delivered_at: string | null };

export interface OpsSnapshot {
  kpis: OpsKpi[];
  pipeline: PipelineStage[];
  openTickets: number;
  pendingTickets: number;
  /** completed ÷ (completed + late) over delivered work — the on-time ring. null when there's nothing to judge. */
  onTimePct: number | null;
  /** share of pod capacity in use (active orders ÷ Σ staff capacity). */
  capacityPct: number | null;
}

const STAGES: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'internal_review', label: 'Review' },
  { status: 'changes_requested', label: 'Changes' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'approved', label: 'Approved' },
  { status: 'completed', label: 'Completed' },
];
const ACTIVE = ['new', 'confirmed', 'assigned', 'in_progress', 'internal_review', 'changes_requested'];

/** Counts per day over the last 7 days — the sparkline under each KPI tile. */
function trendOf(rows: OrderRow[], now: Date, match: (r: OrderRow) => boolean): number[] {
  const out: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push(rows.filter((r) => r.created_at.slice(0, 10) === d && match(r)).length);
  }
  return out;
}

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const supabase = await createClient();
  const [ordersRes, ticketsRes, staffRes] = await Promise.all([
    supabase.from('orders').select('state, assignee_id, deadline, created_at, delivered_at').returns<OrderRow[]>(),
    supabase.from('tickets').select('status').returns<{ status: string }[]>(),
    supabase.from('staff_details').select('capacity, active').returns<{ capacity: number; active: boolean }[]>(),
  ]);
  if (ordersRes.error) throw new Error(`getOpsSnapshot orders: ${ordersRes.error.message}`);

  const orders = ordersRes.data ?? [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const live = orders.filter((o) => o.state !== 'canceled');
  const isOverdue = (o: OrderRow) => !!o.deadline && o.deadline.slice(0, 10) < today && ACTIVE.includes(o.state);
  const newOrders = live.filter((o) => o.state === 'new');
  const wip = live.filter((o) => o.state === 'in_progress');
  const overdue = live.filter(isOverdue);
  const unassigned = live.filter((o) => !o.assignee_id && ACTIVE.includes(o.state));

  const kpis: OpsKpi[] = [
    { key: 'new', icon: 'ph-tray', label: 'New orders', value: newOrders.length, trend: trendOf(live, now, (o) => o.state === 'new'), delta: 0, deltaGood: true, tone: 'primary' },
    { key: 'wip', icon: 'ph-spinner-gap', label: 'In progress', value: wip.length, trend: trendOf(live, now, (o) => o.state === 'in_progress'), delta: 0, deltaGood: true, tone: 'primary' },
    { key: 'overdue', icon: 'ph-warning', label: 'Overdue', value: overdue.length, trend: trendOf(live, now, isOverdue), delta: 0, deltaGood: false, tone: 'warn' },
    { key: 'unassigned', icon: 'ph-user-minus', label: 'Unassigned', value: unassigned.length, trend: trendOf(live, now, (o) => !o.assignee_id), delta: 0, deltaGood: true, tone: 'warn' },
  ];

  const pipeline: PipelineStage[] = STAGES
    .map((s) => ({ ...s, count: orders.filter((o) => o.state === s.status).length }))
    .filter((s) => s.count > 0);

  const tickets = ticketsRes.data ?? [];
  const staff = (staffRes.data ?? []).filter((s) => s.active);
  const capacity = staff.reduce((s, x) => s + (Number(x.capacity) || 0), 0);
  const activeCount = live.filter((o) => ACTIVE.includes(o.state)).length;

  // on-time: of the work that has left the building, how much made its deadline. Judged on the day it was
  // actually DELIVERED vs the deadline — not against today, which would keep marking long-since-delivered
  // work "late" simply because its deadline has passed.
  const shipped = live.filter((o) => ['delivered', 'approved', 'completed'].includes(o.state) && o.delivered_at);
  const late = shipped.filter((o) => !!o.deadline && o.delivered_at!.slice(0, 10) > o.deadline.slice(0, 10));

  return {
    kpis,
    pipeline,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    pendingTickets: tickets.filter((t) => t.status === 'pending').length,
    onTimePct: shipped.length ? Math.round(((shipped.length - late.length) / shipped.length) * 100) : null,
    capacityPct: capacity ? Math.min(100, Math.round((activeCount / capacity) * 100)) : null,
  };
}
