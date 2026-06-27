/**
 * Drift guard: keeps the nav configs and the RBAC matrix in lock-step.
 *
 * The RBAC files do NOT auto-update when you add a feature. This test is the
 * safety net: add a route to a sidebar and forget to map it in ROUTE_CAPABILITY
 * and CI fails here — instead of the new page silently becoming public (every
 * role sees it, because an unmapped path is treated as public).
 *
 * When you add a route on purpose that should be public, add its href to
 * PUBLIC_NAV_HREFS below so the intent is explicit and reviewed.
 */
import { describe, it, expect } from 'vitest';
import { ADMIN_NAV } from '@/data/adminNav';
import { MANAGER_NAV } from '@/data/managerNav';
import { STAFF_NAV } from '@/data/staffNav';
import { NAV } from '@/data/nav';
import { ROLES, capabilityForPath, canAccessPath, type Role } from './rbac';

/** Hrefs that are intentionally reachable by everyone (none today). */
const PUBLIC_NAV_HREFS = new Set<string>([]);

const ALL_NAV: { area: string; expectedRole: Role; sections: readonly { items: readonly { href: string; label: string }[] }[] }[] = [
  { area: 'admin', expectedRole: 'admin', sections: ADMIN_NAV },
  { area: 'manager', expectedRole: 'manager', sections: MANAGER_NAV },
  { area: 'staff', expectedRole: 'staff', sections: STAFF_NAV },
  { area: 'portal', expectedRole: 'customer', sections: NAV },
];

const everyNavItem = ALL_NAV.flatMap(({ area, expectedRole, sections }) =>
  sections.flatMap((s) => s.items.map((i) => ({ area, expectedRole, ...i }))),
);

describe('nav ↔ RBAC drift guard', () => {
  it.each(everyNavItem)(
    '$area nav "$label" ($href) maps to a capability (not accidentally public)',
    ({ href }) => {
      if (PUBLIC_NAV_HREFS.has(href)) return;
      expect(capabilityForPath(href)).not.toBeNull();
    },
  );

  it.each(everyNavItem)(
    '$area nav "$label" ($href) is reachable by its own persona',
    ({ href, expectedRole }) => {
      expect(canAccessPath(expectedRole, href)).toBe(true);
    },
  );

  it('no nav route is reachable by every role at once (would mean a leak)', () => {
    for (const { href } of everyNavItem) {
      if (PUBLIC_NAV_HREFS.has(href)) continue;
      const reachableByAll = ROLES.every((role) => canAccessPath(role, href));
      expect(reachableByAll, `${href} is reachable by every role`).toBe(false);
    }
  });
});
