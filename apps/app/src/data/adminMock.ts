// Mock data for the admin UI. Shapes mirror the design specs; replaced by DB later.
export type OrderStatus = 'new'|'confirmed'|'assigned'|'in_progress'|'internal_review'|'delivered'|'changes_requested'|'approved'|'completed'|'canceled';
export type Priority = 'low'|'med'|'high';

export interface AdminOrder {
  id: string; code: string; customer: string; service: string; pkg: string;
  status: OrderStatus; priority: Priority; source: 'quick'|'dashboard';
  value: number; staff: string | null; deadline: string | null; created: string;
}
export interface AdminCustomer {
  id: string; name: string; company: string; email: string; status: 'shadow'|'claimed';
  orders: number; spend: number; balance: number; lastActive: string;
}
export interface AdminStaff {
  id: string; name: string; skills: string[]; capacity: number; openLoad: number;
  composite: number; quality: number; onTime: number; throughput: number; active: boolean;
}
export interface AdminTicket {
  id: string; subject: string; customer: string; status: 'open'|'pending'|'resolved'|'closed';
  priority: Priority; assignee: string | null; age: string;
}
export interface AdminRule { id: string; service: string; pkg: string | null; mode: 'pin'|'auto'; target: string | null; priority: number; active: boolean; }
export interface AuditEntry { id: string; at: string; actor: string; entity: string; action: string; change: string; }

export const KPIS = {
  newOrders: 6, inProgress: 11, overdue: 3, awaitingApproval: 4,
  revenueToday: 1240, revenueMtd: 18650, openTickets: 5, unassigned: 2,
};

export const ORDERS: AdminOrder[] = [
  { id: 'o1', code: 'AUD-1001', customer: 'Acme Co', service: 'Audit', pkg: 'Standard', status: 'new', priority: 'high', source: 'quick', value: 39, staff: null, deadline: '2026-06-26', created: '2026-06-24' },
  { id: 'o2', code: 'KW-1002', customer: 'Bright Ltd', service: 'Keyword', pkg: 'Standard', status: 'in_progress', priority: 'med', source: 'dashboard', value: 39, staff: 'Mai T.', deadline: '2026-06-25', created: '2026-06-23' },
  { id: 'o3', code: 'BL-1003', customer: 'Nova', service: 'Backlink', pkg: 'Growth', status: 'internal_review', priority: 'high', source: 'dashboard', value: 64, staff: 'Linh P.', deadline: '2026-06-24', created: '2026-06-21' },
  { id: 'o4', code: 'CNT-1004', customer: 'Acme Co', service: 'Content', pkg: '10 articles', status: 'delivered', priority: 'med', source: 'quick', value: 120, staff: 'Huy N.', deadline: '2026-06-27', created: '2026-06-20' },
  { id: 'o5', code: 'OPT-1005', customer: 'Vértice', service: 'Optimization', pkg: 'Standard', status: 'completed', priority: 'low', source: 'dashboard', value: 79, staff: 'Mai T.', deadline: '2026-06-22', created: '2026-06-18' },
];

export const CUSTOMERS: AdminCustomer[] = [
  { id: 'c1', name: 'Jane Doe', company: 'Acme Co', email: 'jane@acme.com', status: 'claimed', orders: 8, spend: 1240, balance: 320, lastActive: '2026-06-24' },
  { id: 'c2', name: 'Sam Lee', company: 'Bright Ltd', email: 'sam@bright.io', status: 'shadow', orders: 2, spend: 198, balance: 0, lastActive: '2026-06-23' },
  { id: 'c3', name: 'Ana Ruiz', company: 'Nova', email: 'ana@nova.co', status: 'claimed', orders: 14, spend: 3180, balance: 540, lastActive: '2026-06-22' },
];

export const STAFF: AdminStaff[] = [
  { id: 's1', name: 'Mai T.', skills: ['keyword','optimize'], capacity: 6, openLoad: 3, composite: 92, quality: 95, onTime: 90, throughput: 22, active: true },
  { id: 's2', name: 'Linh P.', skills: ['backlink'], capacity: 5, openLoad: 4, composite: 88, quality: 86, onTime: 92, throughput: 31, active: true },
  { id: 's3', name: 'Huy N.', skills: ['content'], capacity: 8, openLoad: 5, composite: 84, quality: 88, onTime: 79, throughput: 40, active: true },
];

export const TICKETS: AdminTicket[] = [
  { id: 't1', subject: 'When will my report be ready?', customer: 'Acme Co', status: 'open', priority: 'high', assignee: null, age: '2h' },
  { id: 't2', subject: 'Invoice question', customer: 'Nova', status: 'pending', priority: 'med', assignee: 'Mai T.', age: '1d' },
];

export const RULES: AdminRule[] = [
  { id: 'r1', service: 'Backlink', pkg: null, mode: 'pin', target: 'Linh P.', priority: 10, active: true },
  { id: 'r2', service: 'Content', pkg: null, mode: 'auto', target: null, priority: 50, active: true },
];

export const AUDIT: AuditEntry[] = [
  { id: 'a1', at: '2026-06-24 09:12', actor: 'Admin', entity: 'order', action: 'transition', change: 'AUD-1001 new→confirmed' },
  { id: 'a2', at: '2026-06-24 08:40', actor: 'Admin', entity: 'order', action: 'assign', change: 'KW-1002 → Mai T.' },
];

export const statusLabel: Record<OrderStatus, string> = {
  new:'New', confirmed:'Confirmed', assigned:'Assigned', in_progress:'In progress', internal_review:'Internal review',
  delivered:'Delivered', changes_requested:'Changes requested', approved:'Approved', completed:'Completed', canceled:'Canceled',
};
export const money = (n: number) => `$${n.toLocaleString('en-US')}`;
