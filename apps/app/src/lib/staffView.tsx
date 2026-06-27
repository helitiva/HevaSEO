'use client';
/**
 * Staff portal "view-only" context.
 *
 * When a manager looks in on a staffer (impersonate in 'view' mode), the staff
 * portal must be read-only — the manager may observe but not act on the
 * staffer's behalf ("không làm hộ việc") — and the staffer's finance is hidden.
 * The StaffShell publishes whether the current session is view-only; sidebars,
 * pages and action buttons read it. Default false (the staffer's own session, or
 * a full admin impersonation, both of which can act).
 */
import { createContext, useContext, type ReactNode } from 'react';

const StaffViewOnlyContext = createContext<boolean>(false);

export function StaffViewOnlyProvider({ viewOnly, children }: { viewOnly: boolean; children: ReactNode }) {
  return <StaffViewOnlyContext.Provider value={viewOnly}>{children}</StaffViewOnlyContext.Provider>;
}

/** Is the staff portal currently in read-only manager view? */
export function useStaffViewOnly(): boolean {
  return useContext(StaffViewOnlyContext);
}
