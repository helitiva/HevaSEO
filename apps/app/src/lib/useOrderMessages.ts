'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UUID_RE } from '@/lib/orderMap';
import type { OrderComment } from '@/data/mock';

// inc-E30 — client lazy-fetch of an order's real thread (order_messages), RLS-scoped via the browser
// client: a customer gets non-internal only, staff/admin/pod-manager get all. Mirrors useOrderDetail.
// Returns OrderComment[] so existing comment UIs render unchanged, plus reload() to refresh after a post.
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

type Row = { body: string; internal: boolean; created_at: string; author: { name: string | null } | null };

export function useOrderMessages(orderId: string | null): { comments: OrderComment[]; reload: () => void } {
  const [comments, setComments] = useState<OrderComment[]>([]);
  const load = useCallback(() => {
    if (!orderId || !UUID_RE.test(orderId)) { setComments([]); return; }
    let active = true;
    const supabase = createClient();
    supabase
      .from('order_messages')
      .select('body, internal, created_at, author:profiles!order_messages_author_id_fkey(name)')
      .eq('order_id', orderId)
      .order('created_at')
      .returns<Row[]>()
      .then(({ data }) => {
        if (!active) return;
        setComments((data ?? []).map((m) => {
          const author = m.author?.name ?? 'Someone';
          return {
            author, initials: initialsOf(author), text: m.body, internal: m.internal,
            time: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          };
        }));
      });
    return () => { active = false; };
  }, [orderId]);
  useEffect(() => { const cleanup = load(); return cleanup; }, [load]);
  return { comments, reload: load };
}
