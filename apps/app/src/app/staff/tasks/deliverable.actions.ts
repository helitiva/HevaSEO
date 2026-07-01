'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// inc-E27 — the assigned staff submits a deliverable version on their order (records the real row; the
// order state move to internal_review stays advance_order). Claims-derived + assignee-only in the fn.
export type SubmitDeliverableResult = { ok: true } | { ok: false; error: string };

type DeliverableFile = { kind: string; fileName?: string | null; url?: string | null };

export async function submitDeliverableAction(orderId: string, summary: string, files: DeliverableFile[] = []): Promise<SubmitDeliverableResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_deliverable', { p_order: orderId, p_summary: summary, p_files: files });
  if (error) {
    if (error.message.includes('NOT_STAFF')) return { ok: false, error: 'Only staff can submit work.' };
    if (error.message.includes('NOT_YOUR_ORDER')) return { ok: false, error: 'This task isn’t assigned to you.' };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/staff/tasks/${orderId}`);
  revalidatePath('/admin/review');
  return { ok: true };
}
