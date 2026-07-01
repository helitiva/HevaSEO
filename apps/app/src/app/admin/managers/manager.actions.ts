'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// inc-E24 — admin provisions a manager or admin (shadow profile + wallet for managers; the person claims
// it by signing up with the same email). Admin-gated via create_manager.
export type CreateManagerResult = { ok: true } | { ok: false; error: string };

export async function createManagerAction(input: { name: string; email: string; role: 'manager' | 'admin' }): Promise<CreateManagerResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_manager', { p_name: input.name, p_email: input.email, p_role: input.role });
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
