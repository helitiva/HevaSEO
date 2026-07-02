'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewDeliveryAction } from '@/app/(portal)/order.actions';
import type { DeliveredOrder } from '@/data/orders.server';

// Customer-facing "your delivery is ready" strip: for each DELIVERED order the customer either approves
// (delivered → approved) or sends it back for revision (delivered → changes_requested). Real writes via
// advance_order. Each card shows a countdown to auto-approval (the system approves after AUTO_APPROVE_
// GRACE_DAYS via auto_approve_stale_deliveries) and expands to show the delivered work.
const AUTO_APPROVE_GRACE_DAYS = 7; // keep in sync with auto_approve_stale_deliveries(p_grace_days)
const DAY_MS = 86_400_000;

function daysLeft(deliveredAt: string | null): number | null {
  if (!deliveredAt) return null;
  const deadline = new Date(deliveredAt).getTime() + AUTO_APPROVE_GRACE_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((deadline - Date.now()) / DAY_MS));
}
function countdownLabel(n: number): string {
  if (n <= 0) return 'Auto-approves today';
  return `Auto-approves in ${n} day${n === 1 ? '' : 's'}`;
}

export function DeliveredReview({ orders }: { orders: DeliveredOrder[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'approved' | 'changes_requested'>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

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
      <p className="mt-1 text-sm text-muted-foreground">Your team delivered these. Approve to close them out, or send back for revision — we’ll auto-approve after {AUTO_APPROVE_GRACE_DAYS} days if we don’t hear back.</p>

      {err && <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {orders.map((o) => {
          const verdict = done[o.id];
          const left = daysLeft(o.deliveredAt);
          const urgent = left !== null && left <= 2;
          const isOpen = open[o.id];
          const files = Array.isArray(o.deliverable?.files) ? (o.deliverable!.files as unknown[]) : [];
          return (
            <div key={o.id} className="flex flex-col rounded-xl border border-border bg-card">
              <button
                type="button" onClick={() => setOpen((s) => ({ ...s, [o.id]: !s[o.id] }))}
                aria-expanded={isOpen}
                className="flex items-start justify-between gap-3 rounded-t-xl px-4 py-3 text-left transition hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.service}</p>
                  <p className="text-xs text-muted-foreground">{o.code}{o.deliverable ? ` · v${o.deliverable.version}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {left !== null && (
                    <span className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex ${urgent ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      <i className="ph-bold ph-clock-countdown" aria-hidden />{countdownLabel(left)}
                    </span>
                  )}
                  <i className={`ph-bold ${isOpen ? 'ph-caret-up' : 'ph-caret-down'} text-muted-foreground`} aria-hidden />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border px-4 py-3 text-sm">
                  {o.deliverable ? (
                    <>
                      <p className="whitespace-pre-wrap text-muted-foreground">{o.deliverable.summary || 'No summary provided.'}</p>
                      {files.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {files.map((f, i) => {
                            const url = typeof f === 'object' && f && 'url' in f ? String((f as { url: unknown }).url) : typeof f === 'string' ? f : null;
                            const label = typeof f === 'object' && f && 'label' in f ? String((f as { label: unknown }).label) : url ?? `Attachment ${i + 1}`;
                            return (
                              <li key={i}>
                                {url
                                  ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><i className="ph-bold ph-link" aria-hidden />{label}</a>
                                  : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className="ph-bold ph-paperclip" aria-hidden />{label}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">The delivered files will appear here.</p>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                {left !== null && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium sm:hidden ${urgent ? 'text-amber-700' : 'text-muted-foreground'}`}>
                    <i className="ph-bold ph-clock-countdown" aria-hidden />{countdownLabel(left)}
                  </span>
                )}
                {verdict ? (
                  <span className={`ml-auto inline-flex items-center gap-1.5 text-sm font-semibold ${verdict === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    <i className={`ph-bold ${verdict === 'approved' ? 'ph-check-circle' : 'ph-arrow-u-up-left'}`} aria-hidden />
                    {verdict === 'approved' ? 'Approved — thank you!' : 'Sent back for revision'}
                  </span>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button" disabled={pending} onClick={() => act(o.id, 'request_changes')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-40"
                    >
                      <i className="ph-bold ph-arrow-u-up-left" aria-hidden />
                      {busy === `${o.id}:request_changes` ? 'Sending…' : 'Request changes'}
                    </button>
                    <button
                      type="button" disabled={pending} onClick={() => act(o.id, 'approve')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                    >
                      <i className="ph-bold ph-check-circle" aria-hidden />
                      {busy === `${o.id}:approve` ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
