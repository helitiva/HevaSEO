import { CUSTOMERS, STAFF, MANAGERS } from '@/data/adminMock';
import { adminAffiliates } from '@/data/adminAffiliate';
import type { Broadcast, BroadcastAudience } from '@/data/broadcasts';

// A concrete person a broadcast reaches. Phase-0 derives the roster from the real mock
// entities (customers / staff / managers / affiliates) so analytics reflects an actual
// audience instead of a single demo persona. `id` is namespaced by audience to stay unique
// when a message targets several audiences.
export interface Recipient {
  id: string;
  refId: string;        // the underlying entity id (c1, s1, mgr1, af-jane…)
  name: string;
  sub: string;          // company / role / title / handle — secondary line
  initials: string;
  audience: BroadcastAudience;
}

const initialsOf = (name: string): string => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function audienceRoster(aud: BroadcastAudience): Recipient[] {
  switch (aud) {
    case 'customer':
      return CUSTOMERS.map((c) => ({ id: `customer:${c.id}`, refId: c.id, name: c.name, sub: c.company, initials: initialsOf(c.name), audience: 'customer' }));
    case 'staff':
      return STAFF.map((s) => ({ id: `staff:${s.id}`, refId: s.id, name: s.name, sub: s.role, initials: initialsOf(s.name), audience: 'staff' }));
    case 'manager':
      return MANAGERS.map((m) => ({ id: `manager:${m.id}`, refId: m.id, name: m.name, sub: m.title, initials: initialsOf(m.name), audience: 'manager' }));
    case 'affiliate':
      return adminAffiliates().map((a) => ({ id: `affiliate:${a.id}`, refId: a.id, name: a.name, sub: a.handle, initials: a.avatarInitials, audience: 'affiliate' }));
    default:
      return [];
  }
}

// Everyone a message reaches, across all its audiences.
export function recipientsFor(b: Broadcast): Recipient[] {
  return b.audiences.flatMap((a) => audienceRoster(a));
}
