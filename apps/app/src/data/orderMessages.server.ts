import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { StaffMessage } from '@/data/staffMock';
import type { MessageAttachment } from '@/data/mock';

// inc-E29 — the real order thread (RLS-scoped: admin all / assigned staff all / customer non-internal).
type Row = { body: string; internal: boolean; created_at: string; attachments: unknown; author: { name: string | null } | null };

function toAttachments(v: unknown): MessageAttachment[] {
  if (!Array.isArray(v)) return [];
  return v.filter((a): a is MessageAttachment =>
    !!a && typeof a === 'object' && typeof (a as MessageAttachment).url === 'string' &&
    ((a as MessageAttachment).kind === 'image' || (a as MessageAttachment).kind === 'video'));
}

export async function getOrderMessages(orderId: string): Promise<StaffMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_messages')
    .select('body, internal, created_at, attachments, author:profiles!order_messages_author_id_fkey(name)')
    .eq('order_id', orderId)
    .order('created_at')
    .returns<Row[]>();
  if (error) throw new Error(`getOrderMessages: ${error.message}`);
  return (data ?? []).map((m) => ({
    who: m.author?.name ?? 'Someone',
    body: m.body,
    internal: m.internal,
    attachments: toAttachments(m.attachments),
    at: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}
