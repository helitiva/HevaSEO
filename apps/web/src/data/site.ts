/** Single source of truth for site-wide chrome (nav, contact, social). */
export const site = {
  name: 'HevaSEO',
  url: 'https://hevaseo.com',
  tagline: 'Your long-term SEO partner: entity, content, and indexer in one place.',
  email: 'hello@hevaseo.com',
  phone: '+1 (415) 555-0142',
  phoneTel: '+14155550142',
  whatsapp: 'https://wa.me/14155550142',
  messenger: 'https://m.me/hevaseo',
  address: 'San Francisco, CA',
  social: {
    facebook: '#',
    youtube: '#',
    linkedin: '#',
  },
};

/** Primary nav. Links are absolute (`/#…`) so they work from any page. */
export const nav = [
  { label: 'Offers', href: '/#offers', highlight: true },
  { label: 'Services', href: '/#services', submenu: 'services' },
  { label: 'Process', href: '/#process' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Dashboard', href: '/#dashboard' },
  { label: 'Customers', href: '/#customers' },
  { label: 'FAQ', href: '/#faq' },
];

/** Dropdown contents for the "Services" nav item — dedicated landing pages first. */
export const serviceMenu = [
  { label: 'Website Audit', href: '/audit', desc: 'Find what holds your site back', icon: 'ph-magnifying-glass' },
  { label: 'Website Optimization', href: '/website-optimization', desc: 'Faster, cleaner & AI-ready', icon: 'ph-gauge' },
  { label: 'SEO Web Design', href: '/seo-web-design', desc: 'Built to rank from day one', icon: 'ph-browsers' },
  { label: 'Keyword Research & Strategy', href: '/keyword-strategy', desc: 'Map the keywords that convert', icon: 'ph-target' },
  { label: 'Backlinks', href: '/backlink', desc: 'Entity · Pyramid · Guest · PR', icon: 'ph-share-network' },
  { label: 'SEO Content Writing', href: '/content', desc: 'AI or human-written, scored', icon: 'ph-pen-nib' },
  { label: 'Backlink Indexer', href: '/indexer', desc: 'Pay-per-link, indexed fast', icon: 'ph-list-checks' },
];

export const footerLinks = {
  services: [
    { label: 'Audit website', href: '/audit' },
    { label: 'Website Optimization', href: '/website-optimization' },
    { label: 'SEO Web Design', href: '/seo-web-design' },
    { label: 'Keyword Research & Strategy', href: '/keyword-strategy' },
    { label: 'Backlinks', href: '/backlink' },
    { label: 'SEO Content Writing', href: '/content' },
    { label: 'Backlink Indexer', href: '/indexer' },
  ],
  company: [
    { label: 'Customers', href: '/#customers' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Blog', href: '/blog' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};
