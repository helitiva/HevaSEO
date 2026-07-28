'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// The manager's standing modes — hands-off switches they flip in the topbar. Both RPCs are claims-derived
// (manager only) and do the privileged writes; these actions just forward the intent.

export type AwayToggleResult = { ok: true; on: boolean; assigned: number } | { ok: false; error: string };

// Away → auto-assign. Turning it ON immediately sweeps the current unassigned queue through
// auto_assign_order (skill + load aware) and reports how many orders were routed.
export async function setAwayAutoAssignAction(on: boolean): Promise<AwayToggleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_away_auto_assign', { p_on: on });
  if (error) {
    const msg = error.message.includes('NOT_MANAGER')
      ? 'Only a manager can toggle away auto-assign.' : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath('/manager');
  revalidatePath('/manager/assignment');
  revalidatePath('/staff/tasks');
  return { ok: true, on, assigned: data ?? 0 };
}

export type AutoReviewResult = { ok: true; on: boolean; delivered: number } | { ok: false; error: string };

// Auto-review. Turning it ON also clears whatever is already waiting in the review queue and reports how
// many submissions were delivered.
export async function setAutoReviewAction(on: boolean): Promise<AutoReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_auto_review', { p_on: on });
  if (error) {
    const msg = error.message.includes('NOT_MANAGER')
      ? 'Only a manager can toggle auto-review.' : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath('/manager');
  revalidatePath('/manager/review');
  revalidatePath('/staff/tasks');
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true, on, delivered: data ?? 0 };
}

/** The calling manager's current modes (JWT-derived; safe against profiles' multi-row manager reads). */
export async function getManagerModes(): Promise<{ away: boolean; autoReview: boolean }> {
  const supabase = await createClient();
  const [away, autoReview] = await Promise.all([
    supabase.rpc('my_away_auto_assign'),
    supabase.rpc('my_auto_review'),
  ]);
  return { away: Boolean(away.data), autoReview: Boolean(autoReview.data) };
}
