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
      { label: 'Browse services', href: '/services', icon: 'ph-squares-four' },
      { label: 'Audit', href: '/services/audit', icon: 'ph-stethoscope' },
      { label: 'Backlink', href: '/services/backlink', icon: 'ph-share-network' },
      { label: 'Content SEO/GEO', href: '/services/content', icon: 'ph-pen-nib' },
      { label: 'Indexer', href: '/services/indexer', icon: 'ph-magnifying-glass' },
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
