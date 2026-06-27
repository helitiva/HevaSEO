// Pure leave / time-off logic — no React. Unit-tested in leave.test.ts.

export type LeaveStatus = 'pending' | 'approved' | 'declined';

// Inclusive day count between two ISO dates (yyyy-mm-dd). Null on bad / inverted input.
export function leaveDays(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export interface LeaveDraft { from: string; to: string; reason: string }

// Validate a time-off request before it can be submitted. Returns an error message or null.
export function validateLeave(draft: LeaveDraft): string | null {
  if (!draft.from || !draft.to) return 'Pick a start and end date.';
  const days = leaveDays(draft.from, draft.to);
  if (days === null) return 'End date must be on or after the start date.';
  if (!draft.reason.trim()) return 'Add a short reason for your request.';
  return null;
}

export function leaveStatusMeta(status: LeaveStatus): { label: string; pill: string } {
  switch (status) {
    case 'approved': return { label: 'Approved', pill: 'pill-live' };
    case 'declined': return { label: 'Declined', pill: 'pill-bad' };
    default: return { label: 'Pending', pill: 'pill-warn' };
  }
}
