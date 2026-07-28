import { notFound, redirect } from 'next/navigation';
import { getQuoteByToken } from '@/data/quotes.server';
import { createClient, getServerSession } from '@/lib/supabase/server';
import { QuoteView } from './QuoteView';

export const metadata = { title: 'Your quote' };

/**
 * The link a specialist sends. The token is in the URL, but it is NOT the key: RLS only returns this
 * row to the owning customer, and accept_quote re-checks ownership from the JWT before it debits
 * anything. Accepting spends real money, so a forwarded link must never be enough to spend someone
 * else's — the token says *which quote*, the session says *who*.
 *
 * Middleware already sends signed-out visitors to /login, so arriving here means authenticated; a
 * mismatched account simply sees nothing (RLS returns no row → notFound).
 */
export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // This is the CUSTOMER's checkout, and only theirs. RLS also lets a manager read the quote (they own
  // the queue), so without this a manager following the link they just sent would land on a page
  // offering to charge a wallet they don't have — and the money-blind surface would be showing money
  // framing. accept_quote would refuse them anyway; this stops the wrong page rendering at all.
  const session = await getServerSession();
  if (session?.role && session.role !== 'customer') redirect('/manager/quotes');

  const quote = await getQuoteByToken(token);
  if (!quote) notFound();

  // What they can actually pay with. Shown up front so "Accept" is never a surprise.
  const supabase = await createClient();
  const { data: bal } = await supabase.from('customer_balances').select('balance').maybeSingle();
  return <QuoteView quote={quote} balance={bal ? Number(bal.balance) : 0} />;
}
