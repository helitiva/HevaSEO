'use client';
import { useCallback, useEffect, useState } from 'react';
import { SEED_NOTES, type StaffNote } from './staffNotes';

// One source of truth for notes shared by the list, the modal, and the full-page routes.
// Backed by localStorage so edits persist across navigation and stay in sync between surfaces
// (a real app would use a server + query cache; this is the Phase-0 mock equivalent).
//
// The notebook is PRIVATE per surface: the manager portal (/manager/notes) keeps its own
// notes, separate from the staff portal, by namespacing the storage key on the URL area.
const EVT = 'heva:notes-changed';

function notesKey(): string {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/manager')) {
    return 'heva:manager:notes:v1';
  }
  return 'heva:staff:notes:v1';
}

function read(): StaffNote[] {
  if (typeof window === 'undefined') return SEED_NOTES;
  try {
    const raw = window.localStorage.getItem(notesKey());
    return raw ? (JSON.parse(raw) as StaffNote[]) : SEED_NOTES;
  } catch {
    return SEED_NOTES;
  }
}

function write(notes: StaffNote[]): void {
  try { window.localStorage.setItem(notesKey(), JSON.stringify(notes)); } catch { /* quota / private mode — ignore */ }
  window.dispatchEvent(new Event(EVT)); // notify other hook instances in this tab
}

export function useNotes() {
  const [notes, setNotes] = useState<StaffNote[]>(SEED_NOTES); // SSR-safe seed; hydrated on mount
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNotes(read());
    setReady(true);
    const sync = () => setNotes(read());
    window.addEventListener(EVT, sync);          // same-tab updates
    window.addEventListener('storage', sync);    // other-tab updates
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const mutate = useCallback((fn: (xs: StaffNote[]) => StaffNote[]) => {
    const next = fn(read());
    write(next);
    setNotes(next);
  }, []);

  return { notes, ready, mutate };
}

// Single-note lookup that stays reactive to store changes.
export function useNote(id: string | null) {
  const { notes, ready } = useNotes();
  return { note: id ? notes.find((n) => n.id === id) ?? null : null, ready };
}
