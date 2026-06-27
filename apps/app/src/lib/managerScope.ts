/**
 * Manager pod-scoping — the single source for "whose data may a manager see".
 *
 * RBAC (lib/rbac.ts) answers *what action* a manager can take. This module
 * answers *on whose data*: a manager only ever sees their own pod — the staff
 * who report to them (STAFF_MANAGER) and the customers those staff serve. Every
 * /manager/* page derives its rows through `managerScope()` so the boundary is
 * declared once, not re-implemented (and mis-implemented) per page.
 *
 * Phase 0 is a mock with no auth, so the "current manager" is a fixed persona
 * (MANAGER_PERSONA), mirroring ADMIN_PERSONA. When auth lands, replace that
 * constant with the manager id from the session — every helper here keeps
 * working, and the database (RLS) becomes the real boundary this only mirrors.
 */
import {
  ORDERS, STAFF, CUSTOMERS, TICKETS, STAFF_MANAGER, MANAGERS,
  type AdminManager, type AdminOrder, type AdminStaff, type AdminCustomer,
  type AdminTicket, type AuditEntry,
} from '@/data/adminMock';

/** The manager whose pod the /manager surface renders as (Phase-0 mock persona). */
export const MANAGER_PERSONA = 'mgr1';

export interface ManagerScope {
  managerId: string;
  manager: AdminManager | null;
  /** Staff in this manager's pod. */
  staff: AdminStaff[];
  staffIds: ReadonlySet<string>;
  /** Orders reference staff by display name, so we match on names too. */
  staffNames: ReadonlySet<string>;
  /** Companies/customers this pod serves (derived from who works their orders). */
  customerCompanies: ReadonlySet<string>;
  customerIds: ReadonlySet<string>;
  /** Order codes handled by this pod — used to scope audit/tickets by reference. */
  orderCodes: ReadonlySet<string>;
}

/** Build the pod boundary for a manager. Pure + serializable-friendly. */
export function managerScope(managerId: string): ManagerScope {
  const staff = STAFF.filter((s) => STAFF_MANAGER[s.id] === managerId);
  const staffIds = new Set(staff.map((s) => s.id));
  const staffNames = new Set(staff.map((s) => s.name));

  // A customer is in the pod if any of their orders is worked by a pod member.
  const customerCompanies = new Set<string>();
  const orderCodes = new Set<string>();
  for (const o of ORDERS) {
    if (o.staff && staffNames.has(o.staff)) {
      customerCompanies.add(o.customer);
      orderCodes.add(o.code);
    }
  }
  const customerIds = new Set(
    CUSTOMERS.filter((c) => customerCompanies.has(c.company)).map((c) => c.id),
  );

  return {
    managerId,
    manager: MANAGERS.find((m) => m.id === managerId) ?? null,
    staff, staffIds, staffNames, customerCompanies, customerIds, orderCodes,
  };
}

// ---- Scoped collection helpers (every /manager page funnels through these) ----

/** Orders worked by the pod. (Unassigned orders live in the assignment queue.) */
export function ordersForPod(scope: ManagerScope): AdminOrder[] {
  return ORDERS.filter((o) => o.staff !== null && scope.staffNames.has(o.staff));
}

/** Customers the pod serves. */
export function customersForPod(scope: ManagerScope): AdminCustomer[] {
  return CUSTOMERS.filter((c) => scope.customerCompanies.has(c.company));
}

/** Tickets belonging to pod customers (or explicitly assigned to a pod member). */
export function ticketsForPod(scope: ManagerScope): AdminTicket[] {
  return TICKETS.filter(
    (t) => scope.customerCompanies.has(t.customer) ||
      (t.assignee !== null && scope.staffNames.has(t.assignee)),
  );
}

/** Is this staff member inside the manager's pod? */
export function staffInPod(scope: ManagerScope, staffId: string): boolean {
  return scope.staffIds.has(staffId);
}

/**
 * Does an audit event touch this pod? Conservative match across the references an
 * AuditEntry can carry: its actor, the staff/customer/order it names, or its meta.
 */
export function auditInPod(scope: ManagerScope, e: AuditEntry): boolean {
  if (scope.staffNames.has(e.actor)) return true;
  if (e.entity === 'staff' && e.entityId !== null && scope.staffIds.has(e.entityId)) return true;
  if (e.entity === 'order' && e.entityCode !== null && scope.orderCodes.has(e.entityCode)) return true;
  if (e.entity === 'customer' && e.entityCode !== null && scope.customerCompanies.has(e.entityCode)) return true;
  if (e.to !== null && scope.staffNames.has(e.to)) return true;
  const metaStaff = e.meta?.staff;
  if (typeof metaStaff === 'string' && scope.staffNames.has(metaStaff)) return true;
  const metaCustomer = e.meta?.customer;
  if (typeof metaCustomer === 'string' && scope.customerCompanies.has(metaCustomer)) return true;
  return false;
}
