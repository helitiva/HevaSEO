'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewDeliveryAction } from '@/app/(portal)/order.actions';
import type { DeliveredOrder } from '@/data/orders.server';

// Customer-facing "your delivery is ready" strip: for each DELIVERED order the customer either approves
// (delivered → approved) or sends it back for revision (delivered → changes_requested). Real writes via
// advance_order (RLS + allowed-transitions enforced server-side); optimistic list removal on success.
export function DeliveredReview({ orders }: { orders: DeliveredOrder[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'approved' | 'changes_requested'>>({});

  if (!orders.length) return null;

  const act = (id: string, action: 'approve' | 'request_changes') => {
    setBusy(`${id}:${action}`); setErr(null);
    startTransition(async () => {
      const res = await reviewDeliveryAction(id, action);
      setBusy(null);
      if (!res.ok) { setErr(res.error); return; }
      setDone((d) => ({ ...d, [id]: action === 'approve' ? 'approved' : 'changes_requested' }));
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="delivered-heading" className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2">
        <i className="ph-bold ph-package text-primary" aria-hidden />
        <h2 id="delivered-heading" className="display text-lg font-semibold tracking-tight">Ready for your review</h2>
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{orders.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Your team delivered these. Approve to close them out, or send back for revision.</p>

      {err && <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      <ul className="mt-4 space-y-2.5">
        {orders.map((o) => {
          const verdict = done[o.id];
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.service}</p>
                <p className="text-xs text-muted-foreground">{o.code}</p>
              </div>
              {verdict ? (
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${verdict === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <i className={`ph-bold ${verdict === 'approved' ? 'ph-check-circle' : 'ph-arrow-u-up-left'}`} aria-hidden />
                  {verdict === 'approved' ? 'Approved — thank you!' : 'Sent back for revision'}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button" disabled={pending}
                    onClick={() => act(o.id, 'request_changes')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    <i className="ph-bold ph-arrow-u-up-left" aria-hidden />
                    {busy === `${o.id}:request_changes` ? 'Sending…' : 'Request changes'}
                  </button>
                  <button
                    type="button" disabled={pending}
                    onClick={() => act(o.id, 'approve')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <i className="ph-bold ph-check-circle" aria-hidden />
                    {busy === `${o.id}:approve` ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
