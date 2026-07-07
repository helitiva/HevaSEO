'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ChatResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  EMPTY_BODY: 'Type a message first.',
  NOT_YOUR_POD: 'You can only message staff in your pod.',
  STAFF_REQUIRED: 'Pick a staff member.',
  NOT_AUTHORIZED: 'You are not allowed to post here.',
};

// Post to the manager↔staff thread. A staffer posts to their own thread (staffId ignored → derived from
// the session by the fn); a manager posts to one of their pod staffers (pass their id).
export async function postManagerChatAction(body: string, staffId: string | null = null): Promise<ChatResult> {
  const supabase = await createClient();
  // p_staff is null for a staffer (the fn derives their own thread) — the generated type is non-null, so cast.
  const { error } = await supabase.rpc('post_staff_manager_message', { p_staff: staffId as unknown as string, p_body: body });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/staff/tasks', 'layout');
  revalidatePath('/manager/staff', 'layout');
  return { ok: true };
}
