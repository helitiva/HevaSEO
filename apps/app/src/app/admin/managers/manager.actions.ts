'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// inc-E24 — admin provisions a manager or admin (shadow profile + wallet for managers; the person claims
// it by signing up with the same email). Admin-gated via create_manager.
export type CreateManagerResult = { ok: true } | { ok: false; error: string };

export async function createManagerAction(input: { name: string; email: string; role: 'manager' | 'admin'; title?: string; rank?: string }): Promise<CreateManagerResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_manager', {
    p_name: input.name, p_email: input.email, p_role: input.role,
    p_title: input.title || undefined, p_rank: input.rank || undefined,
  });
  if (error) {
    const map: Record<string, string> = {
      NOT_ADMIN: 'Only an admin can add managers.', BAD_EMAIL: 'Enter a valid email.', BAD_NAME: 'Enter a name.',
      BAD_ROLE: 'Choose a valid role.', EMAIL_TAKEN: 'An account with this email already exists.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/admin/managers');
  return { ok: true };
}

// inc-E25 — admin sets/clears a staff member's pod manager (staff_details.manager_id). null = unassign.
export async function assignStaffToManagerAction(staffId: string, managerId: string | null): Promise<CreateManagerResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_staff_to_manager', { p_staff: staffId, p_manager: managerId ?? undefined });
  if (error) {
    const map: Record<string, string> = {
      NOT_ADMIN: 'Only an admin can assign pods.', NOT_STAFF: 'That person is not a staff member.',
      NOT_MANAGER: 'That target is not a manager.', STAFF_DETAILS_MISSING: 'Staff record is incomplete.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/admin/managers');
  return { ok: true };
}
