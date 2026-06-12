/** Sidebar navigation for the customer portal. */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Overview', href: '/dashboard', icon: 'ph-squares-four' },
      { label: 'Projects', href: '/projects', icon: 'ph-globe-hemisphere-west' },
      { label: 'Orders', href: '/orders', icon: 'ph-kanban', badge: '9' },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Backlink', href: '/orders?svc=backlink', icon: 'ph-share-network' },
      { label: 'Content SEO/GEO', href: '/orders?svc=content', icon: 'ph-pen-nib' },
      { label: 'Indexer', href: '/orders?svc=indexer', icon: 'ph-magnifying-glass' },
      { label: 'Audit & Optimization', href: '/orders?svc=audit', icon: 'ph-stethoscope' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Credit & Invoices', href: '/credit', icon: 'ph-wallet' },
      { label: 'Settings', href: '/settings', icon: 'ph-gear-six' },
      { label: 'Support', href: '/support', icon: 'ph-headset' },
    ],
  },
];
