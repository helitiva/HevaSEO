// Pure DB-row → UI-model mappers for orders. Extracted from data/orders.server.ts so they can be
// unit-tested without the `server-only` boundary. No I/O here — just shape transforms.
import type { AdminOrder } from '@/data/adminMock';
import type { Order, OrderStatus as CustStatus, ServiceKey, Priority } from '@/data/mock';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── admin / base orders ────────────────────────────────────────────────────────
export type OrderRow = {
  id: string;
  code: string;
  service: string;
  pkg: string | null;
  state: AdminOrder['status'];
  priority: AdminOrder['priority'];
  source: AdminOrder['source'];
  value: number | string;
  deadline: string | null;
  created_at: string;
  customers: { id: string; name: string; company: string | null } | null;
  assignee: { name: string | null } | null;
};

const day = (ts: string | null): string | null => (ts ? ts.slice(0, 10) : null);

export function toAdminOrder(r: OrderRow): AdminOrder {
  return {
    id: r.id,
    code: r.code,
    customer: r.customers?.company ?? r.customers?.name ?? '—',
    customerId: r.customers?.id ?? null,
    service: r.service,
    pkg: r.pkg ?? '—',
    status: r.state,
    priority: r.priority,
    source: r.source,
    value: Number(r.value),
    staff: r.assignee?.name ?? null,
    deadline: day(r.deadline),
    created: day(r.created_at) ?? '',
  };
}

// ── money-blind (orders_mgr view omits value → map to 0) ────────────────────────
// orders_mgr exposes the customer name/company as columns (not an embed), so money-blind roles read the
// client without needing customers-RLS. Reshape them into the OrderRow.customers shape toAdminOrder expects.
export type MgrOrderRow = Omit<OrderRow, 'value' | 'customers'> & { customer_id: string | null; customer_name: string | null; customer_company: string | null };
export const toMgrOrder = (r: MgrOrderRow): AdminOrder =>
  // orders_mgr carries customer_id as a column — pass it through so a manager's orders can be joined to
  // customer facts by id like everywhere else, rather than by company name.
  toAdminOrder({
    ...r, value: 0,
    customers: r.customer_company || r.customer_name
      ? { id: r.customer_id ?? '', name: r.customer_name ?? '', company: r.customer_company }
      : null,
  });

// ── customer dashboard model (data/mock.ts Order) — derived (no schema for these) ──
// Maps the stored service label (SERVICES[key].label) → ServiceKey. Both spellings kept so a "Keywords"
// or legacy "Keyword" (and "Design" / "Web Design") order still resolves the right icon/tag.
export const SERVICE_KEY: Record<string, ServiceKey> = {
  Audit: 'audit', Content: 'content', Keyword: 'keyword', Keywords: 'keyword', Backlink: 'backlink',
  Optimization: 'optimize', Design: 'design', 'Web Design': 'design', Indexer: 'indexer',
};
export const CUST_STATUS: Record<string, CustStatus> = {
  new: 'planned', confirmed: 'planned', assigned: 'planned',
  in_progress: 'progress', changes_requested: 'progress',
  // delivered = team-completed, awaiting the customer's review → lives in the Completed column (tagged).
  internal_review: 'review', delivered: 'completed',
  approved: 'completed', completed: 'completed',
};
type ProjLite = { domain: string | null };
type BriefLite = { label?: string | null; value?: string | null };
type OrderDetailLite = { project: string | null; folder: string | null; title: string | null; site: string | null; brief: BriefLite[] | null; proj: ProjLite | ProjLite[] | null };
export type MyOrderRow = {
  code: string; service: string; pkg: string | null;
  state: string; priority: Priority; value: number | string;
  deadline: string | null; created_at: string; delivered_at: string | null;
  customers: { company: string | null; name: string | null } | null;
  assignee: { name: string | null } | null;
  // embedded order_details (project/folder captured at order time). PostgREST may return object or array.
  order_details: OrderDetailLite | OrderDetailLite[] | null;
};
const usDate = (ts: string): string => {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
/** ETA as a turnaround in days (deadline − created), e.g. "3 days"; "—" when no deadline. */
const etaLabel = (created: string, deadline: string | null): string => {
  if (!deadline) return '—';
  const n = Math.max(1, Math.round((new Date(deadline).getTime() - new Date(created).getTime()) / 86_400_000));
  return `${n} day${n === 1 ? '' : 's'}`;
};
/** Bare hostname from a URL-or-domain string: "https://www.dantri.com/x" → "dantri.com". */
const hostOf = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, ''); }
  catch { return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || null; }
};

/** The site URL the customer entered — the site column, else the first URL-ish field in the brief (older
 *  orders predate the site column, so their URL lives in "Website URL" / "Target URL(s)" / similar). */
const URL_LABEL = /website|url|site|target|domain|link/i;
/** First real URL/domain token in a blob, or null. Requires an http(s) prefix or a dotted host with a 2+
 *  char TLD — so prose like "What does your site offer?" answers ("Dental clinics…") are NOT mistaken for a
 *  site just because the field's LABEL contains the word "site". */
const urlTokenOf = (v: string): string | null =>
  v.trim().split(/[\s\n,]+/).find((x) => /^https?:\/\//i.test(x) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/:?#]|$)/i.test(x)) ?? null;
function siteFromDetail(det: OrderDetailLite | null | undefined): string | null {
  if (det?.site) return det.site;
  const brief = Array.isArray(det?.brief) ? det!.brief : [];
  // prefer a URL-labelled field whose VALUE actually holds a URL/domain, else any field with an http URL.
  for (const f of brief) {
    if (URL_LABEL.test(String(f?.label ?? ''))) { const u = urlTokenOf(String(f?.value ?? '')); if (u) return u; }
  }
  for (const f of brief) { const u = urlTokenOf(String(f?.value ?? '')); if (u && /^https?:/i.test(u)) return u; }
  return null;
}
const stripProto = (s: string): string => s.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
/** first URL-ish token from a blob ("a.com b.com" → "a.com"). */
const firstUrlToken = (v: string): string =>
  v.trim().split(/[\s\n,]+/).find((x) => /^https?:\/\//i.test(x) || /\.\w{2,}/.test(x)) ?? v.trim();
/** distinct hostnames across a URL/domain blob. */
function hostsIn(text: string): string[] {
  const hosts = new Set<string>();
  for (const t of text.split(/[\s\n,]+/).map((x) => x.trim()).filter(Boolean)) {
    const h = hostOf(t);
    if (h && /\.\w{2,}/.test(h)) hosts.add(h);
  }
  return [...hosts];
}
/** brief field value whose label matches `re` (first non-empty). */
function briefVal(brief: BriefLite[], re: RegExp): string | null {
  const f = brief.find((b) => re.test(String(b?.label ?? '')) && String(b?.value ?? '').trim());
  return f?.value ? String(f.value).trim() : null;
}
/** integer immediately preceding a unit word ("A2000 · 3 articles" → 3, "1,000 links" → 1000). Anchoring on
 *  the unit avoids grabbing a plan code's digits (the "2000" in "A2000"). */
function numBeforeUnit(v: string | null, unit: RegExp): number | null {
  const m = v?.match(new RegExp(String.raw`(\d[\d,]*)\s*(?:${unit.source})`, 'i'));
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
const clip = (s: string, n = 42): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

type LabelCtx = { site: string | null; projDomain: string | null; brief: BriefLite[]; company: string | null };
/** `label` is what the website line shows; optional `hover` is the untruncated full text (only when it adds
 *  info — a long backlink URL, a clipped keyword topic). No `hover` ⇒ the card shows no tooltip. */
export type SiteInfo = { label: string; hover?: string };
/**
 * The website line shown on the order card, tailored per service (see the customer-facing spec):
 *  backlink → target URL/domain (hover: full URL) · content → "N articles for [site]" · indexer → "N URLs
 *  from [site]" or "N URLs from M domains" (no hover — many URLs) · audit/optimize → domain/subdomain (host,
 *  no deep-URL hover) · keyword → "KR for [site]", else "KR for [topic]" (hover: full topic) · design → the
 *  entered domain, else business/company name. A project's auto-generated domain never masquerades as a site.
 */
function cardSiteLabel(service: ServiceKey, ctx: LabelCtx): SiteInfo | null {
  const { site, projDomain, brief, company } = ctx;
  const domain = projDomain ?? hostOf(site);
  const siteText = site ? stripProto(site) : null;
  const planLine = briefVal(brief, /selected plan|service|package/i);

  switch (service) {
    case 'backlink': {
      const target = briefVal(brief, /target|url|website|domain|link/i);
      const full = (target ? stripProto(firstUrlToken(target)) : null) ?? siteText ?? domain ?? null;
      // a backlink target is a specific page — often long, so reveal the full URL on hover.
      return full ? { label: full, hover: full } : null;
    }
    case 'content': {
      const n = numBeforeUnit(planLine, /articles?|posts?/) ?? (briefVal(brief, /keyword|article/i)?.split(/\n+/).filter(Boolean).length || null);
      const where = domain ?? siteText ?? company ?? 'your site';
      return { label: n ? `${n} ${n === 1 ? 'article' : 'articles'} for ${where}` : `Articles for ${where}` };
    }
    case 'indexer': {
      const urlBlob = briefVal(brief, /submitted url|url|link/i) ?? '';
      const hosts = hostsIn(urlBlob);
      const n = numBeforeUnit(planLine, /links?|urls?/) ?? (hosts.length ? urlBlob.split(/[\s\n,]+/).filter(Boolean).length : null);
      const nTxt = n ? n.toLocaleString('en-US') : '';
      // many URLs, possibly across many domains — never surface a single one on hover.
      if (hosts.length > 1) return { label: `${nTxt || hosts.length} URLs from ${hosts.length} domains`.trim() };
      const where = hosts[0] ?? domain ?? siteText;
      if (where) return { label: `${nTxt ? `${nTxt} ` : ''}URLs from ${where}`.trim() };
      return nTxt ? { label: `${nTxt} URLs` } : null;
    }
    case 'audit':
    case 'optimize': {
      // domain/subdomain of the site under audit/optimization — the host, not a deep article path, no hover.
      const host = hostOf(site) ?? domain ?? siteText ?? null;
      return host ? { label: host } : null;
    }
    case 'keyword': {
      // website is optional for keyword research: use its host only when the customer actually entered one —
      // a project's auto-generated domain must NOT masquerade as a site. Otherwise research is by topic.
      if (siteText) return { label: `KR for ${hostOf(site) ?? siteText}` };
      const topic = briefVal(brief, /offer|niche|topic|market|field|industry/i);
      return topic ? { label: `KR for ${clip(topic)}`, hover: `Keyword research for ${topic}` } : { label: 'Keyword research' };
    }
    case 'design': {
      // the entered domain, else the business/company name (never the auto project domain).
      const d = siteText ?? company ?? domain ?? null;
      return d ? { label: d } : null;
    }
    default: {
      const d = siteText ?? domain ?? null;
      return d ? { label: d } : null;
    }
  }
}

export function toCustomerOrder(r: MyOrderRow): Order {
  const status = CUST_STATUS[r.state] ?? 'planned';
  const det = Array.isArray(r.order_details) ? r.order_details[0] : r.order_details;
  const projDomain = det ? (Array.isArray(det.proj) ? det.proj[0]?.domain : det.proj?.domain) ?? null : null;
  // The site URL the customer entered (site column, else pulled from the brief); domain is the project's
  // domain / URL host. NEVER the company name — that must not surface as the order's "website".
  const site = siteFromDetail(det);
  const service = SERVICE_KEY[r.service] ?? 'optimize';
  const brief = Array.isArray(det?.brief) ? det!.brief : [];
  const siteInfo = cardSiteLabel(service, { site, projDomain, brief, company: r.customers?.company ?? null });
  return {
    id: r.code,
    date: usDate(r.created_at),
    title: r.service,
    service,
    domain: projDomain ?? hostOf(site) ?? 'My site',
    site: site ?? undefined,
    siteLabel: siteInfo?.label,
    siteHover: siteInfo?.hover,
    // The chosen package/plan. create_order doesn't persist it to orders.pkg, so fall back to the brief's
    // "Selected plan"/"Service" line (e.g. "Standard", "A2000 · 3 articles", "1,000 links").
    sub: r.pkg ?? briefVal(brief, /selected plan|service|package/i) ?? '',
    project: det?.project ?? undefined,
    folder: det?.folder ?? undefined,
    campaign: det?.title ?? undefined,     // card headline (falls back to the service name in the UI)
    status,
    priority: r.priority,
    progress: null,
    eta: etaLabel(r.created_at, r.deadline),
    owner: r.assignee?.name ?? 'Unassigned',
    cost: Number(r.value),
    pay: status === 'completed' ? 'paid' : 'pending',
    invoice: null,
    awaitingReview: r.state === 'delivered',
    deliveredAt: r.delivered_at,
  };
}
