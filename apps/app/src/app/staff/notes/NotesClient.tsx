'use client';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/staff/EmptyState';
import { NoteComposer } from './NoteComposer';
import { NoteCard } from './NoteCard';
import { NoteReader } from './NoteReader';
import { htmlToText } from '@/lib/sanitizeHtml';
import { useNotes } from '@/data/notesStore';
import { newNoteId, nowIso, type StaffNote } from '@/data/staffNotes';
import type { Draft } from './NoteComposer';
import { useStaffViewOnly } from '@/lib/staffView';

export function NotesClient() {
  const viewOnly = useStaffViewOnly();
  const { notes, mutate } = useNotes();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [label, setLabel] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; note: StaffNote | null }>({ open: false, note: null });
  const [readerId, setReaderId] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(notes.map((n) => n.category))].sort(), [notes]);
  const labels = useMemo(() => [...new Set(notes.flatMap((n) => n.labels))].sort(), [notes]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (category !== 'all' && n.category !== category) return false;
      if (label && !n.labels.includes(label)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        htmlToText(n.body).toLowerCase().includes(q) ||
        n.labels.some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [notes, query, category, label]);

  // Pinned float to the top within the current filter.
  const ordered = useMemo(
    () => [...shown].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [shown],
  );

  const reader = readerId ? notes.find((n) => n.id === readerId) ?? null : null;

  const openCreate = () => setComposer({ open: true, note: null });
  const openEdit = (note: StaffNote) => { setReaderId(null); setComposer({ open: true, note }); };
  const closeComposer = () => setComposer((c) => ({ ...c, open: false }));

  function saveNote(draft: Draft) {
    mutate((xs) => {
      if (composer.note) {
        return xs.map((n) => (n.id === composer.note!.id ? { ...n, ...draft, updatedAt: nowIso() } : n));
      }
      const ts = nowIso();
      return [{ id: newNoteId(), ...draft, pinned: false, createdAt: ts, updatedAt: ts }, ...xs];
    });
    closeComposer();
  }

  const togglePin = (id: string) => mutate((xs) => xs.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  const deleteNote = (id: string) => mutate((xs) => xs.filter((n) => n.id !== id));

  return (
    <>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <Chip active={category === 'all'} onClick={() => setCategory('all')} label="All" />
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)} label={c} />
          ))}
        </div>
        {viewOnly ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3.5 py-2 text-xs text-muted-foreground">
            <i className="ph-bold ph-lock-simple" aria-hidden /> View only
          </span>
        ) : (
          <button
            onClick={openCreate}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <i className="ph-bold ph-plus" aria-hidden /> New note
          </button>
        )}
      </div>

      {/* Label filter row */}
      {labels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Labels:</span>
          {labels.map((l) => (
            <button
              key={l}
              onClick={() => setLabel(label === l ? null : l)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${label === l ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              #{l}
            </button>
          ))}
          {label && (
            <button onClick={() => setLabel(null)} className="text-xs font-semibold text-primary hover:underline">Clear</button>
          )}
        </div>
      )}

      {ordered.length === 0 ? (
        notes.length === 0 ? (
          <div className="kcard flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><i className="ph-bold ph-note-pencil text-2xl" aria-hidden /></span>
            <div>
              <p className="display text-lg font-bold">Your notebook is empty</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Capture snippets, ideas, images, links and videos — all private to you.</p>
            </div>
            {!viewOnly && (
              <button onClick={openCreate} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <i className="ph-bold ph-plus" aria-hidden /> Create your first note
              </button>
            )}
          </div>
        ) : (
          <EmptyState kind="no-match" />
        )
      ) : (
        // Masonry via CSS columns — notes vary in height, so a column flow reads better than a rigid grid.
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {ordered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={() => setReaderId(n.id)}
              onEdit={viewOnly ? undefined : () => openEdit(n)}
              onTogglePin={viewOnly ? undefined : () => togglePin(n.id)}
              onDelete={viewOnly ? undefined : () => deleteNote(n.id)}
            />
          ))}
        </div>
      )}

      <NoteReader
        note={reader}
        onClose={() => setReaderId(null)}
        onEdit={viewOnly ? undefined : () => reader && openEdit(reader)}
        onTogglePin={viewOnly ? undefined : () => reader && togglePin(reader.id)}
        onDelete={viewOnly ? undefined : () => { if (reader) { deleteNote(reader.id); setReaderId(null); } }}
      />

      {!viewOnly && <NoteComposer open={composer.open} note={composer.note} onClose={closeComposer} onSave={saveNote} />}
    </>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );
}
