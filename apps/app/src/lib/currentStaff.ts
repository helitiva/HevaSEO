// Server-side resolution of "who is the staff portal rendering for".
// Normally the demo staffer (CURRENT_STAFF). When an admin impersonates someone, the `heva_as`
// cookie carries that staff id and every staff page renders that person instead. Validated against
// the real roster so a stale/garbage cookie falls back to the default.
import { cookies } from 'next/headers';
import { STAFF } from '@/data/adminMock';
import { CURRENT_STAFF } from '@/data/staffMock';
import { IMPERSONATE_COOKIE } from '@/lib/impersonation';

export interface StaffIdentity { id: string; name: string; role: string; impersonated: boolean }

export async function currentStaffId(): Promise<string> {
  const store = await cookies();
  const id = store.get(IMPERSONATE_COOKIE)?.value;
  if (id && id !== CURRENT_STAFF.id && STAFF.some((s) => s.id === id)) return id;
  return CURRENT_STAFF.id;
}

export async function currentStaffIdentity(): Promise<StaffIdentity> {
  const id = await currentStaffId();
  const s = STAFF.find((x) => x.id === id);
  return {
    id,
    name: s?.name ?? CURRENT_STAFF.name,
    role: s?.role ?? CURRENT_STAFF.role,
    impersonated: id !== CURRENT_STAFF.id,
  };
}
