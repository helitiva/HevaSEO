'use client';
import { usePathname } from 'next/navigation';
import type { BroadcastAudience } from '@/data/broadcasts';

// Which recipient audience the current surface belongs to (drives the bell / banner / inbox).
// Admin is the sender, not a recipient, so it's never used there.
export function useBroadcastAudience(): BroadcastAudience {
  const p = usePathname() ?? '';
  if (p.startsWith('/affiliate')) return 'affiliate';
  if (p.startsWith('/staff')) return 'staff';
  if (p.startsWith('/manager')) return 'manager';
  return 'customer'; // customer portal lives at the root
}

// The inbox route for a recipient surface.
export function inboxHref(aud: BroadcastAudience): string {
  return aud === 'customer' ? '/inbox' : `/${aud}/inbox`;
}
