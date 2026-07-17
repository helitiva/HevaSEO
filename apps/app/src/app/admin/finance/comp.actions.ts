'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type SetCompResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can set compensation.',
  BAD_SALARY: 'Base salary must be 0 or more.',
  BAD_RATE: 'Commission must be between 0 and 100%.',
  NOT_STAFF_OR_MANAGER: 'That person isn’t a staff member or manager.',
};

/** Set one person's base salary + commission %. The RPC is admin-gated and validates server-side. */
export async function setStaffCompAction(profileId: string, baseSalary: number, commissionPct: number): Promise<SetCompResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_staff_comp', {
    p_profile: profileId, p_base: baseSalary, p_pct: commissionPct,
  });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/finance');
  revalidatePath('/admin/staff');
  return { ok: true };
}
