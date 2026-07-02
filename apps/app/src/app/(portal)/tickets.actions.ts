'use server';

import { createClient } from '@/lib/supabase/server';

// Real customer support tickets + chat (RLS-scoped reads; participant-gated write fns).
export type TicketType = 'technical' | 'billing' | 'consultation';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type Ticket = { id: string; code: string; subject: string; type: TicketType; status: TicketStatus; open: boolean; lastReplyAt: string | null };
export type TicketMessage = { id: string; mine: boolean; role: string; body: string; createdAt: string };

const OPEN_STATES: TicketStatus[] = ['open', 'pending'];
type TicketRow = { id: string; code: string; subject: string; type: TicketType; status: TicketStatus; last_reply_at: string | null };
const toTicket = (r: TicketRow): Ticket => ({ id: r.id, code: r.code, subject: r.subject, type: r.type, status: r.status, open: OPEN_STATES.includes(r.status), lastReplyAt: r.last_reply_at });

export async function getMyTicketsAction(): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets').select('id, code, subject, type, status, last_reply_at')
    .order('last_reply_at', { ascending: false, nullsFirst: false }).returns<TicketRow[]>();
  if (error) return [];
  return (data ?? []).map(toTicket);
}

type MsgRow = { id: string; author_role: string; body: string; created_at: string };
export async function getTicketThreadAction(ticketId: string): Promise<TicketMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_messages').select('id, author_role, body, created_at').eq('ticket_id', ticketId)
    .order('created_at', { ascending: true }).returns<MsgRow[]>();
  if (error) return [];
  return (data ?? []).map((m) => ({ id: m.id, mine: m.author_role === 'customer', role: m.author_role, body: m.body, createdAt: m.created_at }));
}

export type TicketResult = { ok: true; ticket: Ticket } | { ok: false; error: string };
export async function createTicketAction(subject: string, type: TicketType, body: string): Promise<TicketResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_ticket', { p_subject: subject, p_type: type, p_body: body }).returns<TicketRow>();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not open the ticket.' };
  return { ok: true, ticket: toTicket(data) };
}

export async function postTicketMessageAction(ticketId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('post_ticket_message', { p_ticket: ticketId, p_body: body });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setTicketStatusAction(ticketId: string, status: TicketStatus): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ticket_status', { p_ticket: ticketId, p_status: status });
  return error ? { ok: false, error: error.message } : { ok: true };
}
