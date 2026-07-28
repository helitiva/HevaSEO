'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Broadcast } from '@/data/broadcasts';

export type BroadcastResult = { ok: true; id: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can manage broadcasts.',
  INVALID_TITLE: 'Give the broadcast a title.',
  NO_AUDIENCE: 'Pick at least one audience.',
  INVALID_AUDIENCE: 'Pick a valid audience.',
  INVALID_KIND: 'Pick a valid message kind.',
  INVALID_STATUS: 'Invalid status.',
  BROADCAST_NOT_FOUND: 'That broadcast no longer exists.',
};
const mapErr = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ''] ?? m;
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// revalidate every surface that renders broadcasts (admin console + all recipient portals via layout)
function revalidateAll() {
  for (const p of ['/admin/broadcasts', '/dashboard', '/inbox', '/staff/inbox', '/manager/inbox', '/affiliate/inbox']) revalidatePath(p);
}

// Lane C inc-C5 — admin composes/sends/edits a broadcast (article HTML sanitized client-side at the
// composer). upsert_broadcast is admin-gated + claims-derived; broadcasts is SELECT-only via RLS.
export async function saveBroadcastAction(b: Broadcast): Promise<BroadcastResult> {
  if (!b.title.trim()) return { ok: false, error: 'Give the broadcast a title.' };
  if (b.audiences.length === 0) return { ok: false, error: 'Pick at least one audience.' };
  const scheduled = Boolean(b.publishAt) && new Date(b.publishAt as string).getTime() > Date.now();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_broadcast', {
    p_title: b.title.trim(), p_body: b.body, p_audiences: b.audiences, p_display_kind: b.kind,
    p_banner: b.banner, p_pinned: Boolean(b.pinned), p_require_ack: Boolean(b.requireAck),
    p_status: scheduled ? 'scheduled' : 'live',
    // nullable params: omit when empty (the fn defaults them to null — passing null fails the typegen)
    ...(b.cta ? { p_cta: { label: b.cta.label, href: b.cta.href } } : {}),
    ...(b.article ? { p_article: b.article } : {}),
    ...(b.publishAt ? { p_scheduled_at: b.publishAt } : {}),
    ...(b.expiresAt ? { p_expires_at: b.expiresAt } : {}),
    ...(isUuid(b.id) ? { p_id: b.id } : {}), // real uuid → update; mock/new id → insert
  }).select('id').single();
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidateAll();
  return { ok: true, id: (data as { id: string }).id };
}

export async function setBroadcastActiveAction(id: string, active: boolean): Promise<SimpleResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_broadcast_status', { p_id: id, p_status: active ? 'live' : 'recalled' });
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidateAll();
  return { ok: true };
}

export async function deleteBroadcastAction(id: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_broadcast', { p_id: id });
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidateAll();
  return { ok: true };
}
