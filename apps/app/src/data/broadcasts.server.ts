import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Broadcast, BroadcastAudience, BroadcastKind, BroadcastCta } from '@/data/broadcasts';

// Lane C inc-C4 — the signed-in user's real broadcasts, array-RLS-scoped: the `broadcasts` table policy
// returns only messages whose `audiences` include the viewer's role (admin sees all via /admin). Recalled
// + draft are filtered out here; the client applies publishAt/expiresAt timing (isLive). Read/dismiss/ack
// state stays client-side for now (real broadcast_events receipts = a later increment).
type Row = {
  id: string;
  title: string;
  body: string | null;
  article: string | null;
  display_kind: string;
  audiences: string[];
  banner: boolean;
  pinned: boolean;
  cta: BroadcastCta | null;
  status: string;
  scheduled_at: string | null;
  expires_at: string | null;
  require_ack: boolean;
  created_at: string;
  updated_at: string | null;
};

const KINDS = new Set<BroadcastKind>(['congrats', 'notice', 'info', 'warning', 'maintenance', 'outage']);
const toKind = (k: string): BroadcastKind => (KINDS.has(k as BroadcastKind) ? (k as BroadcastKind) : 'notice');

function toBroadcast(r: Row): Broadcast {
  return {
    id: r.id,
    title: r.title,
    body: r.body ?? '',
    article: r.article ?? undefined,
    kind: toKind(r.display_kind),
    audiences: (r.audiences ?? []) as BroadcastAudience[],
    banner: r.banner,
    pinned: r.pinned,
    cta: r.cta ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
    publishAt: r.scheduled_at ?? null,
    expiresAt: r.expires_at ?? null,
    requireAck: r.require_ack,
    active: r.status !== 'recalled',
    system: false, // real DB broadcast → admin-editable (recipient surfaces are read-only by UI anyway)
  };
}

const COLS = 'id, title, body, article, display_kind, audiences, banner, pinned, cta, status, scheduled_at, expires_at, require_ack, created_at, updated_at';

export async function getMyBroadcasts(): Promise<Broadcast[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('broadcasts')
    .select(COLS)
    .in('status', ['live', 'scheduled'])
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`getMyBroadcasts: ${error.message}`);
  return (data ?? []).map(toBroadcast);
}

// Lane C inc-C6 — the broadcast ids the signed-in user has already read (their own broadcast_events,
// RLS user-own). Drives the real unread state in the bell + inbox (replaces the localStorage read set).
export async function getMyBroadcastReadIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('broadcast_events')
    .select('broadcast_id')
    .eq('kind', 'read')
    .returns<{ broadcast_id: string }[]>();
  if (error) throw new Error(`getMyBroadcastReadIds: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.broadcast_id))];
}

/** Broadcast ids this user has dismissed (banner/site-alert), so they stay hidden per-account. */
export async function getMyBroadcastDismissedIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('broadcast_events')
    .select('broadcast_id')
    .eq('kind', 'dismissed')
    .returns<{ broadcast_id: string }[]>();
  if (error) throw new Error(`getMyBroadcastDismissedIds: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.broadcast_id))];
}

// Lane C inc-C5 — admin sees ALL tenant broadcasts (broadcasts_admin RLS), incl recalled + draft, for
// the management console. active=false marks recalled (the manager surfaces that as the "Recalled" state).
export async function getBroadcasts(): Promise<Broadcast[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('broadcasts')
    .select(COLS)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`getBroadcasts: ${error.message}`);
  return (data ?? []).map(toBroadcast);
}
