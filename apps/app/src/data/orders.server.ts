import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminOrder } from '@/data/adminMock';
import type { Order } from '@/data/mock';
import type { OrderDetailExtra } from '@/lib/orderDetail';
import type { Json } from '@/lib/supabase/database.types';
import {
  UUID_RE, toAdminOrder, toMgrOrder, toCustomerOrder,
  type OrderRow, type MgrOrderRow, type MyOrderRow,
} from '@/lib/orderMap';

// RLS-scoped order reads (the seam that replaced the synchronous mocks). Each query is auto-scoped by
// the caller's JWT (admin → all tenant orders, customer → own, staff/manager → money-stripped view).
// Pure row→model mapping lives in lib/orderMap.ts (unit-tested there); this file is just I/O.

const ORDER_SELECT =
  'id, code, service, pkg, state, priority, source, value, deadline, created_at, customers(id, name, company), assignee:profiles!orders_assignee_id_fkey(name)';

export async function getOrders(): Promise<AdminOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .returns<OrderRow[]>();

  if (error) throw new Error(`getOrders: ${error.message}`);
  return (data ?? []).map(toAdminOrder);
}

/** Single order by id, RLS-scoped (returns null if not visible to the caller or id isn't a uuid). */
export async function getOrderById(id: string): Promise<AdminOrder | null> {
  if (!UUID_RE.test(id)) return null; // legacy mock ids ('o1') aren't in the DB
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
    .returns<OrderRow | null>();

  if (error) throw new Error(`getOrderById: ${error.message}`);
  return data ? toAdminOrder(data) : null;
}

// Money-blind reads via the orders_mgr view (omits value; its WHERE is the access gate).
const MGR_ORDER_SELECT =
  'id, code, service, pkg, state, priority, source, deadline, created_at, customer_id, customer_name, customer_company, assignee:profiles!orders_assignee_id_fkey(name)';

/** Pod/own orders via the money-stripped view (manager → tenant; staff → own assigned). */
export async function getPodOrders(): Promise<AdminOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders_mgr')
    .select(MGR_ORDER_SELECT)
    .order('created_at', { ascending: false })
    .returns<MgrOrderRow[]>();

  if (error) throw new Error(`getPodOrders: ${error.message}`);
  return (data ?? []).map(toMgrOrder);
}

/** Single money-stripped order by id (the view's WHERE is the visibility gate). */
export async function getPodOrderById(id: string): Promise<AdminOrder | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders_mgr')
    .select(MGR_ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
    .returns<MgrOrderRow | null>();

  if (error) throw new Error(`getPodOrderById: ${error.message}`);
  return data ? toMgrOrder(data) : null;
}

/** An order's extras: non-money brief (order_details, inc-5b) + paid addons (order_addons, inc-5c).
 *  Both RLS-scoped; addons come back empty for money-blind viewers (manager/staff) so prices never
 *  reach them. Returns null only when there's no order_details row. */
export async function getOrderDetail(orderId: string): Promise<OrderDetailExtra | null> {
  if (!UUID_RE.test(orderId)) return null;
  const supabase = await createClient();
  const [det, add] = await Promise.all([
    supabase.from('order_details').select('project, folder, brief, included').eq('order_id', orderId).maybeSingle(),
    supabase.from('order_addons').select('name, tier, price').eq('order_id', orderId),
  ]);
  if (det.error) throw new Error(`getOrderDetail: ${det.error.message}`);
  if (add.error) throw new Error(`getOrderDetail addons: ${add.error.message}`);
  if (!det.data) return null;
  return {
    project: det.data.project,
    folder: det.data.folder,
    brief: Array.isArray(det.data.brief) ? (det.data.brief as OrderDetailExtra['brief']) : [],
    included: det.data.included ?? [],
    addons: (add.data ?? []).map((a) => ({ name: a.name, tier: a.tier ?? '', price: Number(a.price) })),
  };
}

/** Order details for many orders in one round-trip (RLS-scoped) → keyed by order id. Used by the review
 *  board + assignment queue so their site/project/brief reflect the customer's real intake, not defaults. */
export async function getOrderDetailsByIds(ids: string[]): Promise<Map<string, OrderDetailExtra>> {
  const map = new Map<string, OrderDetailExtra>();
  const valid = ids.filter((id) => UUID_RE.test(id));
  if (!valid.length) return map;
  const supabase = await createClient();
  const [det, add] = await Promise.all([
    supabase.from('order_details').select('order_id, project, folder, brief, included').in('order_id', valid),
    supabase.from('order_addons').select('order_id, name, tier, price').in('order_id', valid),
  ]);
  if (det.error) throw new Error(`getOrderDetailsByIds: ${det.error.message}`);
  const addByOrder = new Map<string, OrderDetailExtra['addons']>();
  for (const a of add.data ?? []) {
    const arr = addByOrder.get(a.order_id) ?? [];
    arr.push({ name: a.name, tier: a.tier ?? '', price: Number(a.price) });
    addByOrder.set(a.order_id, arr);
  }
  for (const d of det.data ?? []) {
    map.set(d.order_id, {
      project: d.project,
      folder: d.folder,
      brief: Array.isArray(d.brief) ? (d.brief as OrderDetailExtra['brief']) : [],
      included: d.included ?? [],
      addons: addByOrder.get(d.order_id) ?? [],
    });
  }
  return map;
}

/** The signed-in customer's orders that belong to a given project (via order_details.project_id FK). Powers
 *  the project detail page so it lists the project's REAL orders instead of matching mock rows by domain. */
export async function getMyOrdersByProject(projectId: string): Promise<Order[]> {
  if (!UUID_RE.test(projectId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('code, service, pkg, state, priority, value, deadline, created_at, delivered_at, customers(company, name), assignee:profiles!orders_assignee_id_fkey(name), order_details!inner(project, folder, title, site, brief, project_id, proj:projects(domain))')
    .eq('order_details.project_id', projectId)
    .neq('state', 'canceled')
    .order('created_at', { ascending: false })
    .returns<MyOrderRow[]>();

  if (error) throw new Error(`getMyOrdersByProject: ${error.message}`);
  return (data ?? []).map(toCustomerOrder);
}

/** The signed-in customer's own orders, shaped for the dashboard board (excludes canceled). */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('code, service, pkg, state, priority, value, deadline, created_at, delivered_at, customers(company, name), assignee:profiles!orders_assignee_id_fkey(name), order_details(project, folder, title, site, brief, proj:projects(domain))')
    .neq('state', 'canceled')
    .order('created_at', { ascending: false })
    .returns<MyOrderRow[]>();

  if (error) throw new Error(`getMyOrders: ${error.message}`);
  return (data ?? []).map(toCustomerOrder);
}

/** The signed-in customer's orders that have been DELIVERED and are awaiting their approve / send-back
 * decision (delivered → approved | changes_requested). RLS scopes this to the customer's own orders;
 * `deliverables` is auto-filtered to the approved version they may read. `deliveredAt` drives the
 * auto-approve countdown (kept in sync with auto_approve_stale_deliveries' 7-day default). */
export type DeliveredOrder = {
  id: string; code: string; service: string; deliveredAt: string | null;
  deliverable: { summary: string | null; version: number; files: Json } | null;
};
type DeliveredRow = {
  id: string; code: string; service: string; delivered_at: string | null;
  deliverables: { summary: string | null; version: number; files: Json; status: string }[] | null;
};
export async function getMyDeliveredOrders(): Promise<DeliveredOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, code, service, delivered_at, deliverables(summary, version, files, status)')
    .eq('state', 'delivered')
    .order('delivered_at', { ascending: true })
    .returns<DeliveredRow[]>();

  if (error) throw new Error(`getMyDeliveredOrders: ${error.message}`);
  return (data ?? []).map((o) => {
    const latest = (o.deliverables ?? [])
      .filter((d) => d.status === 'approved')
      .sort((a, b) => b.version - a.version)[0] ?? null;
    return {
      id: o.id, code: o.code, service: o.service, deliveredAt: o.delivered_at,
      deliverable: latest ? { summary: latest.summary, version: latest.version, files: latest.files } : null,
    };
  });
}
