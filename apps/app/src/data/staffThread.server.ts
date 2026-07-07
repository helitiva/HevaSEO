import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { StaffMessage } from '@/data/staffMock';

// The real private manager↔staff thread (staff_manager_messages). RLS scopes it: a staffer sees their own
// thread, a manager sees their pod staff's. 'You' marks the viewer's own messages (drives right-alignment).
function rel(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

type Row = { body: string; author_role: string; created_at: string; author: { name: string | null } | null };
const SEL = 'body, author_role, created_at, author:profiles!staff_manager_messages_author_id_fkey(name)';

const toMsg = (viewerRole: 'staff' | 'manager') => (m: Row): StaffMessage => ({
  who: m.author_role === viewerRole ? 'You' : (m.author?.name ?? (m.author_role === 'manager' ? 'Manager' : 'Staff')),
  body: m.body, internal: true, at: rel(m.created_at),
});

/** The signed-in staffer's own thread with their manager (RLS gates to staff_id = them). */
export async function getMyManagerThread(): Promise<StaffMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('staff_manager_messages').select(SEL).order('created_at', { ascending: true }).returns<Row[]>();
  return (data ?? []).map(toMsg('staff'));
}

/** A pod staffer's thread, read by their manager (RLS gates to the manager's pod). */
export async function getStaffThread(staffId: string): Promise<StaffMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('staff_manager_messages').select(SEL).eq('staff_id', staffId).order('created_at', { ascending: true }).returns<Row[]>();
  return (data ?? []).map(toMsg('manager'));
}
