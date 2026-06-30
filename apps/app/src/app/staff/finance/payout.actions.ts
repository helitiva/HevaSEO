'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type PayoutResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Not enough available balance for that amount.',
  BELOW_MIN: 'Minimum payout is $50.',
  NOT_STAFF: 'Only staff can request a payout.',
  BAD_METHOD: 'Choose a valid payout method.',
};

// Lane D inc-D3 — the signed-in staffer requests a payout from their OWN wallet, MONEY (gác③). Runs as
// the staffer's session (not service-role): request_payout is claims-derived + own-wallet-only + granted
// to authenticated, so it can't touch anyone else's wallet. The fn does the atomic debit + guards.
export async function requestPayoutAction(amount: number, methodId: string | null): Promise<PayoutResult> {
  if (!Number.isFinite(amount) || amount < 50) return { ok: false, error: 'Minimum payout is $50.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_payout', { p_amount: amount, p_method: methodId || undefined });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/staff/finance');
  return { ok: true };
}

// Lane D inc-D5 — the worker disputes one of their own applied penalties (no money change; admin reviews).
export async function disputePenaltyAction(penaltyId: string, note: string): Promise<PayoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('dispute_penalty', { p_id: penaltyId, p_note: note });
  if (error) {
    if (error.message.includes('NOT_DISPUTABLE')) return { ok: false, error: 'This penalty can no longer be disputed.' };
    if (error.message.includes('PENALTY_NOT_FOUND')) return { ok: false, error: 'Penalty not found.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/staff/finance');
  return { ok: true };
}
