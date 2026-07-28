'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// inc-E29 — a participant (admin / assigned staff / owning customer) posts a message on an order. The fn
// is participant-gated + forces a customer's message non-internal.
export type PostMessageResult = { ok: true } | { ok: false; error: string };

export async function postOrderMessageAction(orderId: string, body: string, internal: boolean): Promise<PostMessageResult> {
  if (!body.trim()) return { ok: false, error: 'Message is empty.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('post_order_message', { p_order: orderId, p_body: body, p_internal: internal });
  if (error) {
    if (error.message.includes('NOT_PARTICIPANT')) return { ok: false, error: 'You’re not a participant on this order.' };
    if (error.message.includes('ORDER_NOT_FOUND')) return { ok: false, error: 'That order no longer exists.' };
    if (error.message.includes('EMPTY_MESSAGE')) return { ok: false, error: 'Message is empty.' };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/staff/tasks/${orderId}`);
  return { ok: true };
}
