import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { RecEvent } from '@/lib/broadcastAnalytics';
import type { BroadcastAudience } from '@/data/broadcasts';

// Lane C inc-C6 — REAL broadcast engagement, built from the actual roster (tenant profiles whose role is
// in the broadcast's audiences) + the real broadcast_events log. Returns RecEvent[] in the exact shape
// the existing pure aggregators (summarize / readTimeline / audienceBreakdown / hourOfDayHistogram) expect,
// so the analytics UI just swaps its data source from synthetic to real. Admin-only (broadcast_events +
// profiles RLS gate to the admin's tenant).
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

type ProfileRow = { id: string; name: string; role: string };
type EventRow = { user_id: string; kind: string; created_at: string };

export async function getBroadcastAnalytics(broadcastId: string): Promise<RecEvent[]> {
  const supabase = await createClient();
  const { data: bc, error: bErr } = await supabase
    .from('broadcasts').select('audiences, scheduled_at, created_at').eq('id', broadcastId).maybeSingle();
  if (bErr) throw new Error(`getBroadcastAnalytics broadcast: ${bErr.message}`);
  if (!bc) return [];
  const audiences = (bc.audiences ?? []) as BroadcastAudience[];
  const deliveredAt = new Date((bc.scheduled_at ?? bc.created_at) as string).getTime();

  const [{ data: profiles, error: pErr }, { data: events, error: eErr }] = await Promise.all([
    supabase.from('profiles').select('id, name, role').in('role', audiences).returns<ProfileRow[]>(),
    supabase.from('broadcast_events').select('user_id, kind, created_at').eq('broadcast_id', broadcastId).returns<EventRow[]>(),
  ]);
  if (pErr) throw new Error(`getBroadcastAnalytics roster: ${pErr.message}`);
  if (eErr) throw new Error(`getBroadcastAnalytics events: ${eErr.message}`);

  // first read/click timestamp per user
  const readAt = new Map<string, number>();
  const clickAt = new Map<string, number>();
  for (const e of events ?? []) {
    const t = new Date(e.created_at).getTime();
    const m = e.kind === 'click' ? clickAt : e.kind === 'read' ? readAt : null;
    if (m && (!m.has(e.user_id) || t < (m.get(e.user_id) as number))) m.set(e.user_id, t);
  }

  return (profiles ?? []).map((p): RecEvent => ({
    id: `${p.role}:${p.id}`,
    refId: p.id,
    name: p.name,
    sub: p.role,
    initials: initialsOf(p.name),
    audience: p.role as BroadcastAudience,
    deliveredAt,
    readAt: readAt.get(p.id) ?? null,
    clickedAt: clickAt.get(p.id) ?? null,
    ackedAt: null,      // ack/dismiss have no DB event log (UI-local) → not surfaced in real analytics
    dismissedAt: null,
    channel: null,
    isYou: false,
  }));
}

// Lightweight per-broadcast read/click/total counts for the admin list (real). total = roster size
// (tenant profiles whose role is in each broadcast's audiences).
export type BroadcastCounts = { read: number; clicks: number; total: number };
export async function getBroadcastReadCounts(): Promise<Record<string, BroadcastCounts>> {
  const supabase = await createClient();
  const [{ data: bcs, error: bErr }, { data: profiles, error: pErr }, { data: events, error: eErr }] = await Promise.all([
    supabase.from('broadcasts').select('id, audiences').returns<{ id: string; audiences: string[] }[]>(),
    supabase.from('profiles').select('id, role').returns<{ id: string; role: string }[]>(),
    supabase.from('broadcast_events').select('broadcast_id, user_id, kind').returns<{ broadcast_id: string; user_id: string; kind: string }[]>(),
  ]);
  if (bErr || pErr || eErr) throw new Error(`getBroadcastReadCounts: ${bErr?.message ?? pErr?.message ?? eErr?.message}`);

  const rosterByRole = new Map<string, number>();
  for (const p of profiles ?? []) rosterByRole.set(p.role, (rosterByRole.get(p.role) ?? 0) + 1);

  const reads = new Map<string, Set<string>>();
  const clicks = new Map<string, Set<string>>();
  for (const e of events ?? []) {
    const m = e.kind === 'click' ? clicks : e.kind === 'read' ? reads : null;
    if (!m) continue;
    if (!m.has(e.broadcast_id)) m.set(e.broadcast_id, new Set());
    m.get(e.broadcast_id)!.add(e.user_id);
  }

  const out: Record<string, BroadcastCounts> = {};
  for (const b of bcs ?? []) {
    const total = (b.audiences ?? []).reduce((s, a) => s + (rosterByRole.get(a) ?? 0), 0);
    out[b.id] = { read: reads.get(b.id)?.size ?? 0, clicks: clicks.get(b.id)?.size ?? 0, total };
  }
  return out;
}
