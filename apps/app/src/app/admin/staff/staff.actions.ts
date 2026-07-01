'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Lane C/A inc-E23 — admin provisions a staff member (shadow profile + details + wallet; the person
// claims it by signing up with the same email). Admin-gated via create_staff_member.
export type CreateStaffResult = { ok: true } | { ok: false; error: string };

export async function createStaffMemberAction(input: {
  name: string; email: string; roleLabel: string; capacity: number; skills: string[];
}): Promise<CreateStaffResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_staff_member', {
    p_name: input.name, p_email: input.email, p_role_label: input.roleLabel,
    p_capacity: input.capacity, p_skills: input.skills,
  });
  if (error) {
    const map: Record<string, string> = {
      NOT_ADMIN: 'Only an admin can add staff.', BAD_EMAIL: 'Enter a valid email.', BAD_NAME: 'Enter a name.',
      EMAIL_TAKEN: 'An account with this email already exists.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/admin/staff');
  return { ok: true };
}
