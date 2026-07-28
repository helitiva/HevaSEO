'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// inc-E28 — admin OR the pod-manager approves / requests changes on a submitted deliverable (records the
// verdict; the order state move stays advance_order, called alongside from the client). Claims-derived +
// pod-scoped for managers + idempotent in the fn.
export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function reviewDeliverableAction(deliverableId: string, action: 'approve' | 'request_changes', note?: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('review_deliverable', { p_deliverable: deliverableId, p_action: action, p_note: note || undefined });
  if (error) {
    const map: Record<string, string> = {
      NOT_AUTHORIZED: 'Only an admin or manager can review.', NOT_YOUR_POD: 'You can only review your own pod’s work.',
      NOT_ADMIN: 'Only an admin can review.', BAD_ACTION: 'Invalid review action.',
      DELIVERABLE_NOT_FOUND: 'That submission no longer exists.', ALREADY_REVIEWED: 'This version is already reviewed.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/admin/review');
  revalidatePath('/manager/review');
  return { ok: true };
}
