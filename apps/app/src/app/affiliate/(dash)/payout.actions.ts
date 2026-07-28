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

// Lane E inc-E12/E14 — the signed-in affiliate edits their OWN profile (name + marketing metadata).
// update_affiliate_profile is claims-derived + own-affiliate-only.
export async function updateAffiliateProfileAction(input: { name: string; platform: string; niche: string; audience: string }): Promise<AffiliatePayoutResult> {
  if (!input.name.trim()) return { ok: false, error: 'Enter a display name.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_affiliate_profile', {
    p_name: input.name, p_platform: input.platform, p_niche: input.niche, p_audience: input.audience,
  });
  if (error) {
    if (error.message.includes('BAD_NAME')) return { ok: false, error: 'Enter a display name.' };
    if (error.message.includes('NOT_AFFILIATE')) return { ok: false, error: 'Only an affiliate can edit this profile.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/affiliate/settings');
  revalidatePath('/affiliate');
  return { ok: true };
}

// Lane E inc-E15 — the signed-in affiliate manages their OWN payout methods (add / set-default / remove).
const METHOD_ERR: Record<string, string> = {
  NOT_AFFILIATE: 'Only an affiliate can manage payout methods.',
  INVALID_KIND: 'Choose a valid payout type.', INVALID_DETAIL: 'Enter the payout details.',
  METHOD_NOT_FOUND: 'That payout method no longer exists.',
};
function mapMethodError(message: string): string {
  const key = Object.keys(METHOD_ERR).find((k) => message.includes(k));
  return key ? METHOD_ERR[key] : message;
}
export async function addAffiliatePayoutMethodAction(input: { kind: string; detail: string; makeDefault: boolean }): Promise<AffiliatePayoutResult> {
  if (!input.detail.trim()) return { ok: false, error: 'Enter the payout details.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_affiliate_payout_method', { p_kind: input.kind, p_detail: input.detail, p_make_default: input.makeDefault });
  if (error) return { ok: false, error: mapMethodError(error.message) };
  revalidatePath('/affiliate/settings'); revalidatePath('/affiliate'); revalidatePath('/affiliate/payouts');
  return { ok: true };
}
export async function setDefaultAffiliatePayoutMethodAction(id: string): Promise<AffiliatePayoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_default_affiliate_payout_method', { p_id: id });
  if (error) return { ok: false, error: mapMethodError(error.message) };
  revalidatePath('/affiliate/settings'); revalidatePath('/affiliate'); revalidatePath('/affiliate/payouts');
  return { ok: true };
}
export async function removeAffiliatePayoutMethodAction(id: string): Promise<AffiliatePayoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_affiliate_payout_method', { p_id: id });
  if (error) return { ok: false, error: mapMethodError(error.message) };
  revalidatePath('/affiliate/settings'); revalidatePath('/affiliate'); revalidatePath('/affiliate/payouts');
  return { ok: true };
}

// Lane E inc-E14 — the signed-in affiliate changes their OWN referral code (unique per tenant).
export async function setAffiliateCodeAction(code: string): Promise<AffiliatePayoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_affiliate_code', { p_code: code });
  if (error) {
    if (error.message.includes('BAD_CODE')) return { ok: false, error: '3–20 letters and numbers only.' };
    if (error.message.includes('CODE_TAKEN')) return { ok: false, error: 'That code is already taken.' };
    if (error.message.includes('NOT_AFFILIATE')) return { ok: false, error: 'Only an affiliate can change this code.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/affiliate/settings');
  revalidatePath('/affiliate');
  return { ok: true };
}
