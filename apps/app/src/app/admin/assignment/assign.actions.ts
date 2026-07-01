'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AssignResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_AUTHORIZED: 'Only an admin or manager can assign orders.',
  NOT_YOUR_POD: 'You can only assign within your own pod.',
  NOT_ADMIN: 'Only an admin can assign orders.',
  NOT_STAFF: 'Pick a staff member to assign to.',
  ORDER_NOT_FOUND: 'That order no longer exists.',
  ORDER_CLOSED: 'This order is already delivered/closed.',
};

// Assign an order to staff, gác③ (order state + assignee). assign_order is claims-derived: admin
// (any order/staff) or a manager (only within their pod); it sets assignee_id and advances
// confirmed→assigned. Orders are SELECT-only via RLS, so the write goes through the fn.
export async function assignOrderAction(orderId: string, staffId: string): Promise<AssignResult> {
  if (!staffId) return { ok: false, error: 'Pick a staff member to assign to.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_order', { p_order: orderId, p_staff: staffId });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/assignment');
  revalidatePath('/manager/assignment');
  revalidatePath('/staff/tasks');
  return { ok: true };
}
