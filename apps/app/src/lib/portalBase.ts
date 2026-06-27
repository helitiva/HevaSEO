'use client';
import { usePathname } from 'next/navigation';

// The portal root for the surface the user is currently in: '/manager' inside the
// manager area, '/staff' otherwise. Lets the Docs/Notes UI (shared by both
// surfaces) build links and router pushes that stay in the right area.
export function usePortalBase(): '/staff' | '/manager' {
  const pathname = usePathname();
  return pathname?.startsWith('/manager') ? '/manager' : '/staff';
}
