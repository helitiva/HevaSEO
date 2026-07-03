'use server';

import { createClient } from '@/lib/supabase/server';
import type { AdminTicket, TicketMessage, TicketType, TicketChannel, TicketStatus } from '@/data/adminMock';
import type { Priority, SlaTier } from '@/data/adminMock';

// Agent-side tickets (admin sees all, staff sees assigned — via RLS). Mapped to the AdminTicket shape the
// existing TicketsClient renders; dossier/order extras resolve best-effort (null) for real rows.
const rel = (iso: string | null): string => {
  if (!iso) return '';
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

type Row = {
  id: string; code: string; subject: string; type: TicketType; channel: TicketChannel; status: TicketStatus;
  priority: Priority; sla_tier: SlaTier; created_at: string; last_reply_at: string | null;
  customer: { name: string | null; company: string | null } | null;
  assignee: { name: string | null } | null;
  order: { code: string | null } | null;
  ticket_messages: { author_role: string; body: string; created_at: string; attachments: unknown }[] | null;
};
const toAttachments = (v: unknown): import('@/data/mock').MessageAttachment[] => (Array.isArray(v) ? v.filter((a): a is import('@/data/mock').MessageAttachment =>
  !!a && typeof a === 'object' && typeof (a as { url?: unknown }).url === 'string' &&
  ((a as { kind?: unknown }).kind === 'image' || (a as { kind?: unknown }).kind === 'video')) : []);

export async function getAgentTicketsAction(): Promise<AdminTicket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('id, code, subject, type, channel, status, priority, sla_tier, created_at, last_reply_at, customer:customers(name, company), assignee:profiles!tickets_assignee_id_fkey(name), order:orders(code), ticket_messages(author_role, body, created_at, attachments)')
    .order('last_reply_at', { ascending: false, nullsFirst: false })
    .returns<Row[]>();
  if (error) return [];
  return (data ?? []).map((t) => {
    const custName = t.customer?.company || t.customer?.name || 'Customer';
    const thread: TicketMessage[] = (t.ticket_messages ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m) => ({ from: m.author_role === 'customer' ? 'customer' : 'staff', author: m.author_role === 'customer' ? custName : (t.assignee?.name ?? 'Support'), text: m.body, at: rel(m.created_at), attachments: toAttachments(m.attachments) }));
    return {
      id: t.id, code: `#${t.code}`, subject: t.subject,
      customer: custName, customerId: null, // real uuid won't match the mock dossier; keep null
      type: t.type, channel: t.channel, status: t.status, priority: t.priority,
      assignee: t.assignee?.name ?? null, slaTier: t.sla_tier, orderCode: t.order?.code ? `#${t.order.code}` : null,
      createdAt: t.created_at, lastReplyAt: t.last_reply_at ?? t.created_at, age: rel(t.created_at),
      thread,
    };
  });
}

export async function replyTicketAction(ticketId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('post_ticket_message', { p_ticket: ticketId, p_body: body });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setTicketStatusAction(ticketId: string, status: TicketStatus): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ticket_status', { p_ticket: ticketId, p_status: status });
  return error ? { ok: false, error: error.message } : { ok: true };
}
