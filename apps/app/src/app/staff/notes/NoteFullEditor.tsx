'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePortalBase } from '@/lib/portalBase';
import { useNotes } from '@/data/notesStore';
import { NoteFormBody, draftFrom, emptyDraft, canSaveDraft, cleanDraft, type Draft } from './NoteComposer';
import { newNoteId, nowIso } from '@/data/staffNotes';

// Full-page note editor — the docs-style alternative to the modal composer. Shares NoteFormBody
// and the same store, so a note saved here shows up everywhere (list, modal, full reader).
export function NoteFullEditor({ id }: { id?: string }) {
  const router = useRouter();
  const base = usePortalBase();
  const { notes, ready, mutate } = useNotes();
  const existing = id ? notes.find((n) => n.id === id) ?? null : null;

  // Seed instantly from whatever the store has on first render (seed notes are present on SSR, so
  // no loading flash), then re-seed once from the authoritative store after hydration.
  const [draft, setDraft] = useState<Draft>(() => (id && existing ? draftFrom(existing) : emptyDraft()));
  const [seeded, setSeeded] = useState(!id);
  useEffect(() => {
    if (seeded || !ready) return;
    if (existing) setDraft(draftFrom(existing));
    setSeeded(true);
  }, [ready, existing, id, seeded]);

  const notFound = !!id && ready && !existing;
  const loading = !!id && !ready && !existing; // a session-only note before the store hydrates
  const canSave = canSaveDraft(draft);

  function save() {
    if (!canSave) return;
    const clean = cleanDraft(draft);
    if (id && existing) {
      mutate((xs) => xs.map((n) => (n.id === id ? { ...n, ...clean, updatedAt: nowIso() } : n)));
      router.push(`${base}/notes/${id}`);
    } else {
      const newId = newNoteId();
      const ts = nowIso();
      mutate((xs) => [{ id: newId, ...clean, pinned: false, createdAt: ts, updatedAt: ts }, ...xs]);
      router.push(`${base}/notes/${newId}`);
    }
  }

  const backHref = id ? `${base}/notes/${id}` : `${base}/notes`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <i className="ph-bold ph-arrow-left" aria-hidden /> {id ? 'Back to note' : 'Back to notes'}
        </Link>
        <h1 className="display flex items-center gap-2 text-lg font-bold">
          <i className={`ph-bold ${id ? 'ph-pencil-simple' : 'ph-note-pencil'} text-primary`} aria-hidden />
          {id ? 'Edit note' : 'New note'}
        </h1>
      </div>

      {notFound ? (
        <div className="py-16 text-center">
          <p className="display text-lg font-bold">Note not found</p>
          <Link href={`${base}/notes`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">
            <i className="ph-bold ph-arrow-left" aria-hidden /> Back to notes
          </Link>
        </div>
      ) : loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="kcard">
            <NoteFormBody draft={draft} setDraft={setDraft} />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Link href={backHref} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent">Cancel</Link>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              <i className="ph-bold ph-check" aria-hidden /> {id ? 'Save changes' : 'Create note'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
