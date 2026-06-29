'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/data/adminMock';

export type AdvanceResult = { ok: true } | { ok: false; error: string };

// Lane A inc-4 — first real write. Advance an order via the hardened advance_order RPC, called with
// the caller's session client: the function derives actor/role/tenant from JWT claims and enforces
// the allowed-transitions + ownership rules server-side, so this action just forwards intent.
export async function advanceOrderAction(orderId: string, to: OrderStatus): Promise<AdvanceResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('advance_order', { p_order: orderId, p_to: to });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
