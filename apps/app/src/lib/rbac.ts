/**
 * RBAC — the single source of truth for "who can see/do what" across the app.
 *
 * Why this file exists
 * --------------------
 * The product has four roles whose reach overlaps in non-obvious ways (a manager
 * is an admin with the money taken away; staff never see pricing; customers never
 * see internal notes). When those rules live scattered across components they
 * drift and get missed. Everything role-related is declared here, once:
 *
 *   1. ROLES            — the four roles.
 *   2. ROLE_CAPABILITIES — role → the capabilities it holds (the matrix).
 *   3. ROUTE_CAPABILITY  — route prefix → the capability needed to enter it.
 *   4. helpers           — can(), canAccessPath(), filterNav(), homePathFor().
 *
 * This is the UI layer of defence only. The master plan keeps the database
 * (RLS) as the primary gate — never trust this module to keep a determined
 * client out of data. It exists so the UI is consistent and self-documenting.
 *
 * When real auth lands, replace the Phase-0 persona constant (ADMIN_PERSONA)
 * with the role read from the session.
 */

export type Role = 'admin' | 'manager' | 'staff' | 'customer';

export const ROLES: readonly Role[] = ['admin', 'manager', 'staff', 'customer'];

/**
 * A capability is a single, named permission. Prefer adding a capability over
 * checking `role === 'admin'` inline — the matrix below stays the only place a
 * role's reach is decided.
 */
export type Capability =
  // --- Admin / manager operations surface (/admin/*, /manager/*) ---
  | 'admin.access' // enter the admin area at all (overview, shared shell)
  | 'manager.access' // enter the manager area (the pod-scoped, money-blind ops surface)
  | 'orders.manage'
  | 'assignment.manage'
  | 'review.manage'
  | 'tickets.manage'
  | 'customers.manage'
  | 'staff.manage'
  | 'managers.manage'
  | 'catalog.manage'
  | 'catalog.view' // read the service menu (managers see it; editing is admin-only)
  | 'docs.manage' // author docs and distribute them to customers/staff/managers (admin only)
  | 'audit.view'
  | 'org.settings' // org-wide admin settings (not personal settings)
  // --- Business intelligence — admin only, hidden from managers ---
  | 'finance.view' // revenue, payroll, cashflow
  | 'analytics.view'
  | 'affiliate.manage' // run the affiliate/KOL program: partners, tiers, rules, payouts
  // --- Staff self-service surface (/staff/*) ---
  | 'staff.access' // enter the staff area
  | 'staff.work' // my day, tasks, calendar, deliverables
  | 'staff.knowledge' // docs, notes
  | 'staff.self' // own finance, performance, settings, notifications
  // --- Customer portal surface (root routes) ---
  | 'portal.use'
  // --- Cross-cutting data visibility (the rules that bite across surfaces) ---
  | 'pricing.view' // see monetary figures on an order (staff are blocked)
  | 'notes.internal.view'; // see internal-only notes/threads (customers are blocked)

/**
 * The matrix. Each role lists exactly the capabilities it holds. Read top-to-
 * bottom to understand a role; read a single capability across roles to audit it.
 *
 * - admin    : everything, across both /admin and /manager.
 * - manager  : its own pod-scoped ops area (/manager). Same ops actions as admin
 *              but money-blind — NO pricing/finance/analytics, NO org-shaping
 *              powers (no managing managers, no org settings), catalog is
 *              read-only, and it cannot enter the /admin area. Pod-scoping (which
 *              staff/customers a manager may see) lives in lib/managerScope.ts —
 *              capabilities answer "what action", scope answers "on whose data".
 * - staff    : their own work + knowledge + self-service; sees internal notes
 *              (they author them) but never pricing.
 * - customer : the portal; sees their own pricing/credit but never internal notes.
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: [
    'admin.access',
    'manager.access',
    'orders.manage',
    'assignment.manage',
    'review.manage',
    'tickets.manage',
    'customers.manage',
    'staff.manage',
    'managers.manage',
    'catalog.manage',
    'catalog.view',
    'docs.manage',
    'audit.view',
    'org.settings',
    'finance.view',
    'analytics.view',
    'affiliate.manage',
    'pricing.view',
    'notes.internal.view',
  ],
  manager: [
    'manager.access',
    'orders.manage',
    'assignment.manage',
    'review.manage',
    'tickets.manage',
    'customers.manage',
    'staff.manage',
    'audit.view',
    'notes.internal.view',
  ],
  staff: [
    'staff.access',
    'staff.work',
    'staff.knowledge',
    'staff.self',
    'notes.internal.view',
  ],
  customer: ['portal.use', 'pricing.view'],
};

const ROLE_CAPABILITY_SETS: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set(ROLE_CAPABILITIES.admin),
  manager: new Set(ROLE_CAPABILITIES.manager),
  staff: new Set(ROLE_CAPABILITIES.staff),
  customer: new Set(ROLE_CAPABILITIES.customer),
};

/** Does `role` hold `capability`? The one check every gate should use. */
export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITY_SETS[role].has(capability);
}

/**
 * Route prefix → capability required to enter it. Ordered most-specific first so
 * the first matching prefix wins (e.g. /admin/finance is matched before /admin).
 * A path with no entry here is treated as public (no capability required).
 */
export const ROUTE_CAPABILITY: readonly { prefix: string; capability: Capability }[] = [
  // Admin sub-routes that differ from the area umbrella (manager-blocked / specific)
  { prefix: '/admin/finance', capability: 'finance.view' },
  { prefix: '/admin/analytics', capability: 'analytics.view' },
  { prefix: '/admin/affiliate', capability: 'affiliate.manage' },
  { prefix: '/admin/managers', capability: 'managers.manage' },
  { prefix: '/admin/settings', capability: 'org.settings' },
  { prefix: '/admin/audit', capability: 'audit.view' },
  { prefix: '/admin/orders', capability: 'orders.manage' },
  { prefix: '/admin/assignment', capability: 'assignment.manage' },
  { prefix: '/admin/review', capability: 'review.manage' },
  { prefix: '/admin/tickets', capability: 'tickets.manage' },
  { prefix: '/admin/customers', capability: 'customers.manage' },
  { prefix: '/admin/staff', capability: 'staff.manage' },
  { prefix: '/admin/catalog', capability: 'catalog.manage' },
  { prefix: '/admin/docs', capability: 'docs.manage' }, // author + distribute docs
  { prefix: '/admin/notes', capability: 'admin.access' }, // admin's own notebook
  { prefix: '/admin', capability: 'admin.access' }, // overview + umbrella

  // Manager area (/manager/*) — the pod-scoped ops surface. Same ops capabilities
  // as the admin equivalents (managers ARE ops admins), so admins can preview it
  // too. There is deliberately no /manager/finance, /manager/analytics or
  // /manager/managers — those money/org powers don't exist for managers.
  { prefix: '/manager/orders', capability: 'orders.manage' },
  { prefix: '/manager/assignment', capability: 'assignment.manage' },
  { prefix: '/manager/review', capability: 'review.manage' },
  { prefix: '/manager/tickets', capability: 'tickets.manage' },
  { prefix: '/manager/customers', capability: 'customers.manage' },
  { prefix: '/manager/staff', capability: 'staff.manage' },
  { prefix: '/manager/audit', capability: 'audit.view' },
  { prefix: '/manager/docs', capability: 'manager.access' }, // knowledge base (admin-published)
  { prefix: '/manager/notes', capability: 'manager.access' }, // private notebook
  { prefix: '/manager', capability: 'manager.access' }, // overview + personal settings + umbrella

  // Staff sub-routes
  { prefix: '/staff/tasks', capability: 'staff.work' },
  { prefix: '/staff/calendar', capability: 'staff.work' },
  { prefix: '/staff/deliverables', capability: 'staff.work' },
  { prefix: '/staff/docs', capability: 'staff.knowledge' },
  { prefix: '/staff/notes', capability: 'staff.knowledge' },
  { prefix: '/staff/finance', capability: 'staff.self' },
  { prefix: '/staff/performance', capability: 'staff.self' },
  { prefix: '/staff/notifications', capability: 'staff.self' },
  { prefix: '/staff/settings', capability: 'staff.self' },
  { prefix: '/staff', capability: 'staff.access' }, // my day + umbrella

  // Customer portal (root-level routes)
  { prefix: '/docs', capability: 'portal.use' }, // admin-published tutorials/guides
  { prefix: '/notes', capability: 'portal.use' }, // customer's private notebook
  { prefix: '/dashboard', capability: 'portal.use' },
  { prefix: '/projects', capability: 'portal.use' },
  { prefix: '/orders', capability: 'portal.use' },
  { prefix: '/services', capability: 'portal.use' },
  { prefix: '/credit', capability: 'portal.use' },
  { prefix: '/support', capability: 'portal.use' },
  { prefix: '/settings', capability: 'portal.use' },
];

/** The capability a path requires, or null if the path is public. */
export function capabilityForPath(path: string): Capability | null {
  // Match on the pathname only — nav hrefs may carry ?query or #hash.
  const pathname = path.split(/[?#]/)[0];
  const match = ROUTE_CAPABILITY.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match ? match.capability : null;
}

/** Can `role` open `path`? Public paths (no mapped capability) are always allowed. */
export function canAccessPath(role: Role, path: string): boolean {
  const capability = capabilityForPath(path);
  return capability === null || can(role, capability);
}

/** Where a role lands after login / when it hits a page it may not see. */
export function homePathFor(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'manager':
      return '/manager';
    case 'staff':
      return '/staff';
    case 'customer':
      return '/dashboard';
  }
}

/** Minimal shape any nav config satisfies — keeps filterNav decoupled from nav files. */
type NavSectionLike<Item extends { href: string }> = { items: Item[] };

/**
 * Drop nav sections/items the role cannot reach, then drop now-empty sections.
 * Lets every sidebar share one rule instead of hard-coding "hide Finance for
 * managers" in markup. Works with ADMIN_NAV, STAFF_NAV, NAV — any nav shape.
 */
export function filterNav<Item extends { href: string }, Section extends NavSectionLike<Item>>(
  sections: readonly Section[],
  role: Role,
): Section[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessPath(role, item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Phase-0 mock personas.
 *
 * There is no auth yet, and the same browser previews every surface, so "the
 * current user" is not one value — each shell renders as a fixed persona. The
 * admin shell is always the admin role; the manager shell (its own /manager area)
 * is always the manager role and additionally pins a current manager id for
 * pod-scoping — see MANAGER_PERSONA in lib/managerScope.ts.
 *
 * When auth lands, drop these and read the role from the session — middleware
 * already resolves it per the master plan, and every gate above keeps working.
 */
export const ADMIN_PERSONA: Extract<Role, 'admin' | 'manager'> = 'admin';
