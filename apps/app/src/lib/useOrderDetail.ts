'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UUID_RE } from '@/lib/orderMap';
import type { OrderDetailExtra } from '@/lib/orderDetail';

// Client-side lazy fetch of an order's extras (order_details + order_addons) for the slide-over
// previews, which are client components and can't await a server read. RLS-scoped to the signed-in
// user via the browser client — so a manager/staff gets the brief but addons come back empty (money-
// blind), exactly like the server path. Returns undefined while loading / for non-real ids → callers
// fall back to the mock/default brief. Pass null to skip.
export function useOrderDetail(orderId: string | null): OrderDetailExtra | undefined {
  const [detail, setDetail] = useState<OrderDetailExtra | undefined>(undefined);
  useEffect(() => {
    if (!orderId || !UUID_RE.test(orderId)) { setDetail(undefined); return; }
    let active = true;
    const supabase = createClient();
    (async () => {
      const [det, add] = await Promise.all([
        supabase.from('order_details').select('project, folder, brief, included').eq('order_id', orderId).maybeSingle(),
        supabase.from('order_addons').select('name, tier, price').eq('order_id', orderId),
      ]);
      if (!active) return;
      if (det.error || !det.data) { setDetail(undefined); return; }
      setDetail({
        project: det.data.project,
        folder: det.data.folder,
        brief: Array.isArray(det.data.brief) ? (det.data.brief as OrderDetailExtra['brief']) : [],
        included: det.data.included ?? [],
        addons: (add.data ?? []).map((a) => ({ name: a.name, tier: a.tier ?? '', price: Number(a.price) })),
      });
    })();
    return () => { active = false; };
  }, [orderId]);
  return detail;
}
