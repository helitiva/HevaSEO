'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ORDERS, SERVICES, STATUSES,
  projectForDomain, projectIdForDomain, folderPathForDomain,
  deliverablesFor, activityFor, intakeFor,
  type Order, type OrderStatus,
} from '@/data/mock';
import { useOrdersStore, useComments } from './OrdersStore';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { UUID_RE } from '@/lib/orderMap';
import { getCustomerOrderDetailAction, reviewDeliveryAction, type CustomerOrderDetail } from '@/app/(portal)/order.actions';
import { useOrderMessages } from '@/lib/useOrderMessages';
import { postOrderMessageAction } from '@/app/staff/tasks/message.actions';

const DELIV_PILL: Record<'approved' | 'review' | 'rejected', { label: string; bg: string; fg: string }> = {
  approved: { label: 'Approved', bg: 'rgba(16,185,129,.15)', fg: '#059669' },
  review: { label: 'In review', bg: 'rgba(245,158,11,.18)', fg: '#b45309' },
  rejected: { label: 'Changes requested', bg: 'rgba(244,63,94,.15)', fg: '#e11d48' },
};

/** Interactive 1–5 star rating with its own hover preview. */
function Stars({ value, onChange, size = 'text-2xl' }: { value: number; onChange: (n: number) => void; size?: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className={`${size} leading-none transition hover:scale-110`}
        >
          <i className={`ph-fill ph-star ${n <= (hover || value) ? 'text-amber-500' : 'text-muted-foreground/30'}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Read-only star row for the submitted-review summary. */
function StarsStatic({ value, size = 'text-base' }: { value: number; size?: string }) {
  return (
    <div className={`flex gap-0.5 ${size}`}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star ${n <= value ? 'text-amber-500' : 'text-muted-foreground/30'}`} aria-hidden />)}
    </div>
  );
}

/** A property cell — label and value on one line — for the 3-column grid. */
function Cell({ icon, label, full, children }: { icon: string; label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${full ? 'col-span-3' : ''}`}>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground"><i className={`ph-bold ${icon}`} aria-hidden /> {label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{children}</span>
    </div>
  );
}

export function OrderDetailPanel() {
  const id = useSearchParams().get('order');
  const { addedOrders, realOrders } = useOrdersStore();
  // Resolve by id: session-placed orders → the customer's REAL orders (getMyOrders, id = order code) →
  // mock seed (demo fallback). Real orders are the primary source now the board reads live data.
  const order = id
    ? (addedOrders.find((o) => o.id === id) ?? realOrders.find((o) => o.id === id) ?? ORDERS.find((o) => o.id === id))
    : undefined;
  if (!order) return null;
  return <Panel key={order.id} order={order} />;
}

function Panel({ order }: { order: Order }) {
  const router = useRouter();
  const pathname = usePathname();
  const { statusOverrides, setStatus, addComment } = useOrdersStore();
  const toast = useToast();

  // Real, RLS-scoped detail (brief + delivered work + activity + the order uuid), fetched by code.
  const [detail, setDetail] = useState<CustomerOrderDetail | null>(null);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    void getCustomerOrderDetailAction(order.id).then((d) => { if (alive) setDetail(d); });
    return () => { alive = false; };
  }, [order.id]);
  const isReal = detail != null; // the order exists in the DB → show real data, no mock fallback

  // Order thread — real order_messages keyed by the real uuid (from the fetched detail, or the id when it
  // already is a uuid); mock only for demo/seed orders not in the DB.
  const orderUuid = detail?.id ?? (UUID_RE.test(order.id) ? order.id : null);
  const mockComments = useComments(order.id);
  const { comments: realComments, reload: reloadMsgs } = useOrderMessages(orderUuid);
  const comments = orderUuid ? realComments : mockComments;

  const status = statusOverrides[order.id] ?? order.status;
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [expandedDeliv, setExpandedDeliv] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [modal, setModal] = useState<null | 'message' | 'review'>(null);
  const [msg, setMsg] = useState('');
  // Customer service rating (per order — Panel remounts per order via key).
  const [rating, setRating] = useState(0);       // overall service
  const [attitude, setAttitude] = useState(0);   // staff attitude
  const [skill, setSkill] = useState(0);         // staff skill
  const [reviewNote, setReviewNote] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [reviewBusy, setReviewBusy] = useState<null | 'approve' | 'request_changes'>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const decideDelivery = (action: 'approve' | 'request_changes') => {
    if (!detail) return;
    setReviewBusy(action); setReviewErr(null);
    void reviewDeliveryAction(detail.id, action).then((r) => {
      setReviewBusy(null);
      if (!r.ok) { setReviewErr(r.error); return; }
      toast(action === 'approve' ? 'Delivery approved — thank you!' : 'Sent back for revision');
      router.refresh();
      close();
    });
  };

  const close = useCallback(() => {
    setClosing((c) => {
      if (!c) setTimeout(() => router.push(pathname, { scroll: false }), 230);
      return true;
    });
  }, [pathname, router]);

  // Close this panel and open the quick-order slide-over preset to the same service.
  const orderAgain = useCallback(() => {
    setClosing((c) => {
      if (!c) setTimeout(() => router.push(`${pathname}?neworder=${order.service}`, { scroll: false }), 230);
      return true;
    });
  }, [pathname, router, order.service]);

  useEffect(() => {
    // When a modal is open it owns Escape — don't also close the whole panel.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !modal) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, modal]);

  const st = STATUSES[status];
  const pid = projectIdForDomain(order.domain);
  const proj = projectForDomain(order.domain);
  const path = folderPathForDomain(order.domain);
  const p = order.progress ?? (status === 'completed' ? 100 : status === 'review' ? 95 : 8);
  const deliverables = isReal ? detail!.deliverables : deliverablesFor(order.id);
  const activity = isReal ? detail!.activity : activityFor(order);
  const intake = isReal ? detail!.brief : intakeFor(order);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 bg-black/60 backdrop-blur-sm`} onClick={close} />
      <aside className={`${closing ? 'order-panel-out' : 'order-panel'} scrollbar-thin absolute right-0 top-0 flex h-full w-full max-w-[550px] flex-col overflow-y-auto border-l border-border bg-card`}>
        <div className="flex flex-col gap-3 p-5 sm:p-[30px]">
          {/* header */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70"><i className={`ph-bold ${SERVICES[order.service].icon}`} aria-hidden /> {SERVICES[order.service].label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">#{order.id}</span>
          </div>
          {/* title + status on one line */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="display min-w-0 truncate text-xl font-semibold tracking-tight">{order.title}</h2>
            <label className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: `${st.color}1f`, color: st.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
              {isReal ? (
                // real orders: status is driven by the workflow (not a free-pick dropdown) — read-only badge
                <span className="font-semibold">{st.label}</span>
              ) : (
              <select value={status} onChange={(e) => { const v = e.target.value as OrderStatus; setStatus(order.id, v); toast(`Moved to ${STATUSES[v].label}`); }} className="cursor-pointer bg-transparent font-semibold outline-none" style={{ color: st.color }}>
                {(Object.keys(STATUSES) as OrderStatus[]).map((s) => <option key={s} value={s} className="text-foreground">{STATUSES[s].label}</option>)}
              </select>
              )}
            </label>
          </div>

          {/* delivered-work review — the customer approves or sends the delivery back */}
          {order.awaitingReview && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium"><i className="ph-bold ph-package text-primary" aria-hidden /> This delivery is ready for your review.</p>
              {reviewErr && <p role="alert" className="mb-2 text-[12px] text-destructive">{reviewErr}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={!detail || !!reviewBusy} onClick={() => decideDelivery('approve')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"><i className="ph-bold ph-check-circle" aria-hidden />{reviewBusy === 'approve' ? 'Approving…' : 'Approve delivery'}</button>
                <button type="button" disabled={!detail || !!reviewBusy} onClick={() => decideDelivery('request_changes')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 disabled:opacity-40"><i className="ph-bold ph-arrow-u-up-left" aria-hidden />{reviewBusy === 'request_changes' ? 'Sending…' : 'Request changes'}</button>
              </div>
            </div>
          )}

          {/* properties — 2-column grid, collapsible field set */}
          <div className="border-y border-border py-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <Cell icon="ph-tag" label="Service">
                <span className="inline-flex items-center gap-1.5"><i className={`ph-bold ${SERVICES[order.service].icon} text-muted-foreground`} aria-hidden /><span className="font-medium">{SERVICES[order.service].label}</span><span className="text-muted-foreground">· {order.sub}</span></span>
              </Cell>
              <Cell icon="ph-stack" label="Project">
                {pid ? <Link href={`/projects/${pid}`} className="font-semibold text-primary hover:underline">{proj?.name} <i className="ph-bold ph-arrow-up-right text-[11px]" aria-hidden /></Link> : <span>{proj?.name ?? '—'}</span>}
              </Cell>
              <Cell icon="ph-globe-simple" label="Website">
                <span className="font-medium">{order.multiWeb ? 'Multi-site' : order.domain}</span>{order.multiWeb && <span className="ml-1 rounded bg-muted px-1 text-[9px] font-bold uppercase text-foreground/60">multi</span>}
              </Cell>
              <Cell icon="ph-user" label="Assignee">
                <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">{order.owner.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>{order.owner}</span>
              </Cell>
              <Cell icon="ph-timer" label="ETA">{order.eta}</Cell>
              <Cell icon="ph-chart-line-up" label="Progress">
                <span className="flex items-center gap-1.5"><span className="bar flex-1"><i style={{ width: `${p}%` }} /></span><b className="shrink-0 font-semibold" style={{ color: st.color }}>{p}%</b></span>
              </Cell>

            </div>

            {/* extra fields — animated collapse/expand */}
            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: showAll ? '1fr' : '0fr' }}>
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 pt-2.5 sm:grid-cols-2">
                  <Cell icon="ph-calendar-blank" label="Created">{order.date}</Cell>
                  {order.urls != null && <Cell icon="ph-link" label="URLs">{order.urls.toLocaleString('en-US')}</Cell>}
                  <Cell icon="ph-folder-simple" label="Folder">
                    {path.map((f, i) => <span key={f.id} style={i === path.length - 1 ? { color: f.color, fontWeight: 600 } : undefined}>{i > 0 && <span className="text-muted-foreground/50"> › </span>}{f.name}</span>)}
                  </Cell>
                  <Cell icon="ph-wallet" label="Cost">${order.cost.toLocaleString('en-US')} · <span className={order.pay === 'paid' ? 'text-emerald-600' : 'text-amber-600'}>{order.pay === 'paid' ? 'Paid' : 'Pending'}</span></Cell>
                  {order.invoice && <Cell icon="ph-receipt" label="Invoice">{order.invoice}</Cell>}
                </div>
              </div>
            </div>

            <button onClick={() => setShowAll((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground">
              <i className={`ph-bold ph-caret-down transition-transform duration-300 ${showAll ? 'rotate-180' : ''}`} aria-hidden /> {showAll ? 'Show less' : 'Show all fields'}
            </button>
          </div>

          {/* order brief — the info the customer submitted at order time (varies by service) */}
          {intake.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <i className="ph-bold ph-note-pencil text-primary" aria-hidden /> Order brief
              </p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                {intake.map((f, i) => (
                  <div key={i} className={`min-w-0 ${f.full ? 'sm:col-span-2' : ''}`}>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-foreground">{f.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* deliverables */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
            {deliverables.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">No deliverables yet</p>
            ) : (
              <div className="space-y-1.5">
                {deliverables.map((d, i) => {
                  const dp = DELIV_PILL[d.status];
                  const open = expandedDeliv === i;
                  const revs = [...d.revisions].reverse(); // newest first
                  return (
                    <div key={i} className="overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setExpandedDeliv(open ? null : i)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-muted/40"
                      >
                        <i className={`ph-bold ph-caret-right shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                        <i className="ph-bold ph-file-text shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 truncate">{d.name}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{d.revisions.length} version{d.revisions.length > 1 ? 's' : ''}</span>
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: dp.bg, color: dp.fg }}>{dp.label}</span>
                      </button>
                      {open && (
                        <ol className="space-y-3 border-t border-border bg-muted/20 px-3 py-3">
                          {revs.map((r, ri) => {
                            const rp = DELIV_PILL[r.status];
                            return (
                              <li key={ri} className="border-l-2 pl-3" style={{ borderColor: rp.fg }}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground/70">{r.version}</span>
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: rp.bg, color: rp.fg }}>{rp.label}</span>
                                  <span className="text-[11px] text-muted-foreground">{r.date}</span>
                                </div>
                                {r.note && <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{r.note}</p>}
                                {r.files && r.files.length > 0 && (
                                  <div className="mt-1.5 space-y-1">
                                    {r.files.map((f, fi) => {
                                      const cls = 'flex w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-left text-[12px] transition hover:border-primary/50';
                                      const inner = (
                                        <>
                                          <i className={`ph-bold ${f.kind === 'link' ? 'ph-link-simple' : 'ph-file'} shrink-0 text-primary`} aria-hidden />
                                          <span className="min-w-0 truncate">{f.name}</span>
                                          {f.meta && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{f.meta}</span>}
                                          <i className={`ph-bold ${f.kind === 'link' ? 'ph-arrow-up-right' : 'ph-download-simple'} shrink-0 text-muted-foreground`} aria-hidden />
                                        </>
                                      );
                                      return f.url
                                        ? <a key={fi} href={f.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                                        : <button key={fi} type="button" onClick={() => toast(f.kind === 'link' ? `Opening ${f.name}` : `Downloading ${f.name}`)} className={cls}>{inner}</button>;
                                    })}
                                  </div>
                                )}
                                {r.feedback && (
                                  <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-600">
                                    <i className="ph-bold ph-chat-circle-text mr-1" aria-hidden /><span className="font-semibold">Your feedback:</span> {r.feedback}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* activity */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
            <div className="space-y-1 text-[12px] text-muted-foreground">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <i className={`ph-fill ph-circle text-[7px] ${i === 0 ? 'text-primary' : 'text-muted-foreground/50'}`} aria-hidden />
                  <span className={i === 0 ? 'text-foreground' : ''}>{a.label}</span>
                  <span className="ml-auto">{a.date}</span>
                </div>
              ))}
            </div>
          </section>

          {/* comments */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</p>
            <div className="space-y-3">
              {comments.map((c, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">{c.initials}</span>
                  <div className="min-w-0 text-[13px]">
                    <p className="font-semibold">{c.author} <span className="text-[11px] font-normal text-muted-foreground">· {c.time}</span>{c.internal && <span className="ml-1 rounded bg-muted px-1 text-[9px] font-bold uppercase text-foreground/60">internal</span>}</p>
                    <p className="mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const body = draft.trim();
                if (!body) return;
                setDraft('');
                if (orderUuid) {
                  void postOrderMessageAction(orderUuid, body, false).then((r) => {
                    if (!r.ok) { toast(r.error); return; }
                    reloadMsgs(); toast('Comment sent');
                  });
                } else { addComment(order.id, body); toast('Comment added'); }
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
              <button type="submit" aria-label="Send comment" className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50" disabled={!draft.trim()}><i className="ph-bold ph-paper-plane-tilt" aria-hidden /></button>
            </form>
          </section>
        </div>

        {/* footer actions */}
        <div className="sticky bottom-0 mt-auto flex gap-1.5 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:gap-2 sm:px-[30px] sm:py-3.5">
          <button onClick={() => setModal('message')} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border py-2 text-xs font-semibold transition hover:bg-accent sm:text-[13px]"><i className="ph-bold ph-chat-circle-dots" aria-hidden /> Message</button>
          {/* real orders drive approve/send-back from the "ready for your review" block above (delivered
              state); the footer only offers the mock quick-actions for demo/seed orders */}
          {!isReal && status === 'review' ? (
            <>
              <button onClick={() => { setStatus(order.id, 'progress'); toast('Changes requested', 'info'); }} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/40 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/10 sm:text-[13px]"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> <span className="sm:hidden">Changes</span><span className="hidden sm:inline">Request changes</span></button>
              <button onClick={() => { setStatus(order.id, 'completed'); toast('Order approved'); }} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 sm:text-[13px]"><i className="ph-bold ph-check" aria-hidden /> Approve</button>
            </>
          ) : (
            <>
              <button onClick={() => setModal('review')} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border py-2 text-xs font-semibold transition hover:bg-accent sm:text-[13px]"><i className="ph-bold ph-clipboard-text" aria-hidden /> Review</button>
              <button onClick={orderAgain} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:text-[13px]"><i className="ph-bold ph-plus" aria-hidden /> Order again</button>
            </>
          )}
          <button onClick={close} aria-label="Close" className="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground transition hover:bg-accent sm:hidden"><i className="ph-bold ph-x" aria-hidden /></button>
        </div>
      </aside>

      {/* Message — posts into the order's conversation */}
      {modal === 'message' && (
        <Modal
          onClose={() => setModal(null)}
          title={`Message ${order.owner !== 'Unassigned' ? order.owner : 'the team'}`}
          subtitle={`About order #${order.id}`}
          icon="ph-chat-circle-dots"
        >
          {({ close: closeModal }) => {
            const send = (e: React.FormEvent) => {
              e.preventDefault();
              const t = msg.trim();
              if (!t) return;
              addComment(order.id, t);
              setMsg('');
              toast('Message sent');
              closeModal();
            };
            return (
              <form onSubmit={send} className="space-y-3">
                <textarea
                  autoFocus
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={4}
                  placeholder="Write a message about this order…"
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground">Posts to this order&apos;s conversation — {order.owner !== 'Unassigned' ? order.owner : 'the team'} will be notified.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeModal} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</button>
                  <button type="submit" disabled={!msg.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-paper-plane-tilt" aria-hidden /> Send</button>
                </div>
              </form>
            );
          }}
        </Modal>
      )}

      {/* Review — act on deliverables on demand */}
      {modal === 'review' && (
        <Modal onClose={() => setModal(null)} title="Review deliverables" subtitle={`Order #${order.id}`} icon="ph-clipboard-text">
          {({ close: closeModal }) => (
            <div className="space-y-4">
              {deliverables.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">No deliverables to review yet — we&apos;ll notify you when the first one lands.</p>
              ) : (
                <div className="space-y-1.5">
                  {deliverables.map((d, i) => {
                    const dp = DELIV_PILL[d.status];
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]">
                        <i className="ph-bold ph-file-text shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 truncate">{d.name}</span>
                        <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: dp.bg, color: dp.fg }}>{dp.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {status === 'completed' ? (
                /* delivered — rate the service + the specialist, leave a note */
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  {reviewed ? (
                    <div className="space-y-2.5 text-center">
                      <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600"><i className="ph-bold ph-check-circle" aria-hidden /> Thanks for your review!</p>
                      <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">Service <StarsStatic value={rating} size="text-base" /></div>
                      {order.owner !== 'Unassigned' && (attitude > 0 || skill > 0) && (
                        <div className="flex items-center justify-center gap-5 text-[12px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">Attitude <StarsStatic value={attitude} size="text-sm" /></span>
                          <span className="flex items-center gap-1.5">Skill <StarsStatic value={skill} size="text-sm" /></span>
                        </div>
                      )}
                      {reviewNote.trim() && <p className="text-[13px] italic text-muted-foreground">“{reviewNote.trim()}”</p>}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold">Rate this service</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">How was the quality of {SERVICES[order.service].label}?</p>
                      <div className="mt-2"><Stars value={rating} onChange={setRating} /></div>

                      {order.owner !== 'Unassigned' && (
                        <div className="mt-4 border-t border-border/70 pt-3">
                          <p className="text-xs font-semibold">Rate {order.owner}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Your specialist on this order — attitude &amp; skill.</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                              <span className="text-[12px] font-medium text-muted-foreground">Attitude</span>
                              <Stars value={attitude} onChange={setAttitude} size="text-lg" />
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                              <span className="text-[12px] font-medium text-muted-foreground">Skill</span>
                              <Stars value={skill} onChange={setSkill} size="text-lg" />
                            </div>
                          </div>
                        </div>
                      )}

                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={3}
                        placeholder="Leave a note about the service or your specialist (optional)…"
                        className="mt-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="mt-3 flex justify-end">
                        <button type="button" disabled={rating === 0} onClick={() => { setReviewed(true); toast('Thanks for your review!'); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-star" aria-hidden /> Submit review</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // real orders approve/send-back from the panel's "ready for your review" block; these
                // mock quick-actions are only for demo/seed orders
                !isReal && deliverables.length > 0 && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setStatus(order.id, 'progress'); toast('Changes requested', 'info'); closeModal(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3.5 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/10"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Request changes</button>
                    <button onClick={() => { setStatus(order.id, 'completed'); toast('Order approved'); closeModal(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"><i className="ph-bold ph-check" aria-hidden /> Approve</button>
                  </div>
                )
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
