/* eslint-disable @next/next/no-img-element -- user Storage URLs, dynamic host */
'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react';
import { MessageAttachments } from '../MessageAttachments';
import { uploadMedia } from '@/lib/uploadMedia';
import type { MessageAttachment } from '@/data/mock';
import type { TicketDetail, TicketStatus, TicketPriority } from '@/app/(portal)/tickets.actions';

const TYPE_LABEL: Record<string, string> = { technical: 'Technical', billing: 'Billing', consultation: 'Consultation' };
const PRIORITY: Record<TicketPriority, { label: string; dot: string; cls: string }> = {
  low: { label: 'Low', dot: '#94a3b8', cls: 'text-muted-foreground' },
  med: { label: 'Normal', dot: '#0ea5e9', cls: 'text-sky-600 dark:text-sky-400' },
  high: { label: 'Urgent', dot: '#f43f5e', cls: 'text-rose-600 dark:text-rose-400' },
};
const STATUS: Record<TicketStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#2563eb' },
  pending: { label: 'Awaiting reply', color: '#f59e0b' },
  resolved: { label: 'Resolved', color: '#10b981' },
  closed: { label: 'Closed', color: '#64748b' },
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const rel = (iso: string | null): string => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function TicketDetailDialog({ detail, onClose, onReply, onSetStatus, onRate, onOpenOrder }: {
  detail: TicketDetail;
  onClose: () => void;
  onReply: (body: string, atts: MessageAttachment[]) => Promise<boolean>;
  onSetStatus: (s: TicketStatus) => Promise<boolean>;
  onRate: (rating: number, note: string) => Promise<boolean>;
  onOpenOrder: (code: string) => void;
}) {
  const [reply, setReply] = useState('');
  const [atts, setAtts] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(detail.csat?.rating ?? 0);
  const [csatNote, setCsatNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => { threadRef.current?.scrollTo(0, threadRef.current.scrollHeight); }, [detail.thread.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const st = STATUS[detail.status];
  const prio = PRIORITY[detail.priority];
  const canReply = detail.status !== 'closed';
  const showCsat = detail.status === 'resolved' || detail.status === 'closed';
  const awaitingFirstReply = !detail.thread.some((m) => !m.mine);

  const addFiles = (files: FileList | File[]) => Array.from(files).forEach(async (f) => {
    setUploading((n) => n + 1);
    const a = await uploadMedia(f);
    setUploading((n) => n - 1);
    if (a) setAtts((x) => [...x, a]);
  });
  const onPaste = (e: ClipboardEvent) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } };
  const onDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  const send = async () => {
    if ((!reply.trim() && atts.length === 0) || uploading > 0 || sending) return;
    setSending(true);
    const ok = await onReply(reply.trim(), atts);
    setSending(false);
    if (ok) { setReply(''); setAtts([]); }
  };
  const setStatus = async (s: TicketStatus) => { setBusy(true); await onSetStatus(s); setBusy(false); };
  const submitRating = async () => { if (!stars) return; setBusy(true); const ok = await onRate(stars, csatNote.trim()); setBusy(false); if (ok) setCsatNote(''); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={`Ticket ${detail.code}`}>
      <button aria-hidden tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm" />
      <div className="modal-in relative z-10 flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* header */}
        <header className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="font-mono font-semibold text-foreground/70">#{detail.code}</span>
              <span className="text-border">•</span>
              <span>{TYPE_LABEL[detail.type] ?? detail.type} request</span>
              <span className="text-border">•</span>
              <span>Opened {rel(detail.createdAt)}</span>
            </div>
            <h2 className="mt-0.5 truncate text-[17px] font-semibold tracking-tight">{detail.subject}</h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${st.color}18`, color: st.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}
          </span>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* conversation */}
          <section className="flex min-h-0 flex-1 flex-col bg-muted/20">
            <div ref={threadRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto max-w-2xl space-y-5">
                {detail.thread.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No messages yet.</p>}
                {detail.thread.map((m, i) => (
                  <article key={m.id} className="flex gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${m.mine ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-600'}`}>
                      {m.mine ? <i className="ph-bold ph-user" aria-hidden /> : initials(m.author)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[13px] font-semibold">{m.author}</span>
                        {!m.mine && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">Support</span>}
                        {i === 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Original request</span>}
                        <span className="text-[11px] text-muted-foreground">{rel(m.createdAt)}</span>
                      </div>
                      {(m.body || m.attachments.length > 0) && (
                        <div className={`mt-1 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${m.mine ? 'border-border bg-background' : 'border-amber-500/20 bg-amber-500/[0.05]'}`}>
                          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                          <MessageAttachments items={m.attachments} />
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* composer */}
            {canReply ? (
              <div className="border-t border-border bg-card p-3 sm:px-6 sm:py-4">
                <div onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  {(atts.length > 0 || uploading > 0) && (
                    <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/30 p-2">
                      {atts.map((a, i) => (
                        <span key={i} className="relative block overflow-hidden rounded-lg border border-border">
                          {a.kind === 'video' ? <video src={a.url} className="h-12 w-16 object-cover" muted /> : <img src={a.url} alt={a.name} className="h-12 w-16 object-cover" />}
                          <button type="button" onClick={() => setAtts((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white"><i className="ph-bold ph-x text-[9px]" aria-hidden /></button>
                        </span>
                      ))}
                      {uploading > 0 && <span className="grid h-12 w-16 place-items-center rounded-lg border border-dashed border-border text-muted-foreground"><i className="ph-bold ph-circle-notch animate-spin" aria-hidden /></span>}
                    </div>
                  )}
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} rows={2} placeholder="Write a reply…  (paste or drop images / video)" className="scrollbar-thin block max-h-40 w-full resize-none bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach media" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-paperclip" aria-hidden /></button>
                      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">⌘↵ to send</span>
                    </div>
                    <button type="button" onClick={send} disabled={(!reply.trim() && atts.length === 0) || uploading > 0 || sending} aria-label="Send reply" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                      <i className={`ph-bold ${sending ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'}`} aria-hidden /> Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-border bg-card p-4 text-center">
                <p className="text-xs text-muted-foreground">This ticket is closed.</p>
                <button onClick={() => setStatus('open')} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Reopen ticket</button>
              </div>
            )}
          </section>

          {/* details rail */}
          <aside className="scrollbar-thin shrink-0 space-y-5 overflow-y-auto border-t border-border p-4 sm:p-5 md:w-72 md:border-l md:border-t-0">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Details</p>
              <div className="space-y-2.5 text-[13px]">
                <Prop icon="ph-circle-half" label="Status"><span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: st.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span></Prop>
                <Prop icon="ph-flag" label="Priority"><span className={`inline-flex items-center gap-1.5 font-semibold ${prio.cls}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: prio.dot }} />{prio.label}</span></Prop>
                <Prop icon="ph-headset" label="Assignee">{detail.agent ? <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/15 text-[9px] font-bold text-amber-600">{initials(detail.agent)}</span>{detail.agent}</span> : <span className="text-muted-foreground">Awaiting assignment</span>}</Prop>
                <Prop icon="ph-calendar-blank" label="Opened"><span className="text-muted-foreground">{rel(detail.createdAt)}</span></Prop>
                <Prop icon="ph-chat-circle" label="Last reply"><span className="text-muted-foreground">{rel(detail.lastReplyAt)}</span></Prop>
              </div>
            </div>

            {detail.orderCode && (
              <button onClick={() => onOpenOrder(detail.orderCode!)} className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background p-2.5 text-left transition hover:border-primary/40 hover:bg-accent/40">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><i className="ph-bold ph-package" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Related order</span><span className="block truncate font-mono text-[13px] font-semibold">#{detail.orderCode}</span></span>
                <i className="ph-bold ph-arrow-square-out text-muted-foreground" aria-hidden />
              </button>
            )}

            <p className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] ${awaitingFirstReply ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted/50 text-muted-foreground'}`}>
              <i className="ph-bold ph-clock mt-px shrink-0" aria-hidden />
              {awaitingFirstReply ? 'Awaiting first reply — advisors respond within 2h (business hours).' : 'Advisors reply within business hours (< 2h).'}
            </p>

            {/* lifecycle */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</p>
              <div className="flex flex-col gap-2">
                {detail.status === 'open' || detail.status === 'pending' ? (
                  <>
                    <button onClick={() => setStatus('resolved')} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-50"><i className="ph-bold ph-check-circle" aria-hidden /> Mark resolved</button>
                    <button onClick={() => setStatus('closed')} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:opacity-50"><i className="ph-bold ph-x-circle" aria-hidden /> Close ticket</button>
                  </>
                ) : (
                  <button onClick={() => setStatus('open')} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Reopen</button>
                )}
              </div>
            </div>

            {/* CSAT */}
            {showCsat && (
              <div className="rounded-xl border border-border bg-background p-3">
                {detail.csat ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your rating</p>
                    <div className="mt-1 flex gap-0.5 text-amber-500">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star text-lg ${n <= detail.csat!.rating ? '' : 'opacity-20'}`} aria-hidden />)}</div>
                    {detail.csat.note && <p className="mt-1.5 text-[12px] italic text-muted-foreground">“{detail.csat.note}”</p>}
                  </>
                ) : (
                  <>
                    <p className="text-[12px] font-semibold">How was the support?</p>
                    <div className="mt-1.5 flex gap-1 text-amber-500">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} star`}><i className={`ph-fill ph-star text-xl transition ${n <= stars ? '' : 'opacity-20 hover:opacity-50'}`} aria-hidden /></button>)}</div>
                    <textarea value={csatNote} onChange={(e) => setCsatNote(e.target.value)} rows={2} placeholder="Anything to add? (optional)" className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
                    <button onClick={submitRating} disabled={!stars || busy} className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">Submit rating</button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Prop({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className={`ph-bold ${icon} text-[13px]`} aria-hidden />{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}
