// Pure DB-row → UI-model mappers for orders. Extracted from data/orders.server.ts so they can be
// unit-tested without the `server-only` boundary. No I/O here — just shape transforms.
import type { AdminOrder } from '@/data/adminMock';
import type { Order, OrderStatus as CustStatus, ServiceKey, Priority } from '@/data/mock';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── admin / base orders ────────────────────────────────────────────────────────
export type OrderRow = {
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

export function toAdminOrder(r: OrderRow): AdminOrder {
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

// ── money-blind (orders_mgr view omits value → map to 0) ────────────────────────
export type MgrOrderRow = Omit<OrderRow, 'value'>;
export const toMgrOrder = (r: MgrOrderRow): AdminOrder => toAdminOrder({ ...r, value: 0 });

// ── customer dashboard model (data/mock.ts Order) — derived (no schema for these) ──
export const SERVICE_KEY: Record<string, ServiceKey> = {
  Audit: 'audit', Content: 'content', Keyword: 'keyword', Backlink: 'backlink',
  Optimization: 'optimize', 'Web Design': 'design', Indexer: 'indexer',
};
export const CUST_STATUS: Record<string, CustStatus> = {
  new: 'planned', confirmed: 'planned', assigned: 'planned',
  in_progress: 'progress', changes_requested: 'progress',
  // delivered = team-completed, awaiting the customer's review → lives in the Completed column (tagged).
  internal_review: 'review', delivered: 'completed',
  approved: 'completed', completed: 'completed',
};
type OrderDetailLite = { project: string | null; folder: string | null };
export type MyOrderRow = {
  code: string; service: string; pkg: string | null;
  state: string; priority: Priority; value: number | string;
  deadline: string | null; created_at: string; delivered_at: string | null;
  customers: { company: string | null; name: string | null } | null;
  assignee: { name: string | null } | null;
  // embedded order_details (project/folder captured at order time). PostgREST may return object or array.
  order_details: OrderDetailLite | OrderDetailLite[] | null;
};
const usDate = (ts: string): string => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
/** ETA as a turnaround in days (deadline − created), e.g. "3 days"; "—" when no deadline. */
const etaLabel = (created: string, deadline: string | null): string => {
  if (!deadline) return '—';
  const n = Math.max(1, Math.round((new Date(deadline).getTime() - new Date(created).getTime()) / 86_400_000));
  return `${n} day${n === 1 ? '' : 's'}`;
};
export function toCustomerOrder(r: MyOrderRow): Order {
  const status = CUST_STATUS[r.state] ?? 'planned';
  const det = Array.isArray(r.order_details) ? r.order_details[0] : r.order_details;
  return {
    id: r.code,
    date: usDate(r.created_at),
    title: r.service,
    service: SERVICE_KEY[r.service] ?? 'optimize',
    domain: r.customers?.company ?? r.customers?.name ?? 'My site',
    sub: r.pkg ?? '',
    project: det?.project ?? undefined,
    folder: det?.folder ?? undefined,
    status,
    priority: r.priority,
    progress: null,
    eta: etaLabel(r.created_at, r.deadline),
    owner: r.assignee?.name ?? 'Unassigned',
    cost: Number(r.value),
    pay: status === 'completed' ? 'paid' : 'pending',
    invoice: null,
    awaitingReview: r.state === 'delivered',
    deliveredAt: r.delivered_at,
  };
}
