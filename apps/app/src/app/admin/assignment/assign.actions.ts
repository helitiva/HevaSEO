'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getOrderById, getPodOrderById, getOrderDetail } from '@/data/orders.server';
import { getStaff } from '@/data/staff.server';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import type { OrderDetailProps } from '@/app/admin/orders/[id]/OrderDetailClient';

export type AssignResult = { ok: true } | { ok: false; error: string };

/** A real staffer the order can actually be assigned to. `id` is a real profile UUID. */
export type EligibleStaff = {
  id: string; name: string; composite: number; quality: number; onTime: number;
  openLoad: number; capacity: number; skills: string[];
};

const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize' };

/**
 * Who can actually take this order — real staff, with real ids.
 *
 * buildOrderDetailProps used to derive this from the adminMock STAFF constant, which has no real ids at
 * all (s1..s6). That's why the picker's assign handler took a NAME and could only fake it: there was
 * nothing to pass to assign_order. Skills come from staff_details, load from the live order counts.
 */
export async function getEligibleStaffAction(service: string, orderId: string): Promise<EligibleStaff[]> {
  const supabase = await createClient();
  const [staff, loadRes] = await Promise.all([
    getStaff(),
    supabase.from('orders').select('assignee_id')
      .in('state', ['assigned', 'in_progress', 'internal_review', 'changes_requested'])
      .returns<{ assignee_id: string | null }[]>(),
  ]);
  if (loadRes.error) throw new Error(`getEligibleStaffAction load: ${loadRes.error.message}`);
  const loadBy = new Map<string, number>();
  for (const o of loadRes.data ?? []) if (o.assignee_id) loadBy.set(o.assignee_id, (loadBy.get(o.assignee_id) ?? 0) + 1);

  const skill = SKILL_OF[service];
  const active = staff.filter((s) => s.active);
  // skill-matched first; if nobody matches, offer everyone rather than an empty picker — assign_order
  // is the authority on what's actually allowed and will reject anything invalid.
  const matched = skill ? active.filter((s) => s.skills.includes(skill)) : [];
  const pool = matched.length ? matched : active;
  return pool
    .map((s) => ({
      id: s.id, name: s.name, composite: s.composite, quality: s.quality, onTime: s.onTime,
      openLoad: loadBy.get(s.id) ?? 0, capacity: s.capacity, skills: s.skills,
    }))
    .sort((a, b) => b.composite - a.composite || a.openLoad - b.openLoad);
}

// The assignment slide-over must show the REAL order (queue items are real UUIDs; the old client-side
// mock lookup returned null for them → a blank panel). Admins read the base orders table (with money);
// managers/staff have NO RLS on that table and read the money-stripped orders_mgr view instead — so try
// the full read first, then fall back to the pod view. getOrderDetail is non-money (brief/project) and
// addons come back empty via RLS for money-blind viewers, so prices never reach them.
export async function getOrderPanelPropsAction(orderId: string): Promise<OrderDetailProps | null> {
  const [order, detail] = await Promise.all([
    getOrderById(orderId).then((o) => o ?? getPodOrderById(orderId)),
    getOrderDetail(orderId),
  ]);
  return order ? buildOrderDetailProps(order, detail) : null;
}

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
