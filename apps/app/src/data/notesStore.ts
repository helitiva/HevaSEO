'use client';
import { useCallback, useEffect, useState } from 'react';
import { SEED_NOTES, type StaffNote } from './staffNotes';

// Customer and admin/manager notebooks start empty — the staff seed notes are
// authored for a staffer's workflow context and must not appear in other surfaces.
const EMPTY_NOTES: StaffNote[] = [];

// One source of truth for notes shared by the list, the modal, and the full-page routes.
// Backed by localStorage so edits persist across navigation and stay in sync between surfaces
// (a real app would use a server + query cache; this is the Phase-0 mock equivalent).
//
// The notebook is PRIVATE per surface: the manager portal (/manager/notes) keeps its own
// notes, separate from the staff portal, by namespacing the storage key on the URL area.
const EVT = 'heva:notes-changed';

function notesKey(): string {
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p.startsWith('/admin')) return 'heva:admin:notes:v1';
  if (p.startsWith('/manager')) return 'heva:manager:notes:v1';
  if (p.startsWith('/staff')) return 'heva:staff:notes:v1';
  return 'heva:customer:notes:v1';
}

/** Return the appropriate seed for the current surface when no localStorage data exists yet. */
function seedForSurface(): StaffNote[] {
  if (typeof window === 'undefined') return SEED_NOTES; // SSR default — will be overridden on hydration
  const p = window.location.pathname;
  // Staff and manager portals get the staff-flavoured seed notes.
  if (p.startsWith('/staff') || p.startsWith('/manager')) return SEED_NOTES;
  // Customer, admin, and all other surfaces start empty.
  return EMPTY_NOTES;
}

function read(): StaffNote[] {
  if (typeof window === 'undefined') return SEED_NOTES;
  try {
    const raw = window.localStorage.getItem(notesKey());
    return raw ? (JSON.parse(raw) as StaffNote[]) : seedForSurface();
  } catch {
    return seedForSurface();
  }
}

function write(notes: StaffNote[]): void {
  try { window.localStorage.setItem(notesKey(), JSON.stringify(notes)); } catch { /* quota / private mode — ignore */ }
  window.dispatchEvent(new Event(EVT)); // notify other hook instances in this tab
}

export function useNotes() {
  // Use an empty array as the SSR/initial seed to avoid hydration mismatches on surfaces that
  // don't use staff notes (customer, admin). The correct surface seed is applied on mount in the
  // useEffect below, where `window.location` is available.
  const [notes, setNotes] = useState<StaffNote[]>(EMPTY_NOTES);
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
