'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ResolveResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can resolve payouts.',
  REQUEST_NOT_FOUND: 'That payout request no longer exists.',
  ALREADY_RESOLVED: 'This request was already resolved.',
  BAD_ACTION: 'Unknown action.',
};

// Lane D inc-D4 — admin resolves a staff payout request, MONEY (gác③). Runs as the admin's session;
// resolve_payout is admin-gated (claims role='admin') + atomic, and reject refunds the wallet.
export async function resolvePayoutAction(requestId: string, action: 'approve' | 'pay' | 'reject'): Promise<ResolveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_payout', { p_request: requestId, p_action: action });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/finance');
  return { ok: true };
}
