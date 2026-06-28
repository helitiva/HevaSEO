export interface AdminNavItem { label: string; href: string; icon: string; }
export interface AdminNavSection { title: string; items: AdminNavItem[]; }

export const ADMIN_NAV: AdminNavSection[] = [
  { title: 'Operate', items: [
    { label: 'Overview', href: '/admin', icon: 'ph-squares-four' },
    { label: 'Orders', href: '/admin/orders', icon: 'ph-kanban' },
    { label: 'Assignment', href: '/admin/assignment', icon: 'ph-flow-arrow' },
    { label: 'Review', href: '/admin/review', icon: 'ph-seal-check' },
    { label: 'Tickets', href: '/admin/tickets', icon: 'ph-lifebuoy' },
  ]},
  { title: 'People', items: [
    { label: 'Customers', href: '/admin/customers', icon: 'ph-users' },
    { label: 'Staff', href: '/admin/staff', icon: 'ph-user-gear' },
    { label: 'Managers', href: '/admin/managers', icon: 'ph-user-circle-gear' },
  ]},
  { title: 'Business', items: [
    { label: 'Finance', href: '/admin/finance', icon: 'ph-wallet' },
    { label: 'Catalog', href: '/admin/catalog', icon: 'ph-tag' },
    { label: 'Affiliates', href: '/admin/affiliate', icon: 'ph-megaphone' },
    { label: 'Analytics', href: '/admin/analytics', icon: 'ph-chart-line-up' },
  ]},
  { title: 'Knowledge', items: [
    { label: 'Docs', href: '/admin/docs', icon: 'ph-books' },
    { label: 'Notes', href: '/admin/notes', icon: 'ph-note-pencil' },
  ]},
  { title: 'System', items: [
    { label: 'Audit log', href: '/admin/audit', icon: 'ph-scroll' },
    { label: 'Settings', href: '/admin/settings', icon: 'ph-gear-six' },
  ]},
];
