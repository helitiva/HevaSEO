'use client';
/**
 * Viewer context — "who is looking at this shared component".
 *
 * The admin and manager areas reuse the same heavy components (orders explorer,
 * hover cards, order/staff detail). Those components must render differently for
 * a manager: no money, impersonation is view-only, and the customer portal can't
 * be impersonated at all. Rather than thread a `role`/`showMoney` prop through
 * many layers of nesting, each shell publishes the viewer once and the leaf
 * components read it.
 *
 * Default is `admin`, so any component used WITHOUT a provider (the entire
 * existing /admin tree) behaves exactly as before — only the manager shell opts
 * into the stricter viewer.
 *
 * This is a UI-layer convenience, not a security boundary. The database (RLS)
 * remains the real gate per the master plan; this only keeps the UI honest.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { can, type Role } from './rbac';
import { money as moneyReal } from '@/data/adminMock';

const ViewerContext = createContext<Role>('admin');

export function ViewerProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <ViewerContext.Provider value={role}>{children}</ViewerContext.Provider>;
}

export function useViewerRole(): Role {
  return useContext(ViewerContext);
}

/**
 * The base path of the area the viewer is in: `/manager` for a manager, `/admin`
 * otherwise. Shared components (hover cards, detail panels) build profile links
 * from this so a manager stays inside /manager instead of bouncing into /admin
 * (which their role cannot enter).
 */
export function useAreaBase(): '/admin' | '/manager' {
  return useContext(ViewerContext) === 'manager' ? '/manager' : '/admin';
}

/** May the current viewer see monetary figures (order value, LTV, payroll, credit)? */
export function useShowMoney(): boolean {
  return can(useContext(ViewerContext), 'pricing.view');
}

const MASK_MONEY = (_n: number): string => '—';

/**
 * A money formatter bound to the current viewer: the real formatter for admins,
 * a redacting dash for anyone without `pricing.view` (managers). Call inside any
 * component that renders money — `const money = useMoney();` — so the same JSX
 * works in both areas.
 */
export function useMoney(): (n: number) => string {
  return useShowMoney() ? moneyReal : MASK_MONEY;
}

export interface ImpersonatePolicy {
  /** May impersonate a staff member at all. */
  canStaff: boolean;
  /** May impersonate a customer (open the client portal as them). */
  canCustomer: boolean;
  /** View-only: open the portal in read-only mode (no acting on the user's behalf). */
  viewOnly: boolean;
}

/**
 * Impersonation rights for the current viewer. Admins get full impersonation of
 * both staff and customers. Managers may only *view* a staff member's portal
 * (read-only, finance hidden) and may never impersonate a customer.
 */
export function useImpersonatePolicy(): ImpersonatePolicy {
  const role = useContext(ViewerContext);
  if (role === 'manager') return { canStaff: true, canCustomer: false, viewOnly: true };
  return { canStaff: true, canCustomer: true, viewOnly: false };
}
