'use client';
import { useCallback, useEffect, useState } from 'react';
import { DOCS, type StaffDoc } from './staffDocs';

// Editable docs library (Phase-0 mock). The built-in DOCS are read-only system seeds;
// admin-created docs live in localStorage so they persist across navigation and show up
// in every audience's docs view (customer / staff / manager) the moment they're published.
// A real app would back this with a server + RLS; this is the mock equivalent.
const KEY = 'heva:docs:v1';
const EVT = 'heva:docs-changed';

// Seeds are always system (read-only); created docs are not.
const SEEDS: StaffDoc[] = DOCS.map((d) => ({ ...d, system: true }));

function readCreated(): StaffDoc[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StaffDoc[]) : [];
  } catch {
    return [];
  }
}

function writeCreated(docs: StaffDoc[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(docs)); } catch { /* quota / private mode — ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function newDocId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DocsApi {
  docs: StaffDoc[]; // merged: created (newest first) + seeds
  created: StaffDoc[];
  ready: boolean;
  addDoc: (doc: StaffDoc) => void;
  updateDoc: (id: string, patch: Partial<StaffDoc>) => void;
  removeDoc: (id: string) => void;
}

export function useDocs(): DocsApi {
  const [created, setCreated] = useState<StaffDoc[]>([]); // SSR-safe; hydrated on mount
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCreated(readCreated());
    setReady(true);
    const sync = () => setCreated(readCreated());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const mutate = useCallback((fn: (xs: StaffDoc[]) => StaffDoc[]) => {
    const next = fn(readCreated());
    writeCreated(next);
    setCreated(next);
  }, []);

  const addDoc = useCallback((doc: StaffDoc) => mutate((xs) => [{ ...doc, system: false }, ...xs]), [mutate]);
  const updateDoc = useCallback((id: string, patch: Partial<StaffDoc>) =>
    mutate((xs) => xs.map((d) => (d.id === id ? { ...d, ...patch } : d))), [mutate]);
  const removeDoc = useCallback((id: string) => mutate((xs) => xs.filter((d) => d.id !== id)), [mutate]);

  return { docs: [...created, ...SEEDS], created, ready, addDoc, updateDoc, removeDoc };
}
