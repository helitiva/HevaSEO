'use server';

import { createClient } from '@/lib/supabase/server';

// Lane C inc-C6 — recipient read-receipts. The signed-in user marks a broadcast read/clicked; the
// claims-derived DB fns record an append-only broadcast_events row (idempotent per user+broadcast).
// No revalidate: the provider holds optimistic read state so the bell/inbox update instantly.
export async function markBroadcastReadAction(broadcastId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('mark_broadcast_read', { p_broadcast: broadcastId });
}

export async function markBroadcastClickAction(broadcastId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('mark_broadcast_click', { p_broadcast: broadcastId });
}

// Dismissing a banner/site-alert is durable per-account (kind 'dismissed', implies read).
export async function markBroadcastDismissedAction(broadcastId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('mark_broadcast_dismissed', { p_broadcast: broadcastId });
}
