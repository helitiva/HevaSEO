export interface AffiliateNavItem { label: string; href: string; icon: string; }
export interface AffiliateNavSection { title: string; items: AffiliateNavItem[]; }

// The affiliate surface renders as a fixed demo-KOL persona (Phase-0). It is a
// self-contained surface, NOT an RBAC role yet — so this nav is consumed directly,
// without filterNav(). See docs/.../2026-06-28-kol-affiliate-design.md (§ RBAC).
export const AFFILIATE_NAV: AffiliateNavSection[] = [
  { title: 'Program', items: [
    { label: 'Overview',  href: '/affiliate',           icon: 'ph-squares-four' },
    { label: 'Referrals', href: '/affiliate/referrals', icon: 'ph-users-three' },
    { label: 'Payouts',   href: '/affiliate/payouts',   icon: 'ph-wallet' },
  ]},
  { title: 'Promote', items: [
    { label: 'Assets',    href: '/affiliate/assets',    icon: 'ph-megaphone' },
    { label: 'Settings',  href: '/affiliate/settings',  icon: 'ph-gear-six' },
  ]},
];
