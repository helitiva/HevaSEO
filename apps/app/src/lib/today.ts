// Single source for the Phase-0 mock "today". Swap to a real clock here when the backend lands.
export const MOCK_TODAY = '2026-06-24';
/** Date object at local midnight of the mock today. */
export function mockTodayDate(): Date { return new Date(`${MOCK_TODAY}T00:00:00`); }
/** Date object at a given time-of-day on the mock today, e.g. mockTodayAt('09:30:00'). */
export function mockTodayAt(time: string, z = ''): Date { return new Date(`${MOCK_TODAY}T${time}${z}`); }
