'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type PenaltyResult = { ok: true } | { ok: false; error: string };

// Lane D inc-D5 — admin applies / waives a staff penalty, MONEY (gác③). apply_penalty debits the
// worker's wallet; waive_penalty refunds it. Both admin-gated in the DB fn.
export async function applyPenaltyAction(staffId: string, amount: number, type: string, detail: string): Promise<PenaltyResult> {
  if (!staffId) return { ok: false, error: 'Pick a staffer.' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a positive amount.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_penalty', { p_staff: staffId, p_amount: amount, p_type: type, p_detail: detail || undefined });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can apply penalties.' };
    if (error.message.includes('NO_WALLET')) return { ok: false, error: 'That staffer has no wallet yet.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/finance');
  return { ok: true };
}

export async function waivePenaltyAction(penaltyId: string): Promise<PenaltyResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('waive_penalty', { p_id: penaltyId });
  if (error) {
    if (error.message.includes('ALREADY_WAIVED')) return { ok: false, error: 'Already waived.' };
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can waive penalties.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/finance');
  return { ok: true };
}
