'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import type { MessageAttachment } from '@/data/mock';

// Real customer support tickets + chat (RLS-scoped reads; participant-gated write fns).
export type TicketType = 'technical' | 'billing' | 'consultation';
export type TicketPriority = 'low' | 'med' | 'high';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type Ticket = { id: string; code: string; subject: string; type: TicketType; priority: TicketPriority; status: TicketStatus; open: boolean; lastReplyAt: string | null; orderCode: string | null };
export type TicketMessage = { id: string; mine: boolean; role: string; author: string; body: string; attachments: MessageAttachment[]; createdAt: string };
export type TicketDetail = {
  id: string; code: string; subject: string; type: TicketType; priority: TicketPriority; status: TicketStatus; open: boolean;
  orderCode: string | null; agent: string | null; slaTier: string; createdAt: string; lastReplyAt: string | null;
  csat: { rating: number; note: string | null } | null;
  thread: TicketMessage[];
};

const OPEN_STATES: TicketStatus[] = ['open', 'pending'];
const toAttachments = (v: unknown): MessageAttachment[] => (Array.isArray(v) ? v.filter((a): a is MessageAttachment =>
  !!a && typeof a === 'object' && typeof (a as MessageAttachment).url === 'string' &&
  ((a as MessageAttachment).kind === 'image' || (a as MessageAttachment).kind === 'video')) : []);

type TicketRow = { id: string; code: string; subject: string; type: TicketType; priority: TicketPriority; status: TicketStatus; last_reply_at: string | null; order: { code: string | null } | null };
const toTicket = (r: TicketRow): Ticket => ({ id: r.id, code: r.code, subject: r.subject, type: r.type, priority: r.priority ?? 'med', status: r.status, open: OPEN_STATES.includes(r.status), lastReplyAt: r.last_reply_at, orderCode: r.order?.code ?? null });

export async function getMyTicketsAction(): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets').select('id, code, subject, type, priority, status, last_reply_at, order:orders(code)')
    .order('last_reply_at', { ascending: false, nullsFirst: false }).returns<TicketRow[]>();
  if (error) return [];
  return (data ?? []).map(toTicket);
}

type MsgRow = { id: string; author_role: string; body: string; attachments: unknown; created_at: string; author: { name: string | null } | null };
const toMsg = (m: MsgRow): TicketMessage => ({
  id: m.id, mine: m.author_role === 'customer', role: m.author_role,
  author: m.author_role === 'customer' ? 'You' : (m.author?.name ?? 'Support'),
  body: m.body, attachments: toAttachments(m.attachments), createdAt: m.created_at,
});

export async function getTicketThreadAction(ticketId: string): Promise<TicketMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_messages').select('id, author_role, body, attachments, created_at, author:profiles!ticket_messages_author_id_fkey(name)').eq('ticket_id', ticketId)
    .order('created_at', { ascending: true }).returns<MsgRow[]>();
  if (error) return [];
  return (data ?? []).map(toMsg);
}

// Full ticket detail for the 2-pane view: meta (priority/status/agent/order/SLA/CSAT) + the thread.
type DetailRow = {
  id: string; code: string; subject: string; type: TicketType; priority: TicketPriority; status: TicketStatus;
  sla_tier: string; created_at: string; last_reply_at: string | null; csat_rating: number | null; csat_note: string | null;
  assignee: { name: string | null } | null; order: { code: string | null } | null;
};
export async function getTicketDetailAction(ticketId: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const [tk, thread] = await Promise.all([
    supabase.from('tickets')
      .select('id, code, subject, type, priority, status, sla_tier, created_at, last_reply_at, csat_rating, csat_note, assignee:profiles!tickets_assignee_id_fkey(name), order:orders(code)')
      .eq('id', ticketId).maybeSingle().returns<DetailRow>(),
    getTicketThreadAction(ticketId),
  ]);
  if (tk.error || !tk.data) return null;
  const d = tk.data;
  return {
    id: d.id, code: d.code, subject: d.subject, type: d.type, priority: d.priority ?? 'med', status: d.status,
    open: OPEN_STATES.includes(d.status), orderCode: d.order?.code ?? null, agent: d.assignee?.name ?? null,
    slaTier: d.sla_tier, createdAt: d.created_at, lastReplyAt: d.last_reply_at,
    csat: d.csat_rating != null ? { rating: d.csat_rating, note: d.csat_note } : null,
    thread,
  };
}

export type TicketResult = { ok: true; ticket: Ticket } | { ok: false; error: string };
export async function createTicketAction(subject: string, type: TicketType, body: string, priority: TicketPriority = 'med', orderCode?: string): Promise<TicketResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_ticket', {
    p_subject: subject, p_type: type, p_body: body, p_priority: priority, p_order_code: orderCode || undefined,
  }).returns<TicketRow>();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not open the ticket.' };
  return { ok: true, ticket: toTicket(data) };
}

export async function postTicketMessageAction(ticketId: string, body: string, attachments: MessageAttachment[] = []): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('post_ticket_message', { p_ticket: ticketId, p_body: body, p_attachments: attachments as unknown as Json });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setTicketStatusAction(ticketId: string, status: TicketStatus): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ticket_status', { p_ticket: ticketId, p_status: status });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function rateTicketAction(ticketId: string, rating: number, note?: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('rate_ticket', { p_ticket: ticketId, p_rating: rating, p_note: note || undefined });
  return error ? { ok: false, error: error.message } : { ok: true };
}
