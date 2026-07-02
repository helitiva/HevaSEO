'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewDeliveryAction } from '@/app/(portal)/order.actions';
import type { DeliveredOrder } from '@/data/orders.server';

// Customer-facing "your delivery is ready" list: one line per DELIVERED order + a countdown to
// auto-approval (auto_approve_stale_deliveries approves after AUTO_APPROVE_GRACE_DAYS). Clicking a row
// opens a slide-over with the delivered work + the approve / send-back actions. Real writes via
// advance_order (delivered → approved | changes_requested).
const AUTO_APPROVE_GRACE_DAYS = 7; // keep in sync with auto_approve_stale_deliveries(p_grace_days)
const DAY_MS = 86_400_000;

function daysLeft(deliveredAt: string | null): number | null {
  if (!deliveredAt) return null;
  const deadline = new Date(deliveredAt).getTime() + AUTO_APPROVE_GRACE_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((deadline - Date.now()) / DAY_MS));
}
const countdownLabel = (n: number) => (n <= 0 ? 'Auto-approves today' : `Auto-approves in ${n} day${n === 1 ? '' : 's'}`);

function Countdown({ deliveredAt, className = '' }: { deliveredAt: string | null; className?: string }) {
  const n = daysLeft(deliveredAt);
  if (n === null) return null;
  const urgent = n <= 2;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgent ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-muted-foreground'} ${className}`}>
      <i className="ph-bold ph-clock-countdown" aria-hidden />{countdownLabel(n)}
    </span>
  );
}

export function DeliveredReview({ orders }: { orders: DeliveredOrder[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveredOrder | null>(null);
  const [closing, setClosing] = useState(false);

  const close = () => { setClosing(true); setTimeout(() => { setSelected(null); setClosing(false); setErr(null); }, 200); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!orders.length) return null;

  const act = (id: string, action: 'approve' | 'request_changes') => {
    setBusy(action); setErr(null);
    startTransition(async () => {
      const res = await reviewDeliveryAction(id, action);
      setBusy(null);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
      close();
    });
  };

  const sel = selected;
  const files = Array.isArray(sel?.deliverable?.files) ? (sel!.deliverable!.files as unknown[]) : [];

  return (
    <section aria-labelledby="delivered-heading" className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2">
        <i className="ph-bold ph-package text-primary" aria-hidden />
        <h2 id="delivered-heading" className="display text-lg font-semibold tracking-tight">Ready for your review</h2>
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{orders.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Your team delivered these. Open one to review, approve, or send back — we’ll auto-approve after {AUTO_APPROVE_GRACE_DAYS} days if we don’t hear back.</p>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {orders.map((o) => (
          <li key={o.id}>
            <button
              type="button" onClick={() => { setErr(null); setSelected(o); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/50"
            >
              <i className="ph-bold ph-package shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{o.service}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">{o.code}</span>
              </span>
              <Countdown deliveredAt={o.deliveredAt} className="hidden sm:inline-flex" />
              <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {/* slide-over order detail */}
      {sel && (
        <div className="fixed inset-0 z-[60]">
          <div className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 bg-black/60 backdrop-blur-sm`} onClick={close} />
          <aside
            role="dialog" aria-modal="true" aria-label={`Order ${sel.code}`}
            className={`${closing ? 'order-panel-out' : 'order-panel'} scrollbar-thin absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-border bg-card`}
          >
            <div className="flex flex-col gap-4 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted-foreground">{sel.code}</p>
                  <h3 className="display truncate text-xl font-semibold tracking-tight">{sel.service}</h3>
                </div>
                <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-accent">
                  <i className="ph-bold ph-x" aria-hidden />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-[13px] font-semibold text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Delivered
                </span>
                <Countdown deliveredAt={sel.deliveredAt} />
              </div>

              <div className="border-y border-border py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivered work{sel.deliverable ? ` · v${sel.deliverable.version}` : ''}</p>
                {sel.deliverable ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sel.deliverable.summary || 'No summary provided.'}</p>
                    {files.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {files.map((f, i) => {
                          const url = typeof f === 'object' && f && 'url' in f ? String((f as { url: unknown }).url) : typeof f === 'string' ? f : null;
                          const label = typeof f === 'object' && f && 'label' in f ? String((f as { label: unknown }).label) : url ?? `Attachment ${i + 1}`;
                          return (
                            <li key={i}>
                              {url
                                ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><i className="ph-bold ph-link" aria-hidden />{label}</a>
                                : <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><i className="ph-bold ph-paperclip" aria-hidden />{label}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">The delivered files will appear here.</p>
                )}
              </div>

              {err && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

              <div className="flex flex-col gap-2">
                <button
                  type="button" disabled={pending} onClick={() => act(sel.id, 'approve')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  <i className="ph-bold ph-check-circle" aria-hidden />{busy === 'approve' ? 'Approving…' : 'Approve delivery'}
                </button>
                <button
                  type="button" disabled={pending} onClick={() => act(sel.id, 'request_changes')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-40"
                >
                  <i className="ph-bold ph-arrow-u-up-left" aria-hidden />{busy === 'request_changes' ? 'Sending…' : 'Request changes'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
