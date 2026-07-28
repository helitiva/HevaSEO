'use client';
import { useEffect, useState } from 'react';

// Session-only overlay for admin-provisioned managers/admins. Shows a freshly created entry in the
// Managers directory immediately after create_manager — which already revalidatePath's /admin/managers,
// so the real profile row arrives from the server on the next load.
//
// Kept IN-MEMORY, not localStorage, on purpose: a persisted overlay carries a client-made id that never
// matches the real one, so it would render the manager TWICE — forever. Session-only means the optimistic
// row is discarded on reload, exactly when the real one has arrived.

export interface CreatedManager {
  id: string;
  name: string;
  email: string;
  title: string;
  rank: string;            // e.g. "Team Lead", "Director"
  role: 'manager' | 'admin';
  createdAt: string;       // ISO date
}

const EVT = 'heva:manager-accounts-changed';
let created: CreatedManager[] = []; // module-level, per session; gone on a full reload

export function addCreatedManager(m: CreatedManager): void {
  created = [m, ...created.filter((x) => x.id !== m.id)];
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

export function useCreatedManagers(): CreatedManager[] {
  const [list, setList] = useState<CreatedManager[]>([]);
  useEffect(() => {
    const load = () => setList(created);
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  return list;
}
