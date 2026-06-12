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
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Dashboard', href: '/#dashboard' },
  { label: 'Customers', href: '/#customers' },
  { label: 'FAQ', href: '/#faq' },
];

export const footerLinks = {
  services: [
    { label: 'Audit website', href: '/audit' },
    { label: 'SEO Web Design', href: '/seo-web-design' },
    { label: 'Keyword Research & Strategy', href: '/keyword-strategy' },
    { label: 'Backlink Entity', href: '/#services' },
    { label: 'SEO Content Writing', href: '/#services' },
    { label: 'Backlink Indexer', href: '/#services' },
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
