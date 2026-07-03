/* eslint-disable @next/next/no-img-element -- user Storage URLs, dynamic host */
'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { MessageAttachments } from '../MessageAttachments';
import { uploadMedia } from '@/lib/uploadMedia';
import type { MessageAttachment } from '@/data/mock';
import type { TicketDetail, TicketStatus, TicketPriority } from '@/app/(portal)/tickets.actions';

const TYPE_LABEL: Record<string, string> = { technical: 'Technical', billing: 'Billing', consultation: 'Consultation' };
const PRIORITY: Record<TicketPriority, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'bg-muted text-muted-foreground' },
  med: { label: 'Normal', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  high: { label: 'Urgent', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
};
const STATUS: Record<TicketStatus, { label: string; dot: string; cls: string }> = {
  open: { label: 'Open', dot: '#2563eb', cls: 'text-primary' },
  pending: { label: 'Awaiting reply', dot: '#f59e0b', cls: 'text-amber-600' },
  resolved: { label: 'Resolved', dot: '#10b981', cls: 'text-emerald-600' },
  closed: { label: 'Closed', dot: '#64748b', cls: 'text-muted-foreground' },
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
  const canReply = detail.status !== 'closed';
  const showCsat = (detail.status === 'resolved' || detail.status === 'closed');

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Ticket ${detail.code}`}>
      <button aria-hidden tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="modal-in relative z-10 flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><i className="ph-bold ph-ticket text-lg" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{detail.subject}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-mono text-muted-foreground">#{detail.code}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">{TYPE_LABEL[detail.type] ?? detail.type}</span>
              <span className={`rounded px-1.5 py-0.5 font-semibold ${PRIORITY[detail.priority].cls}`}>{PRIORITY[detail.priority].label}</span>
              <span className={`inline-flex items-center gap-1 font-semibold ${st.cls}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-x" aria-hidden /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
          {/* conversation */}
          <section className="flex min-h-0 flex-1 flex-col">
            <div ref={threadRef} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {detail.thread.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No messages yet.</p>}
              {detail.thread.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.mine ? 'flex-row-reverse' : ''}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-bold ${m.mine ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-600'}`}>{m.mine ? 'You' : initials(m.author)}</span>
                  <div className={`min-w-0 max-w-[82%] ${m.mine ? 'text-right' : ''}`}>
                    <p className="px-1 text-[10px] font-medium text-muted-foreground">{m.author} · {rel(m.createdAt)}</p>
                    <div className={`mt-0.5 inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed ${m.mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted text-foreground'}`}>
                      {m.body && <span>{m.body}</span>}
                      <MessageAttachments items={m.attachments} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* composer */}
            {canReply ? (
              <div onPaste={onPaste} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="border-t border-border p-3 sm:p-4">
                {(atts.length > 0 || uploading > 0) && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {atts.map((a, i) => (
                      <span key={i} className="relative block overflow-hidden rounded-lg border border-border">
                        {a.kind === 'video' ? <video src={a.url} className="h-14 w-20 object-cover" muted /> : <img src={a.url} alt={a.name} className="h-14 w-20 object-cover" />}
                        <button type="button" onClick={() => setAtts((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white"><i className="ph-bold ph-x text-[9px]" aria-hidden /></button>
                      </span>
                    ))}
                    {uploading > 0 && <span className="grid h-14 w-20 place-items-center rounded-lg border border-dashed border-border text-muted-foreground"><i className="ph-bold ph-circle-notch animate-spin" aria-hidden /></span>}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach media" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-paperclip" aria-hidden /></button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} rows={1} placeholder="Write a reply… (paste or drop images/video)" className="scrollbar-thin max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="button" onClick={send} disabled={(!reply.trim() && atts.length === 0) || uploading > 0 || sending} aria-label="Send reply" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className={`ph-bold ${sending ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'}`} aria-hidden /></button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">This ticket is closed.</p>
                <button onClick={() => setStatus('open')} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Reopen ticket</button>
              </div>
            )}
          </section>

          {/* details rail */}
          <aside className="shrink-0 space-y-4 border-t border-border p-4 sm:p-5 md:w-64 md:border-l md:border-t-0">
            <div className="space-y-2.5 text-[13px]">
              <Row label="Status"><span className={`inline-flex items-center gap-1 font-semibold ${st.cls}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />{st.label}</span></Row>
              <Row label="Priority"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PRIORITY[detail.priority].cls}`}>{PRIORITY[detail.priority].label}</span></Row>
              <Row label="Agent">{detail.agent ? <span className="inline-flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/15 text-[9px] font-bold text-amber-600">{initials(detail.agent)}</span>{detail.agent}</span> : <span className="text-muted-foreground">Awaiting assignment</span>}</Row>
              <Row label="Order">{detail.orderCode ? <button onClick={() => onOpenOrder(detail.orderCode!)} className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-primary hover:underline">#{detail.orderCode}<i className="ph-bold ph-arrow-square-out" aria-hidden /></button> : <span className="text-muted-foreground">—</span>}</Row>
              <Row label="Opened"><span className="text-muted-foreground">{rel(detail.createdAt)}</span></Row>
              <Row label="Last reply"><span className="text-muted-foreground">{rel(detail.lastReplyAt)}</span></Row>
            </div>
            <p className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-clock" aria-hidden /> Advisors reply within business hours (&lt; 2h).</p>

            {/* lifecycle actions */}
            <div className="flex flex-wrap gap-2">
              {detail.status === 'open' || detail.status === 'pending' ? (
                <>
                  <button onClick={() => setStatus('resolved')} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-50"><i className="ph-bold ph-check-circle" aria-hidden /> Mark resolved</button>
                  <button onClick={() => setStatus('closed')} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:opacity-50">Close ticket</button>
                </>
              ) : (
                <button onClick={() => setStatus('open')} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden /> Reopen</button>
              )}
            </div>

            {/* CSAT */}
            {showCsat && (
              <div className="rounded-xl border border-border p-3">
                {detail.csat ? (
                  <>
                    <p className="text-[11px] font-semibold text-muted-foreground">Your rating</p>
                    <div className="mt-1 flex gap-0.5 text-amber-500">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star ${n <= detail.csat!.rating ? '' : 'opacity-25'}`} aria-hidden />)}</div>
                    {detail.csat.note && <p className="mt-1 text-[12px] text-muted-foreground">“{detail.csat.note}”</p>}
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold">How was the support?</p>
                    <div className="mt-1 flex gap-0.5 text-amber-500">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} star`}><i className={`ph-fill ph-star text-lg transition ${n <= stars ? '' : 'opacity-25 hover:opacity-60'}`} aria-hidden /></button>)}</div>
                    <textarea value={csatNote} onChange={(e) => setCsatNote(e.target.value)} rows={2} placeholder="Anything to add? (optional)" className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right">{children}</span></div>;
}
