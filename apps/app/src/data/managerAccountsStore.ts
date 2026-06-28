'use client';
import { useEffect, useState } from 'react';

// Overlay store for admin-provisioned managers/admins (Phase-0, localStorage only).
// Same window-event pattern as broadcastStore. A created entry shows up in the
// Managers directory with an empty team and a "New" state — no fabricated analytics.
// The login account itself lives in lib/auth (role: 'manager' | 'admin').

export interface CreatedManager {
  id: string;
  name: string;
  email: string;
  title: string;
  rank: string;            // e.g. "Team Lead", "Director"
  role: 'manager' | 'admin';
  createdAt: string;       // ISO date
}

const KEY = 'heva:managers:created:v1';
const EVT = 'heva:manager-accounts-changed';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function addCreatedManager(m: CreatedManager): void {
  const list = readJson<CreatedManager[]>(KEY, []);
  writeJson(KEY, [m, ...list.filter((x) => x.id !== m.id)]);
}

export function useCreatedManagers(): CreatedManager[] {
  const [list, setList] = useState<CreatedManager[]>([]);
  useEffect(() => {
    const load = () => setList(readJson<CreatedManager[]>(KEY, []));
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  return list;
}
