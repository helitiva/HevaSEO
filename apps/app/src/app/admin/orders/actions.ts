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

// MONEY (gác③): cancel_order refunds the order value − 5% fee to dashboard credit. The hardened RPC
// allows only an admin or the owning customer, and only while the order is still planned
// (new|confirmed|assigned); it keeps balance == SUM(ledger). This action just forwards the caller's
// session — authz + the refund ledger are enforced server-side.
export async function cancelOrderAction(orderId: string): Promise<AdvanceResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_order', { p_order: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
