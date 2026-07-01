'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TierId } from '@/lib/affiliate';

export type ResolveResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can resolve payouts.',
  REQUEST_NOT_FOUND: 'That payout request no longer exists.',
  ALREADY_RESOLVED: 'This payout is already settled.',
  BAD_ACTION: 'Invalid action.',
};

// Lane E inc-E3 — admin resolves an affiliate payout, MONEY (gác③). resolve_affiliate_payout is
// admin-gated + idempotent; reject refunds the held amount to the affiliate's commission balance.
export async function resolveAffiliatePayoutAction(payoutId: string, action: 'approve' | 'pay' | 'reject'): Promise<ResolveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_affiliate_payout', { p_request: payoutId, p_action: action });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/affiliate');
  revalidatePath('/affiliate'); revalidatePath('/affiliate/payouts');
  return { ok: true };
}

// Lane E inc-E5 — admin approves/suspends/reactivates a partner. UI status ('active'|'pending'|'suspended')
// → set_affiliate_status maps 'suspended'→'churned'. Admin-gated.
export async function setAffiliateStatusAction(affiliateId: string, status: 'active' | 'pending' | 'suspended'): Promise<ResolveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_affiliate_status', { p_affiliate: affiliateId, p_status: status });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change a partner’s status.' };
    if (error.message.includes('AFFILIATE_NOT_FOUND')) return { ok: false, error: 'That partner no longer exists.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}

// Lane E inc-E6 — admin pins a partner's tier (override the volume ladder) or reverts to auto (tier=null).
// Admin-gated via set_affiliate_tier.
export async function setAffiliateTierAction(affiliateId: string, tier: TierId | null): Promise<ResolveResult> {
  const supabase = await createClient();
  // null tier → omit p_tier so the fn's `default null` revert-to-auto path runs
  const { error } = await supabase.rpc('set_affiliate_tier', { p_affiliate: affiliateId, p_tier: tier ?? undefined });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change a partner’s tier.' };
    if (error.message.includes('AFFILIATE_NOT_FOUND')) return { ok: false, error: 'That partner no longer exists.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}
