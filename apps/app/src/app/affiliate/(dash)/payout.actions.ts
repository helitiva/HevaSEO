'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AffiliatePayoutResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_AFFILIATE: 'Only an affiliate can request a payout.',
  BELOW_MIN: 'Minimum payout is $50.',
  INSUFFICIENT_BALANCE: 'Not enough cleared balance for that amount.',
};

// Lane E inc-E2 — the signed-in affiliate withdraws from their OWN commission balance, MONEY (gác③).
// request_affiliate_payout is claims-derived + own-affiliate-only + granted authenticated; it does the
// atomic debit + payout row (balance stays == SUM(commission_ledger)).
export async function requestAffiliatePayoutAction(amount: number): Promise<AffiliatePayoutResult> {
  if (!Number.isFinite(amount) || amount < 50) return { ok: false, error: 'Minimum payout is $50.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_affiliate_payout', { p_amount: amount });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/affiliate');
  revalidatePath('/affiliate/payouts');
  return { ok: true };
}
