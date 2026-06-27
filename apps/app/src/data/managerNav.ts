import type { AdminNavSection } from './adminNav';

// Manager sidebar — the pod-scoped, money-blind ops surface. Deliberately a
// subset of ADMIN_NAV: no Managers (org-shaping), no Finance/Analytics (money),
// no Catalog. Adds Docs (admin-published knowledge base) + Notes (private
// notebook), ported from the staff surface. Every href is gated in lib/rbac.ts
// (ROUTE_CAPABILITY) and lib/rbac.nav.test.ts guards against drift.
export const MANAGER_NAV: AdminNavSection[] = [
  { title: 'Operate', items: [
    { label: 'Overview', href: '/manager', icon: 'ph-squares-four' },
    { label: 'Orders', href: '/manager/orders', icon: 'ph-kanban' },
    { label: 'Assignment', href: '/manager/assignment', icon: 'ph-flow-arrow' },
    { label: 'Review', href: '/manager/review', icon: 'ph-seal-check' },
    { label: 'Tickets', href: '/manager/tickets', icon: 'ph-lifebuoy' },
  ]},
  { title: 'My pod', items: [
    { label: 'Customers', href: '/manager/customers', icon: 'ph-users' },
    { label: 'Staff', href: '/manager/staff', icon: 'ph-user-gear' },
  ]},
  { title: 'Knowledge', items: [
    { label: 'Docs', href: '/manager/docs', icon: 'ph-books' },
    { label: 'Notes', href: '/manager/notes', icon: 'ph-note-pencil' },
  ]},
  { title: 'System', items: [
    { label: 'Audit log', href: '/manager/audit', icon: 'ph-scroll' },
    { label: 'Settings', href: '/manager/settings', icon: 'ph-gear-six' },
  ]},
];
