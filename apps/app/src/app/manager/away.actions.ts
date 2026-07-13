'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AwayToggleResult = { ok: true; on: boolean; assigned: number } | { ok: false; error: string };

// Flip the manager's away/auto-assign flag. Turning it ON immediately sweeps the current unassigned queue
// through auto_assign_order (server-side, skill + load aware) and reports how many orders were routed. The RPC
// is claims-derived (manager only) and does the privileged writes; this action just forwards the intent.
export async function setAwayAutoAssignAction(on: boolean): Promise<AwayToggleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_away_auto_assign', { p_on: on });
  if (error) {
    const msg = error.message.includes('NOT_MANAGER')
      ? 'Only a manager can toggle away auto-assign.' : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath('/manager');
  revalidatePath('/manager/assignment');
  revalidatePath('/staff/tasks');
  return { ok: true, on, assigned: data ?? 0 };
}

/** The calling manager's current away flag (JWT-derived; safe against profiles' multi-row manager reads). */
export async function getAwayAutoAssign(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_away_auto_assign');
  return Boolean(data);
}
