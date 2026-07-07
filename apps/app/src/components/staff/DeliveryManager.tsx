'use client';
import { useState } from 'react';
import { uploadDeliverableFile } from '@/lib/uploadMedia';
import { deliverableAssets } from '@/data/adminMock';
import type { StaffDeliverable } from '@/data/staffMock';
import type { DeliverableFile } from '@/components/staff/DeliverableSubmit';

type ActionResult = { ok: true } | { ok: false; error: string };

const ACCEPT = 'PDF · DOCX · XLSX · CSV · PNG · JPG · ZIP · max 30MB';

// Post-delivery control panel on the staff task. Shows the current delivered work, whether the customer
// has opened it yet, and lets the staffer correct it: IN PLACE while unseen, or as a new revision once the
// customer has viewed it (the edit path is blocked server-side after viewing).
export function DeliveryManager({ latest, nextVersion, viewOnly, onEdit, onRevise }: {
  latest: StaffDeliverable;
  nextVersion: number;
  viewOnly?: boolean;
  onEdit: (note: string, files: DeliverableFile[]) => Promise<ActionResult>;
  onRevise: (note: string, files: DeliverableFile[]) => Promise<ActionResult>;
}) {
  const viewed = Boolean(latest.viewedAt);
  const assets = deliverableAssets(latest);
  const currentFile = assets.find((a) => a.kind === 'file') ?? null;
  const currentLink = assets.find((a) => a.kind === 'link') ?? null;

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(latest.note ?? '');
  const [link, setLink] = useState(currentLink?.url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [keepFile, setKeepFile] = useState(Boolean(currentFile));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (busy || viewOnly) return;
    setBusy(true); setErr('');
    const files: DeliverableFile[] = [];
    if (file) {
      const up = await uploadDeliverableFile(file);
      if (!up) { setBusy(false); setErr('Upload failed — file may be over 30MB.'); return; }
      files.push(up);
    } else if (keepFile && currentFile) {
      files.push({ kind: 'file', fileName: currentFile.fileName, url: currentFile.url });
    }
    if (link.trim()) files.push({ kind: 'link', fileName: null, url: link.trim() });
    if (files.length === 0) { setBusy(false); setErr('Attach a file or link.'); return; }
    const res = viewed ? await onRevise(note.trim(), files) : await onEdit(note.trim(), files);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setOpen(false); setFile(null);
  }

  return (
    <div className="kcard">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-paper-plane-tilt text-emerald-600 dark:text-emerald-400" aria-hidden /> Delivered work</p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">v{latest.version} delivered</span>
      </div>

      {/* Seen-by-customer indicator */}
      <div className={`mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${viewed ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
        <i className={`ph-bold ${viewed ? 'ph-eye' : 'ph-eye-slash'}`} aria-hidden />
        {viewed ? `Viewed by the customer${latest.viewedAt ? ` · ${latest.viewedAt}` : ''}` : 'Not viewed by the customer yet'}
      </div>

      {/* current assets */}
      <div className="mb-3 space-y-1.5">
        {assets.length === 0 && <p className="text-xs text-muted-foreground">No attachment on this version.</p>}
        {assets.map((a, i) => a.kind === 'link'
          ? <a key={i} href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-background px-2 py-1.5 text-[12px] transition hover:border-emerald-500/60"><i className="ph-bold ph-link-simple shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /><span className="min-w-0 truncate">{a.url}</span><i className="ph-bold ph-arrow-up-right ml-auto shrink-0 text-emerald-600/70" aria-hidden /></a>
          : <a key={i} href={a.url ?? '#'} target="_blank" rel="noopener noreferrer" download={a.fileName ?? undefined} className="flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-background px-2 py-1.5 text-[12px] transition hover:border-emerald-500/60"><i className="ph-bold ph-file-arrow-down shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /><span className="min-w-0 truncate">{a.fileName ?? 'Download file'}</span></a>)}
        {latest.note && <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[12px] text-muted-foreground"><i className="ph-bold ph-chat-text mr-1" aria-hidden />{latest.note}</p>}
      </div>

      {viewOnly ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground"><i className="ph-bold ph-lock-simple" aria-hidden /> View only — editing disabled in manager view.</p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-accent">
          <i className={`ph-bold ${viewed ? 'ph-git-branch' : 'ph-pencil-simple'}`} aria-hidden />
          {viewed ? `Submit a revision (v${nextVersion})` : 'Edit delivery in place'}
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <p className={`flex items-center gap-1.5 text-[11px] font-medium ${viewed ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`}>
            <i className={`ph-bold ${viewed ? 'ph-info' : 'ph-lightbulb'}`} aria-hidden />
            {viewed
              ? `The customer has seen v${latest.version}, so this creates revision v${nextVersion} and goes back through review.`
              : 'The customer hasn’t opened this yet — your changes replace the current delivery in place.'}
          </p>

          {/* file: keep / replace */}
          {currentFile && !file && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} className="accent-primary" />
              Keep <span className="truncate font-medium">{currentFile.fileName}</span>
            </label>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-center text-[12px] transition hover:border-primary/50">
            <i className="ph-bold ph-upload text-muted-foreground" aria-hidden />
            {file ? <span className="font-medium">{file.name}</span> : <>{currentFile ? 'Replace file' : 'Attach a file'} <span className="text-[10px] text-muted-foreground">· {ACCEPT}</span></>}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {file && <button onClick={() => setFile(null)} className="text-[11px] text-muted-foreground hover:text-destructive"><i className="ph-bold ph-x" aria-hidden /> Remove {file.name}</button>}

          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="External link (Google Doc / Drive)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the reviewer…" className="min-h-[5rem] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />

          {err && <p role="alert" className="text-[11px] font-medium text-destructive">{err}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setOpen(false); setErr(''); }} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
            <button onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition enabled:hover:opacity-90 disabled:opacity-40">
              <i className={`ph-bold ${busy ? 'ph-circle-notch animate-spin' : viewed ? 'ph-git-branch' : 'ph-check'}`} aria-hidden />
              {busy ? 'Saving…' : viewed ? `Submit revision v${nextVersion}` : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
