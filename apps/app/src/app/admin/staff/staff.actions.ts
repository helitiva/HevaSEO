'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { provisionInviteLogin } from '@/lib/provisionInvite';

// Lane C/A inc-E23 — admin provisions a staff member (shadow profile + details + wallet), then creates
// the login (temp password) and links it (privileged shadows are no longer self-claimable via open
// signup — see 20260701450000). Admin-gated via create_staff_member.
export type CreateStaffResult = { ok: true; tempPassword: string } | { ok: false; error: string };

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
  const login = await provisionInviteLogin(input.email, input.name);
  if (!login.ok) return { ok: false, error: login.error };
  revalidatePath('/admin/staff');
  return { ok: true, tempPassword: login.tempPassword };
}
