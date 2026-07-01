import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { StaffMessage } from '@/data/staffMock';

// inc-E29 — the real order thread (RLS-scoped: admin all / assigned staff all / customer non-internal).
type Row = { body: string; internal: boolean; created_at: string; author: { name: string | null } | null };

export async function getOrderMessages(orderId: string): Promise<StaffMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_messages')
    .select('body, internal, created_at, author:profiles!order_messages_author_id_fkey(name)')
    .eq('order_id', orderId)
    .order('created_at')
    .returns<Row[]>();
  if (error) throw new Error(`getOrderMessages: ${error.message}`);
  return (data ?? []).map((m) => ({
    who: m.author?.name ?? 'Someone',
    body: m.body,
    internal: m.internal,
    at: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}
