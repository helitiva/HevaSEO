import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_CAPABILITIES,
  can,
  capabilityForPath,
  canAccessPath,
  homePathFor,
  filterNav,
  type Role,
} from './rbac';

describe('can / role matrix', () => {
  it('admin is a strict superset of manager (manager grants nothing admin lacks)', () => {
    for (const capability of ROLE_CAPABILITIES.manager) {
      expect(can('admin', capability)).toBe(true);
    }
    // ...and admin has money powers the manager does not, so it is *strictly* more.
    expect(ROLE_CAPABILITIES.admin.length).toBeGreaterThan(ROLE_CAPABILITIES.manager.length);
  });

  it('manager is a money-blind ops admin in its own area', () => {
    expect(can('manager', 'manager.access')).toBe(true);
    expect(can('manager', 'orders.manage')).toBe(true);
    expect(can('manager', 'staff.manage')).toBe(true);
    // hidden from managers:
    expect(can('manager', 'admin.access')).toBe(false); // cannot enter the admin area
    expect(can('manager', 'pricing.view')).toBe(false); // never sees order/customer money
    expect(can('manager', 'finance.view')).toBe(false);
    expect(can('manager', 'analytics.view')).toBe(false);
    expect(can('manager', 'managers.manage')).toBe(false);
    expect(can('manager', 'catalog.view')).toBe(false); // no catalog at all
    expect(can('manager', 'catalog.manage')).toBe(false);
    expect(can('manager', 'org.settings')).toBe(false);
  });

  it('staff never see pricing but do see internal notes', () => {
    expect(can('staff', 'pricing.view')).toBe(false);
    expect(can('staff', 'notes.internal.view')).toBe(true);
    expect(can('staff', 'orders.manage')).toBe(false);
  });

  it('customers see their pricing but never internal notes', () => {
    expect(can('customer', 'pricing.view')).toBe(true);
    expect(can('customer', 'notes.internal.view')).toBe(false);
    expect(can('customer', 'admin.access')).toBe(false);
  });
});

describe('capabilityForPath', () => {
  it('matches the most specific prefix first', () => {
    expect(capabilityForPath('/admin/finance')).toBe('finance.view');
    expect(capabilityForPath('/admin/finance/payroll')).toBe('finance.view');
    expect(capabilityForPath('/admin')).toBe('admin.access');
    expect(capabilityForPath('/admin/orders/123')).toBe('orders.manage');
  });

  it('treats unmapped paths as public', () => {
    expect(capabilityForPath('/login')).toBeNull();
    expect(capabilityForPath('/')).toBeNull();
  });

  it('does not match a prefix that is only a partial path segment', () => {
    // '/orders' must not swallow '/admin/orders' style false positives
    expect(capabilityForPath('/ordersomething')).toBeNull();
  });
});

describe('canAccessPath', () => {
  it('lets a manager into its own /manager area, not the /admin area or money', () => {
    expect(canAccessPath('manager', '/manager')).toBe(true);
    expect(canAccessPath('manager', '/manager/orders')).toBe(true);
    expect(canAccessPath('manager', '/manager/staff')).toBe(true);
    expect(canAccessPath('manager', '/manager/docs')).toBe(true); // knowledge base
    expect(canAccessPath('manager', '/manager/notes')).toBe(true); // private notebook
    expect(canAccessPath('manager', '/admin')).toBe(false); // separate area, no admin.access
    expect(canAccessPath('manager', '/admin/finance')).toBe(false);
    expect(canAccessPath('manager', '/admin/analytics')).toBe(false);
  });

  it('admin can preview the manager area too', () => {
    expect(canAccessPath('admin', '/manager')).toBe(true);
    expect(canAccessPath('admin', '/manager/staff')).toBe(true);
  });

  it('keeps roles out of each other’s areas', () => {
    expect(canAccessPath('staff', '/admin')).toBe(false);
    expect(canAccessPath('staff', '/manager')).toBe(false);
    expect(canAccessPath('customer', '/staff')).toBe(false);
    expect(canAccessPath('admin', '/staff')).toBe(false); // admin area ≠ staff area
  });

  it('allows public paths for everyone', () => {
    for (const role of ROLES) {
      expect(canAccessPath(role, '/login')).toBe(true);
    }
  });
});

describe('homePathFor', () => {
  it('routes each role to its landing surface', () => {
    expect(homePathFor('admin')).toBe('/admin');
    expect(homePathFor('manager')).toBe('/manager');
    expect(homePathFor('staff')).toBe('/staff');
    expect(homePathFor('customer')).toBe('/dashboard');
  });
});

describe('filterNav', () => {
  const nav = [
    { title: 'Operate', items: [{ href: '/admin/orders' }, { href: '/admin/review' }] },
    { title: 'Business', items: [{ href: '/admin/finance' }, { href: '/admin/analytics' }] },
  ];

  it('admin keeps every section', () => {
    expect(filterNav(nav, 'admin')).toHaveLength(2);
  });

  it('manager loses the Business section entirely (all items gated)', () => {
    const filtered = filterNav(nav, 'manager');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Operate');
  });

  it('does not mutate the source nav', () => {
    filterNav(nav, 'manager');
    expect(nav[1].items).toHaveLength(2);
  });
});

describe('matrix has no duplicate capability entries', () => {
  it('each role lists every capability at most once', () => {
    for (const role of ROLES) {
      const caps = ROLE_CAPABILITIES[role as Role];
      expect(new Set(caps).size).toBe(caps.length);
    }
  });
});
