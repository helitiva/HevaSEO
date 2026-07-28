'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type QuoteResult = { ok: true; token?: string } | { ok: false; error: string };

/** DB exception → something a human can act on. Anything unmapped surfaces raw rather than as a lie. */
function readable(msg: string): string {
  if (msg.includes('NOT_AUTHORIZED')) return 'Only a manager or admin can price a quote.';
  if (msg.includes('INVALID_AMOUNT')) return 'Enter an amount greater than 0.';
  if (msg.includes('INVALID_VALIDITY')) return 'Validity must be between 1 and 90 days.';
  if (msg.includes('QUOTE_NOT_FOUND')) return 'That quote no longer exists.';
  if (msg.includes('QUOTE_CLOSED')) return 'This quote was already accepted or declined — it can’t be re-priced.';
  if (msg.includes('QUOTE_NOT_OPEN')) return 'This quote isn’t open any more.';
  if (msg.includes('QUOTE_EXPIRED')) return 'This quote has expired. Ask your specialist for a fresh one.';
  if (msg.includes('NOT_YOUR_QUOTE')) return 'This quote belongs to another account.';
  if (msg.includes('INSUFFICIENT_CREDIT')) return 'Not enough credit — top up to accept this quote.';
  return msg;
}

/**
 * Price a quote. MANAGER (or admin) only — enforced in create_quote from the JWT claims, not from
 * anything this action passes. Re-pricing an open quote is allowed on purpose: customers haggle.
 */
export async function createQuoteAction(
  quoteId: string, amount: number, note: string, validDays: number,
): Promise<QuoteResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than 0.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_quote', {
    p_quote: quoteId, p_amount: amount, p_note: note.trim() || undefined, p_valid_days: validDays,
  });
  if (error) return { ok: false, error: readable(error.message) };
  revalidatePath('/manager/quotes');
  revalidatePath('/admin/orders');
  return { ok: true, token: (data as { token?: string } | null)?.token };
}

/** The customer accepts: their wallet is debited for the quoted amount and the order is created. */
export async function acceptQuoteAction(token: string): Promise<QuoteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_quote', { p_token: token });
  if (error) return { ok: false, error: readable(error.message) };
  revalidatePath(`/quote/${token}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function declineQuoteAction(token: string): Promise<QuoteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decline_quote', { p_token: token });
  if (error) return { ok: false, error: readable(error.message) };
  revalidatePath(`/quote/${token}`);
  return { ok: true };
}
