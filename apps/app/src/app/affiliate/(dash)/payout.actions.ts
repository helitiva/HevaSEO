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

// Lane E inc-E12 — the signed-in affiliate edits their OWN marketing profile (platform/niche/audience).
// update_affiliate_profile is claims-derived + own-affiliate-only.
export async function updateAffiliateProfileAction(input: { platform: string; niche: string; audience: string }): Promise<AffiliatePayoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_affiliate_profile', {
    p_platform: input.platform, p_niche: input.niche, p_audience: input.audience,
  });
  if (error) {
    if (error.message.includes('NOT_AFFILIATE')) return { ok: false, error: 'Only an affiliate can edit this profile.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/affiliate/settings');
  revalidatePath('/affiliate');
  return { ok: true };
}
