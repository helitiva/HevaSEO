'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
