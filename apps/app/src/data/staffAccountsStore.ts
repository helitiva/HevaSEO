'use client';
import { useEffect, useState } from 'react';

// Session-only overlay for admin-provisioned staff. Holds just enough to render a freshly created member
// immediately after create_staff_member — which already revalidatePath's /admin/staff, so the real row
// (with its real profile id) arrives from the server on the next load.
//
// Kept IN-MEMORY, not localStorage, on purpose: a persisted overlay carries a client-made id that never
// matches the real one, so it would render the member TWICE — forever — once from the revalidated server
// roster and once from the stale overlay. Session-only means the optimistic row is discarded on reload,
// exactly when the real one has arrived. Same window-event pattern as before for live subscribers.

export interface CreatedStaff {
  id: string;
  name: string;
  email: string;
  role: string;       // role title, e.g. "SEO Specialist"
  capacity: number;
  skills: string[];
  createdAt: string;  // ISO date
}

const EVT = 'heva:staff-accounts-changed';
let created: CreatedStaff[] = []; // module-level, per session; gone on a full reload

export function addCreatedStaff(s: CreatedStaff): void {
  created = [s, ...created.filter((x) => x.id !== s.id)];
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

export function useCreatedStaff(): CreatedStaff[] {
  const [list, setList] = useState<CreatedStaff[]>([]);
  useEffect(() => {
    const load = () => setList(created);
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  return list;
}
