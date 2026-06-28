'use client';
import { useRef, useState } from 'react';
import type { SelfNote, SelfNoteAttachment } from '@/data/staffMock';

// Personal work log on a task. Staff jots progress ("done X, waiting on Y, resume at Z")
// with an auto-filled-but-editable timestamp and optional image/video/link/file attachments.
// Private to staff + manager + admin; never shown to the customer.

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function prettyWhen(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SelfNoteLog({ seed, author }: { seed: SelfNote[]; author: string }) {
  const [notes, setNotes] = useState<SelfNote[]>(seed);
  const [body, setBody] = useState('');
  const [when, setWhen] = useState(nowLocal());
  const [pending, setPending] = useState<SelfNoteAttachment[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((f): SelfNoteAttachment => ({
      kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file',
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    setPending((p) => [...p, ...next]);
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imgs = Array.from(e.clipboardData.items)
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => Boolean(f))
      .map((f): SelfNoteAttachment => ({ kind: 'image', url: URL.createObjectURL(f), name: f.name || 'pasted-image.png' }));
    if (imgs.length) { e.preventDefault(); setPending((p) => [...p, ...imgs]); }
  }

  function addLink() {
    const url = linkDraft.trim();
    if (!url) return;
    setPending((p) => [...p, { kind: 'link', url, name: url.replace(/^https?:\/\//, '') }]);
    setLinkDraft('');
    setLinkOpen(false);
  }

  function removePending(i: number) {
    setPending((p) => p.filter((_, j) => j !== i));
  }

  function addNote() {
    if (!body.trim() && pending.length === 0) return;
    const note: SelfNote = { id: `sn-${Date.now()}`, author, at: prettyWhen(when), body: body.trim(), attachments: pending };
    setNotes((n) => [note, ...n]); // newest first
    setBody('');
    setPending([]);
    setWhen(nowLocal());
  }

  return (
    <div className="kcard">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <i className="ph-bold ph-notebook text-primary" aria-hidden /> Work log
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
      </p>
      <p className="mb-3 mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <i className="ph-bold ph-lock-simple" aria-hidden /> Private to you, your manager &amp; admin · not shown to the customer
      </p>

      {/* Composer */}
      <div className="rounded-xl border border-border bg-muted/30 p-2.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={onPaste}
          rows={2}
          placeholder="What did you do / where are you / what are you waiting on? (paste a screenshot too)"
          className="w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
        />

        {pending.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <span key={i} className="group relative inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 text-[11px]">
                {a.kind === 'image' ? <img src={a.url} alt={a.name} className="h-9 w-9 rounded object-cover" />
                  : a.kind === 'video' ? <i className="ph-bold ph-video-camera text-base text-primary" aria-hidden />
                  : a.kind === 'link' ? <i className="ph-bold ph-link text-base text-primary" aria-hidden />
                  : <i className="ph-bold ph-file text-base text-muted-foreground" aria-hidden />}
                <span className="max-w-[9rem] truncate">{a.name}</span>
                <button onClick={() => removePending(i)} aria-label="Remove attachment" className="ml-0.5 text-muted-foreground hover:text-destructive"><i className="ph-bold ph-x" aria-hidden /></button>
              </span>
            ))}
          </div>
        )}

        {linkOpen && (
          <div className="mt-2 flex gap-2">
            <input
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
              placeholder="https://…"
              aria-label="Attachment link"
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button onClick={addLink} className="rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent">Add</button>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <i className="ph-bold ph-clock" aria-hidden />
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Note time"
              className="rounded-md border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary"
            />
          </label>
          <span className="flex items-center gap-1">
            <button onClick={() => fileRef.current?.click()} aria-label="Attach image or video" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent"><i className="ph-bold ph-image" aria-hidden /></button>
            <button onClick={() => setLinkOpen((v) => !v)} aria-label="Attach link" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent"><i className="ph-bold ph-link-simple" aria-hidden /></button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </span>
          <button
            onClick={addNote}
            disabled={!body.trim() && pending.length === 0}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ph-bold ph-plus" aria-hidden /> Add note
          </button>
        </div>
      </div>

      {/* Log entries (newest first) */}
      <div className="mt-3 space-y-2.5">
        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">No notes yet — log your progress so you can pick up where you left off.</p>
        ) : (
          notes.map((n) => <NoteEntry key={n.id} note={n} />)
        )}
      </div>
    </div>
  );
}

function NoteEntry({ note }: { note: SelfNote }) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <i className="ph-bold ph-user-circle" aria-hidden /><span className="font-semibold text-foreground">{note.author}</span> · {note.at}
      </p>
      {note.body && <p className="whitespace-pre-wrap text-sm">{note.body}</p>}
      {note.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {note.attachments.map((a, i) => <Attachment key={i} a={a} />)}
        </div>
      )}
    </div>
  );
}

function Attachment({ a }: { a: SelfNoteAttachment }) {
  if (a.kind === 'image') {
    return <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.name} className="h-20 w-20 rounded-lg border border-border object-cover transition hover:opacity-90" /></a>;
  }
  if (a.kind === 'video') {
    return <video src={a.url} controls className="h-28 rounded-lg border border-border" />;
  }
  if (a.kind === 'link') {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:underline">
        <i className="ph-bold ph-link" aria-hidden /><span className="max-w-[14rem] truncate">{a.name ?? a.url}</span><i className="ph-bold ph-arrow-square-out" aria-hidden />
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px]">
      <i className="ph-bold ph-file-text text-muted-foreground" aria-hidden /><span className="max-w-[12rem] truncate">{a.name ?? 'file'}</span>
    </span>
  );
}
