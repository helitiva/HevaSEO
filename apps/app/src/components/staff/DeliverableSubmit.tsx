'use client';
import { useState, useRef, useEffect } from 'react';
import { bumpVersion } from '@/lib/staff';
import { SnippetPicker } from '@/components/staff/SnippetPicker';
import { REVIEWER_NOTE_SNIPPETS, CUSTOMER_MSG_SNIPPETS } from '@/data/staffMock';
import type { StaffDeliverable } from '@/data/staffMock';

const ACCEPT = 'PDF · DOCX · XLSX · CSV · PNG · JPG · ZIP · max 25MB';

// Grow a textarea to fit its content as the user types (min height held by CSS).
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// Versioned deliverable submission (D6). Each submit is a new version; older ones stay read-only
// with their changes-requested note pinned. A required note gates the submit button.
export function DeliverableSubmit({ history, onSubmit, qaDone = 0, qaTotal = 0, lockReason = null, status }: {
  history: StaffDeliverable[];
  onSubmit: (note: string, customerNote?: string) => void;
  qaDone?: number;
  qaTotal?: number;
  lockReason?: string | null;
  status?: string;
}) {
  const [file, setFile] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [reviewerSnips, setReviewerSnips] = useState(REVIEWER_NOTE_SNIPPETS);
  const [customerSnips, setCustomerSnips] = useState(CUSTOMER_MSG_SNIPPETS);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const custRef = useRef<HTMLTextAreaElement>(null);
  // Keep the auto-grow height in sync with both typing and snippet inserts.
  useEffect(() => { if (noteRef.current) autoGrow(noteRef.current); }, [note]);
  useEffect(() => { if (custRef.current) autoGrow(custRef.current); }, [customerNote]);
  const insert = (cur: string, s: string) => (cur.trim() ? `${cur.trim()}\n${s}` : s);
  const nextV = bumpVersion(history);
  const canSubmit = note.trim().length > 0 && (Boolean(file) || link.trim().length > 0);
  const qaComplete = qaTotal === 0 || qaDone >= qaTotal;

  return (
    <div className="kcard">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-file-arrow-up text-primary" aria-hidden /> Deliverable</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {lockReason ? (status ?? '').replace('_', ' ') : history.length ? `resubmission · v${nextV}` : 'first submission · v1'}
        </span>
      </div>

      {history.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {history.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
              <span className="font-semibold">v{d.version}</span>
              <i className={`ph-bold ${d.kind === 'link' ? 'ph-link' : 'ph-file-text'} text-muted-foreground`} aria-hidden />
              <span className="truncate text-muted-foreground">{d.fileName ?? d.url}</span>
              <span className={`pill ${d.status === 'approved' ? 'pill-live' : d.status === 'changes_requested' ? 'pill-warn' : 'pill-good'} ml-auto shrink-0`}>{d.status.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      )}

      {lockReason ? (
        <div className={`flex flex-col items-center gap-1.5 rounded-xl border px-4 py-5 text-center text-sm ${status === 'approved' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-muted/40 text-muted-foreground'}`}>
          <i className={`ph-bold text-2xl ${status === 'approved' ? 'ph-seal-check' : status === 'internal_review' ? 'ph-hourglass-medium' : 'ph-lock-simple'}`} aria-hidden />
          {lockReason}
        </div>
      ) : (<>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-center transition hover:border-primary/50">
        <i className="ph-bold ph-upload text-2xl text-muted-foreground" aria-hidden />
        <span className="text-sm">{file ? <span className="font-medium">{file}</span> : <>Drag report here or <span className="text-primary">browse</span></>}</span>
        <span className="text-[11px] text-muted-foreground">{ACCEPT}</span>
        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
      </label>
      {file && (
        <button onClick={() => setFile(null)} className="mt-1.5 text-xs text-muted-foreground hover:text-destructive">
          <i className="ph-bold ph-x" aria-hidden /> Remove {file}
        </button>
      )}

      <div className="my-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div>

      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste an external link (Google Doc / Drive)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />

      <div className="mb-1 mt-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><i className="ph-bold ph-lock-simple" aria-hidden /> Note for the reviewer <span className="truncate font-normal opacity-70">· internal, required</span></p>
        <SnippetPicker snippets={reviewerSnips} current={note} onPick={(s) => setNote((p) => insert(p, s))} onAdd={(s) => setReviewerSnips((l) => [s, ...l])} onRemove={(s) => setReviewerSnips((l) => l.filter((x) => x !== s))} />
      </div>
      <textarea id="deliverable-note" ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, what to check, anything risky…"
        className="min-h-[9.5rem] w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />

      <div className="mb-1 mt-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-primary"><i className="ph-bold ph-chats-circle" aria-hidden /> Message to the customer <span className="truncate font-normal text-muted-foreground">· the client will see this (optional)</span></p>
        <SnippetPicker snippets={customerSnips} current={customerNote} onPick={(s) => setCustomerNote((p) => insert(p, s))} onAdd={(s) => setCustomerSnips((l) => [s, ...l])} onRemove={(s) => setCustomerSnips((l) => l.filter((x) => x !== s))} />
      </div>
      <textarea ref={custRef} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="e.g. Here's your report — I focused on the money pages first. Let me know any tweaks."
        className="min-h-[9.5rem] w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />

      {qaTotal > 0 && !qaComplete && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <i className="ph-bold ph-warning-circle" aria-hidden /> {qaDone}/{qaTotal} acceptance checks ticked — worth finishing your self-check first.
        </p>
      )}

      <button disabled={!canSubmit} onClick={() => onSubmit(note.trim(), customerNote.trim() || undefined)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
        <i className="ph-bold ph-paper-plane-tilt" aria-hidden /> Submit v{nextV} for review
      </button>
      {!canSubmit && <p className="mt-1 text-center text-[11px] text-muted-foreground">Attach a file or link, and add a note.</p>}
      </>)}
    </div>
  );
}
