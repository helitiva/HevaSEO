// Pure calendar-grid logic — no React. Unit-tested in calendar.test.ts.

export interface CalCell { date: string; day: number; inMonth: boolean; isToday: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Month a deadline falls in, e.g. "2026-06". Drives the month a calendar opens on.
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

// Build a 6-row (42-cell) Monday-first month grid for `month` ("yyyy-mm"), marking `today`.
export function monthGrid(month: string, today: string): CalCell[] {
  const [y, m] = month.split('-').map(Number);
  const monthIdx = m - 1;
  const first = new Date(Date.UTC(y, monthIdx, 1));
  // Monday-first offset: JS getUTCDay() is 0=Sun..6=Sat.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, monthIdx, 1 - lead));

  const cells: CalCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    cells.push({
      date,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === monthIdx,
      isToday: date === today,
    });
  }
  return cells;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Human month label e.g. "June 2026".
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
