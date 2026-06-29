import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminOrder } from '@/data/adminMock';

// Lane A inc-3a — the real (RLS-scoped) replacement for the synchronous `ORDERS` mock. The query is
// scoped automatically by the caller's JWT: admin → all tenant orders, customer → only their own
// (orders RLS, ADR K9). Return shape matches AdminOrder exactly (CONTRACTS §1) so callers don't change
// beyond awaiting. `customer`/`staff` are denormalized names via embedded joins; `status` ← `state`.

type OrderRow = {
  id: string;
  code: string;
  service: string;
  pkg: string | null;
  state: AdminOrder['status'];
  priority: AdminOrder['priority'];
  source: AdminOrder['source'];
  value: number | string;
  deadline: string | null;
  created_at: string;
  customers: { name: string; company: string | null } | null;
  assignee: { name: string | null } | null;
};

const day = (ts: string | null): string | null => (ts ? ts.slice(0, 10) : null);

function toAdminOrder(r: OrderRow): AdminOrder {
  return {
    id: r.id,
    code: r.code,
    customer: r.customers?.company ?? r.customers?.name ?? '—',
    service: r.service,
    pkg: r.pkg ?? '—',
    status: r.state,
    priority: r.priority,
    source: r.source,
    value: Number(r.value),
    staff: r.assignee?.name ?? null,
    deadline: day(r.deadline),
    created: day(r.created_at) ?? '',
  };
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// ── Money-blind reads for managers/staff: the orders_mgr view OMITS `value` (ADR K9). The view's
// own WHERE is the access gate (manager → tenant orders, staff → own assigned). We map value→0 since
// it doesn't exist and these viewers are money-blind anyway (the UI also hides it via ViewerProvider).
const MGR_ORDER_SELECT =
  'id, code, service, pkg, state, priority, source, deadline, created_at, customers(name, company), assignee:profiles!orders_assignee_id_fkey(name)';
type MgrOrderRow = Omit<OrderRow, 'value'>;
const toMgrOrder = (r: MgrOrderRow): AdminOrder => toAdminOrder({ ...r, value: 0 });

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
