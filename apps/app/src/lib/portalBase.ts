'use client';
import { usePathname } from 'next/navigation';

// The portal root for the surface the user is currently in. Lets the Docs/Notes UI
// (shared across all four surfaces) build links and router pushes that stay in the
// right area: '/admin', '/manager', '/staff', or '' for the customer portal (root routes).
export type PortalBase = '/admin' | '/manager' | '/staff' | '';
export function usePortalBase(): PortalBase {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/admin')) return '/admin';
  if (pathname.startsWith('/manager')) return '/manager';
  if (pathname.startsWith('/staff')) return '/staff';
  return '';
}
