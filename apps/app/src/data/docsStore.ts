'use client';
import { useCallback, useEffect, useState } from 'react';
import { DOCS, type StaffDoc } from './staffDocs';

// Editable docs library (Phase-0 mock). Two layers, merged in the client:
//  - built-in DOCS seeds (shipped in code)
//  - admin edits in localStorage: `created` (new docs AND overrides of a seed, keyed by id)
//    plus `hidden` (tombstones for seeds the admin deleted).
// Result: every doc is editable and deletable. Editing a seed writes an override with the
// same id (which wins over the seed); deleting a seed hides it. A real app would back this
// with a server + RLS; this is the mock equivalent.
const KEY = 'heva:docs:v1';
const HIDDEN_KEY = 'heva:docs:hidden:v1';
const EVT = 'heva:docs-changed';

const SEEDS: StaffDoc[] = DOCS.map((d) => ({ ...d, system: true }));
const SEED_IDS = new Set(SEEDS.map((d) => d.id));
export function isSeedId(id: string): boolean { return SEED_IDS.has(id); }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode — ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function newDocId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mergeDocs(created: StaffDoc[], hidden: string[]): StaffDoc[] {
  const createdIds = new Set(created.map((d) => d.id));
  const seeds = SEEDS.filter((s) => !createdIds.has(s.id) && !hidden.includes(s.id));
  return [...created, ...seeds];
}

export interface DocsApi {
  docs: StaffDoc[]; // merged, with overrides + tombstones applied
  created: StaffDoc[];
  ready: boolean;
  saveDoc: (doc: StaffDoc) => void; // add new OR override (by id)
  removeDoc: (id: string) => void; // delete a created doc, or tombstone a seed
  isSeed: (id: string) => boolean;
}

export function useDocs(): DocsApi {
  const [created, setCreated] = useState<StaffDoc[]>([]); // SSR-safe; hydrated on mount
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => { setCreated(readJson<StaffDoc[]>(KEY, [])); setHidden(readJson<string[]>(HIDDEN_KEY, [])); };
    load();
    setReady(true);
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener(EVT, load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const saveDoc = useCallback((doc: StaffDoc) => {
    const next = readJson<StaffDoc[]>(KEY, []);
    const entry = { ...doc, system: false };
    const i = next.findIndex((d) => d.id === doc.id);
    const updated = i >= 0 ? next.map((d, n) => (n === i ? entry : d)) : [entry, ...next];
    writeJson(KEY, updated);
    setCreated(updated);
    // Editing a previously-deleted seed un-hides it.
    if (SEED_IDS.has(doc.id)) {
      const h = readJson<string[]>(HIDDEN_KEY, []).filter((x) => x !== doc.id);
      writeJson(HIDDEN_KEY, h);
      setHidden(h);
    }
  }, []);

  const removeDoc = useCallback((id: string) => {
    const next = readJson<StaffDoc[]>(KEY, []).filter((d) => d.id !== id);
    writeJson(KEY, next);
    setCreated(next);
    if (SEED_IDS.has(id)) {
      const h = readJson<string[]>(HIDDEN_KEY, []);
      if (!h.includes(id)) { const updated = [...h, id]; writeJson(HIDDEN_KEY, updated); setHidden(updated); }
    }
  }, []);

  return { docs: mergeDocs(created, hidden), created, ready, saveDoc, removeDoc, isSeed: isSeedId };
}
