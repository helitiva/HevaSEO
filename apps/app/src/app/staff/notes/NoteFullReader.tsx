'use client';

import { NoteSaveError } from '@/components/NoteSaveError';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePortalBase } from '@/lib/portalBase';
import { useNotes } from '@/data/notesStore';
import { Attachment } from './NoteAttachment';
import { NOTE_COLORS } from '@/data/staffNotes';

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// Full-page note reader — a docs-style document view, the large-format alternative to the modal.
export function NoteFullReader({ id }: { id: string }) {
  const router = useRouter();
  const base = usePortalBase();
  const { notes, ready, mutate , error: saveError, clearError } = useNotes();
  const note = notes.find((n) => n.id === id) ?? null;

  if (ready && !note) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="display text-lg font-bold">Note not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href={`${base}/notes`} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">
          <i className="ph-bold ph-arrow-left" aria-hidden /> Back to notes
        </Link>
      </div>
    );
  }
  if (!note) return <div className="mx-auto max-w-3xl py-16 text-center text-sm text-muted-foreground">Loading…</div>;

  const c = NOTE_COLORS[note.color];
  const togglePin = () => mutate((xs) => xs.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
  const del = () => { mutate((xs) => xs.filter((n) => n.id !== note.id)); router.push(`${base}/notes`); };

  return (
    <article className="mx-auto max-w-3xl">
      <NoteSaveError error={saveError} onDismiss={clearError} />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`${base}/notes`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <i className="ph-bold ph-arrow-left" aria-hidden /> Back to notes
        </Link>
        <div className="flex items-center gap-1.5">
          <button onClick={togglePin} title={note.pinned ? 'Unpin' : 'Pin'} className={`grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:bg-accent ${note.pinned ? 'text-amber-500' : 'text-muted-foreground'}`}>
            <i className={`ph-bold ${note.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'}`} aria-hidden />
          </button>
          <Link href={`${base}/notes/${note.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <i className="ph-bold ph-pencil-simple" aria-hidden /> Edit
          </Link>
        </div>
      </div>

      <header className="mb-6" style={{ borderTopColor: c.dot, borderTopWidth: 0 }}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.dot }} aria-hidden /> {note.category}
          </span>
          {note.pinned && <span className="inline-flex items-center gap-1 text-amber-500"><i className="ph-fill ph-push-pin" aria-hidden /> Pinned</span>}
          <span className="inline-flex items-center gap-1"><i className="ph-bold ph-calendar-blank" aria-hidden /> Updated {fmtFull(note.updatedAt)}</span>
        </div>
        <h1 className="display text-3xl font-bold tracking-tight">{note.title || 'Untitled note'}</h1>
      </header>

      {note.body ? (
        <div className="note-html text-[15px] leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: note.body }} />
      ) : (
        <p className="text-sm italic text-muted-foreground">No content.</p>
      )}

      {note.attachments.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Attachments</h2>
          {note.attachments.map((a) => <Attachment key={a.id} att={a} />)}
        </div>
      )}

      {note.labels.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {note.labels.map((l) => (
            <span key={l} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">#{l}</span>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <button onClick={del} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-rose-300 hover:text-rose-500">
          <i className="ph-bold ph-trash" aria-hidden /> Delete
        </button>
        <Link href={`${base}/notes/${note.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          <i className="ph-bold ph-pencil-simple" aria-hidden /> Edit note
        </Link>
      </div>
    </article>
  );
}
