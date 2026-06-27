// Pure settings logic — no React. Leave balance, working-hours summary, and the option lists
// the staff Settings page renders. Unit-tested in staffSettings.test.ts.
import { leaveDays, type LeaveStatus } from './leave';

// ---- Leave balance ----
export const LEAVE_ALLOWANCE = 20; // paid days off per year (mock policy)

export interface LeaveEntry { from: string; to: string; status: LeaveStatus }
export interface LeaveSummary { allowance: number; used: number; pending: number; remaining: number }

// Roll a set of leave entries into a balance. Approved days count as used; pending days are
// shown separately (not yet deducted); declined entries are ignored.
export function leaveSummary(entries: LeaveEntry[], allowance: number = LEAVE_ALLOWANCE): LeaveSummary {
  let used = 0;
  let pending = 0;
  for (const e of entries) {
    const days = leaveDays(e.from, e.to) ?? 0;
    if (e.status === 'approved') used += days;
    else if (e.status === 'pending') pending += days;
  }
  return { allowance, used, pending, remaining: Math.max(0, allowance - used) };
}

// ---- Working-hours summary (for the at-a-glance line that links out to the Calendar) ----
export interface DaySchedule { on: boolean; start: string; end: string }

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export function workingHoursSummary(hours: DaySchedule[]): { days: number; weekly: number } {
  let days = 0;
  let weekly = 0;
  for (const h of hours) {
    if (!h.on) continue;
    days += 1;
    weekly += hoursBetween(h.start, h.end);
  }
  return { days, weekly: Math.round(weekly) };
}

// ---- Notification preferences ----
export interface NotifPref { id: string; label: string; desc: string; email: boolean; inApp: boolean }
export const DEFAULT_NOTIF_PREFS: NotifPref[] = [
  { id: 'assignment', label: 'New task assigned', desc: 'When a task lands on your board', email: true, inApp: true },
  { id: 'changes', label: 'Changes requested', desc: 'When a reviewer sends work back', email: true, inApp: true },
  { id: 'deadline', label: 'Deadline reminders', desc: 'A nudge before a task is due', email: false, inApp: true },
  { id: 'approved', label: 'Work approved', desc: 'When your delivery passes review', email: false, inApp: true },
  { id: 'payout', label: 'Payout & wallet updates', desc: 'Payout status, bonuses and penalties', email: true, inApp: true },
];

// ---- Preference option lists ----
export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
] as const;
export const DATE_FORMATS = [
  { id: 'iso', label: '2026-06-27 (ISO)' },
  { id: 'dmy', label: '27/06/2026' },
  { id: 'mdy', label: '06/27/2026' },
] as const;
