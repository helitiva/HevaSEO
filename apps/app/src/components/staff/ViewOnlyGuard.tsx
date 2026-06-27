'use client';
import type { ReactNode } from 'react';
import { useStaffViewOnly } from '@/lib/staffView';

// Hides finance/sensitive content when a manager is observing a staffer's portal
// in read-only view. Wrap server-rendered finance sections so the manager sees a
// notice instead of the staffer's money.
export function ViewOnlyGuard({ children }: { children: ReactNode }) {
  const viewOnly = useStaffViewOnly();
  if (!viewOnly) return <>{children}</>;
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <i className="ph-bold ph-lock-simple mb-2 text-3xl text-muted-foreground" aria-hidden />
      <p className="text-sm font-semibold">Finance is hidden in manager view</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">A manager can review this staffer’s work and performance, but not their pay, wallet, or payout details.</p>
    </div>
  );
}
