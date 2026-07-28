import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Custom quotes — the path for 'Consult' packages (price 0 + priceLabel), which must never become a
 * free order. The customer asks, a specialist prices it, the customer pays that amount.
 *
 * Reads are RLS-scoped: admin sees the tenant, a manager sees the shared queue (quoting is sales, not
 * pod ops — a brand-new lead belongs to no pod), a customer sees only their own and only once it has
 * actually been priced.
 */

export type QuoteStatus = 'requested' | 'quoted' | 'accepted' | 'declined' | 'expired';

export interface Quote {
  id: string;
  token: string;
  at: string;                 // ISO, requested
  customer: string;
  customerId: string;
  service: string;
  packageName: string;
  ask: string | null;
  brief: { label: string; value: string }[];
  amount: number | null;      // null until priced
  quoteNote: string | null;
  status: QuoteStatus;
  quotedBy: string | null;
  quotedAt: string | null;
  expiresAt: string | null;
  orderId: string | null;
}

type Row = {
  id: string; token: string; created_at: string; service: string; package_name: string;
  ask: string | null; brief: unknown; amount: number | string | null; quote_note: string | null;
  status: QuoteStatus; quoted_at: string | null; expires_at: string | null; order_id: string | null;
  customers: { id: string; name: string | null; company: string | null } | null;
  quoter: { name: string | null } | null;
};

const SELECT =
  'id, token, created_at, service, package_name, ask, brief, amount, quote_note, status, quoted_at, expires_at, order_id, ' +
  'customers(id, name, company), quoter:profiles!quotes_quoted_by_fkey(name)';

function toQuote(r: Row): Quote {
  const brief = Array.isArray(r.brief)
    ? (r.brief as { label?: unknown; value?: unknown }[])
        .map((b) => ({ label: String(b?.label ?? ''), value: String(b?.value ?? '') }))
    : [];
  return {
    id: r.id,
    token: r.token,
    at: r.created_at,
    customer: r.customers?.company || r.customers?.name || 'Customer',
    customerId: r.customers?.id ?? '',
    service: r.service,
    packageName: r.package_name,
    ask: r.ask,
    brief,
    // null and 0 are different facts here: null = nobody has priced it yet.
    amount: r.amount === null ? null : Number(r.amount),
    quoteNote: r.quote_note,
    status: r.status,
    quotedBy: r.quoter?.name ?? null,
    quotedAt: r.quoted_at,
    expiresAt: r.expires_at,
    orderId: r.order_id,
  };
}

/** The quote queue — every quote this viewer may see, newest first. */
export async function getQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('quotes').select(SELECT)
    .order('created_at', { ascending: false }).returns<Row[]>();
  if (error) throw new Error(`getQuotes: ${error.message}`);
  return (data ?? []).map(toQuote);
}

/** One quote by its URL token. RLS decides whether this viewer may see it — the token is not a key. */
export async function getQuoteByToken(token: string): Promise<Quote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('quotes').select(SELECT)
    .eq('token', token).maybeSingle<Row>();
  if (error) throw new Error(`getQuoteByToken: ${error.message}`);
  return data ? toQuote(data) : null;
}
