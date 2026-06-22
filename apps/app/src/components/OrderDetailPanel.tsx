'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ORDERS, SERVICES, STATUSES, PRIORITIES,
  projectForDomain, projectIdForDomain, folderPathForDomain,
  deliverablesFor, activityFor, scopeFor,
  type Order, type OrderStatus,
} from '@/data/mock';
import { useOrdersStore, useComments } from './OrdersStore';
import { useToast } from './Toast';

const DELIV_PILL: Record<'approved' | 'review' | 'rejected', { label: string; bg: string; fg: string }> = {
  approved: { label: 'Approved', bg: 'rgba(16,185,129,.15)', fg: '#059669' },
  review: { label: 'In review', bg: 'rgba(245,158,11,.18)', fg: '#b45309' },
  rejected: { label: 'Changes requested', bg: 'rgba(244,63,94,.15)', fg: '#e11d48' },
};

/** A property cell — label and value on one line — for the 3-column grid. */
function Cell({ icon, label, full, children }: { icon: string; label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${full ? 'col-span-3' : ''}`}>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground"><i className={`ph-bold ${icon}`} /> {label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{children}</span>
    </div>
  );
}

export function OrderDetailPanel() {
  const id = useSearchParams().get('order');
  const order = id ? ORDERS.find((o) => o.id === id) : undefined;
  if (!order) return null;
  return <Panel key={order.id} order={order} />;
}

function Panel({ order }: { order: Order }) {
  const router = useRouter();
  const pathname = usePathname();
  const { statusOverrides, setStatus, addComment } = useOrdersStore();
  const comments = useComments(order.id);
  const toast = useToast();

  const status = statusOverrides[order.id] ?? order.status;
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing((c) => {
      if (!c) setTimeout(() => router.push(pathname, { scroll: false }), 230);
      return true;
    });
  }, [pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const st = STATUSES[status];
  const pid = projectIdForDomain(order.domain);
  const proj = projectForDomain(order.domain);
  const path = folderPathForDomain(order.domain);
  const p = order.progress ?? (status === 'completed' ? 100 : status === 'review' ? 95 : 8);
  const deliverables = deliverablesFor(order.id);
  const activity = activityFor(order);
  const scope = scopeFor(order);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className={`${closing ? 'order-backdrop-out' : 'order-backdrop'} absolute inset-0 bg-foreground/40 backdrop-blur-sm`} onClick={close} />
      <aside className={`${closing ? 'order-panel-out' : 'order-panel'} scrollbar-thin absolute right-0 top-0 flex h-full w-full max-w-[550px] flex-col overflow-y-auto border-l border-border bg-card`}>
        <div className="flex flex-col gap-3 p-5 sm:p-[30px]">
          {/* header */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70"><i className={`ph-bold ${SERVICES[order.service].icon}`} /> {SERVICES[order.service].label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">#{order.id}</span>
            <span className={`prio prio-${order.priority} ml-auto`}>{PRIORITIES[order.priority]}</span>
          </div>
          {/* title + status on one line */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="display min-w-0 truncate text-xl font-semibold tracking-tight">{order.title}</h2>
            <label className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: `${st.color}1f`, color: st.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
              <select value={status} onChange={(e) => { const v = e.target.value as OrderStatus; setStatus(order.id, v); toast(`Moved to ${STATUSES[v].label}`); }} className="cursor-pointer bg-transparent font-semibold outline-none" style={{ color: st.color }}>
                {(Object.keys(STATUSES) as OrderStatus[]).map((s) => <option key={s} value={s} className="text-foreground">{STATUSES[s].label}</option>)}
              </select>
            </label>
          </div>

          {/* properties — 2-column grid, collapsible field set */}
          <div className="border-y border-border py-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <Cell icon="ph-tag" label="Service">
                <span className="inline-flex items-center gap-1.5"><i className={`ph-bold ${SERVICES[order.service].icon} text-muted-foreground`} /><span className="font-medium">{SERVICES[order.service].label}</span><span className="text-muted-foreground">· {order.sub}</span></span>
              </Cell>
              <Cell icon="ph-stack" label="Project">
                {pid ? <Link href={`/projects/${pid}`} className="font-semibold text-primary hover:underline">{proj?.name} <i className="ph-bold ph-arrow-up-right text-[11px]" /></Link> : <span>{proj?.name ?? '—'}</span>}
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
              <i className={`ph-bold ph-caret-down transition-transform duration-300 ${showAll ? 'rotate-180' : ''}`} /> {showAll ? 'Show less' : 'Show all fields'}
            </button>
          </div>

          {/* scope */}
          {scope.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope</p>
              <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed">{scope.map((s, i) => <li key={i}>{s}</li>)}</ul>
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
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]">
                      <i className="ph-bold ph-file-text shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{d.name}</span>
                      <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: dp.bg, color: dp.fg }}>{dp.label}</span>
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
                  <i className={`ph-fill ph-circle text-[7px] ${i === 0 ? 'text-primary' : 'text-muted-foreground/50'}`} />
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
              onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { addComment(order.id, draft.trim()); setDraft(''); toast('Comment added'); } }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
              <button type="submit" className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50" disabled={!draft.trim()}><i className="ph-bold ph-paper-plane-tilt" /></button>
            </form>
          </section>
        </div>

        {/* footer actions */}
        <div className="sticky bottom-0 mt-auto flex gap-1.5 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:gap-2 sm:px-[30px] sm:py-3.5">
          <button className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border py-2 text-xs font-semibold transition hover:bg-accent sm:text-[13px]"><i className="ph-bold ph-chat-circle-dots" /> Message</button>
          {status === 'review' ? (
            <>
              <button onClick={() => { setStatus(order.id, 'progress'); toast('Changes requested', 'info'); }} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/40 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/10 sm:text-[13px]"><i className="ph-bold ph-arrow-counter-clockwise" /> <span className="sm:hidden">Changes</span><span className="hidden sm:inline">Request changes</span></button>
              <button onClick={() => { setStatus(order.id, 'completed'); toast('Order approved'); }} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 sm:text-[13px]"><i className="ph-bold ph-check" /> Approve</button>
            </>
          ) : (
            <>
              <button className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-border py-2 text-xs font-semibold transition hover:bg-accent sm:text-[13px]"><i className="ph-bold ph-clipboard-text" /> Review</button>
              <button className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:text-[13px]"><i className="ph-bold ph-plus" /> Order again</button>
            </>
          )}
          <button onClick={close} aria-label="Close" className="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground transition hover:bg-accent sm:hidden"><i className="ph-bold ph-x" /></button>
        </div>
      </aside>
    </div>
  );
}
