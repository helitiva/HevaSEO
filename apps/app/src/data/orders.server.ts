import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminOrder } from '@/data/adminMock';
import type { Order } from '@/data/mock';
import type { OrderDetailExtra } from '@/lib/orderDetail';
import {
  UUID_RE, toAdminOrder, toMgrOrder, toCustomerOrder,
  type OrderRow, type MgrOrderRow, type MyOrderRow,
} from '@/lib/orderMap';

// RLS-scoped order reads (the seam that replaced the synchronous mocks). Each query is auto-scoped by
// the caller's JWT (admin → all tenant orders, customer → own, staff/manager → money-stripped view).
// Pure row→model mapping lives in lib/orderMap.ts (unit-tested there); this file is just I/O.

const ORDER_SELECT =
  'id, code, service, pkg, state, priority, source, value, deadline, created_at, customers(name, company), assignee:profiles!orders_assignee_id_fkey(name)';

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
  'id, code, service, pkg, state, priority, source, deadline, created_at, customers(name, company), assignee:profiles!orders_assignee_id_fkey(name)';

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

/** The signed-in customer's own orders, shaped for the dashboard board (excludes canceled). */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('code, service, pkg, state, priority, value, deadline, created_at, customers(company, name), assignee:profiles!orders_assignee_id_fkey(name)')
    .neq('state', 'canceled')
    .order('created_at', { ascending: false })
    .returns<MyOrderRow[]>();

  if (error) throw new Error(`getMyOrders: ${error.message}`);
  return (data ?? []).map(toCustomerOrder);
}

/** The signed-in customer's orders that have been DELIVERED and are awaiting their approve / send-back
 * decision (delivered → approved | changes_requested). RLS scopes this to the customer's own orders. */
export type DeliveredOrder = { id: string; code: string; service: string };
export async function getMyDeliveredOrders(): Promise<DeliveredOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, code, service')
    .eq('state', 'delivered')
    .order('created_at', { ascending: false })
    .returns<DeliveredOrder[]>();

  if (error) throw new Error(`getMyDeliveredOrders: ${error.message}`);
  return data ?? [];
}
