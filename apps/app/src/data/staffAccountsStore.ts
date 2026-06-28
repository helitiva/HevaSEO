'use client';
import { useEffect, useState } from 'react';

// Overlay store for admin-provisioned staff (Phase-0, localStorage only). Same
// window-event pattern as broadcastStore. Holds just enough to render a freshly
// created staff member in the directory with a "New · pending first activity" state —
// no fabricated analytics. The login account itself lives in lib/auth.

export interface CreatedStaff {
  id: string;
  name: string;
  email: string;
  role: string;       // role title, e.g. "SEO Specialist"
  capacity: number;
  skills: string[];
  createdAt: string;  // ISO date
}

const KEY = 'heva:staff:created:v1';
const EVT = 'heva:staff-accounts-changed';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function addCreatedStaff(s: CreatedStaff): void {
  const list = readJson<CreatedStaff[]>(KEY, []);
  writeJson(KEY, [s, ...list.filter((x) => x.id !== s.id)]);
}

export function useCreatedStaff(): CreatedStaff[] {
  const [list, setList] = useState<CreatedStaff[]>([]);
  useEffect(() => {
    const load = () => setList(readJson<CreatedStaff[]>(KEY, []));
    load();
    window.addEventListener(EVT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  return list;
}
