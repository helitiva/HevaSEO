'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type StaffNote } from './staffNotes';
import { getMyNotesAction, upsertNoteAction, deleteNoteAction } from './notes.actions';

// DB-backed notebook (RLS + owner-scoped upsert/delete fns). One source of truth shared by the list,
// the modal and the full-page routes; the {notes, ready, mutate} API is unchanged so callers don't move.
// The notebook is PRIVATE per surface (staff / manager / admin / customer), matched to the URL area.
const EVT = 'heva:notes-changed';

function surfaceFor(): string {
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/manager')) return 'manager';
  if (p.startsWith('/staff')) return 'staff';
  return 'customer';
}

export function useNotes() {
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [ready, setReady] = useState(false);
  /** Last write failure, for the UI to show. Null while everything has saved. */
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<StaffNote[]>([]);
  ref.current = notes;
  const surface = typeof window !== 'undefined' ? surfaceFor() : 'customer';

  useEffect(() => {
    let alive = true;
    const load = () => { void getMyNotesAction(surface).then((xs) => { if (alive) { setNotes(xs); setReady(true); } }); };
    load();
    window.addEventListener(EVT, load);           // same-tab updates from other hook instances
    return () => { alive = false; window.removeEventListener(EVT, load); };
  }, [surface]);

  /**
   * Apply the transform optimistically, then reconcile with the DB — and ROLL BACK if the DB says no.
   *
   * This used to be `void Promise.all(ops).then(() => dispatch)`: no result check, no .catch. Both
   * actions return {ok, error} and both were discarded, so a rejected write was an unhandled rejection
   * and the note stayed on screen looking saved. The user found out on the next reload, when their
   * writing was simply gone. Optimistic UI without rollback isn't optimistic, it's dishonest.
   */
  const mutate = useCallback((fn: (xs: StaffNote[]) => StaffNote[]) => {
    const prev = ref.current;
    const next = fn(prev);
    setNotes(next);
    setError(null);
    const prevById = new Map(prev.map((n) => [n.id, n]));
    const nextIds = new Set(next.map((n) => n.id));
    const ops: Promise<{ ok: boolean; error?: string }>[] = [];
    for (const n of next) {
      const before = prevById.get(n.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(n)) ops.push(upsertNoteAction(surfaceFor(), n));
    }
    for (const p of prev) if (!nextIds.has(p.id)) ops.push(deleteNoteAction(p.id));
    if (!ops.length) return;

    const undo = (msg: string) => { setNotes(prev); ref.current = prev; setError(msg); };
    void Promise.all(ops)
      .then((results) => {
        const failed = results.find((r) => !r.ok);
        if (failed) { undo(failed.error ?? 'Could not save — your change was undone.'); return; }
        window.dispatchEvent(new Event(EVT));
      })
      .catch((e: unknown) => undo(e instanceof Error ? e.message : 'Could not save — your change was undone.'));
  }, []);

  return { notes, ready, mutate, error, clearError: () => setError(null) };
}

// Single-note lookup that stays reactive to store changes.
export function useNote(id: string | null) {
  const { notes, ready } = useNotes();
  return { note: id ? notes.find((n) => n.id === id) ?? null : null, ready };
}
