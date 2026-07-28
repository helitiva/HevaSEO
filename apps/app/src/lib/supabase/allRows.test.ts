import { describe, it, expect } from 'vitest';
import { allRows } from './allRows';

/**
 * These tests exist because the failure they guard against is INVISIBLE. PostgREST truncating a read at
 * max_rows returns a 200 and a short array — identical, from Node's side, to a table that really is that
 * short. Nothing throws, nothing logs, and the money book just quietly reports less money than we hold.
 *
 * So the only thing worth asserting here is that the tripwire fires. A guard nobody has watched trip is
 * indistinguishable from a guard that doesn't work.
 */

/** Stands in for a PostgREST query — the awaited shape is all allRows touches. */
const reply = <T>(data: T[] | null, count: number | null, error: { message: string } | null = null) =>
  Promise.resolve({ data, error, count });

describe('allRows', () => {
  it('returns the rows when the server sent every one of them', async () => {
    const rows = [{ amount: 10 }, { amount: 20 }];
    await expect(allRows('t', reply(rows, 2))).resolves.toEqual(rows);
  });

  it('throws when the server holds more rows than it returned', async () => {
    // The whole point: 1000 rows back, 4321 in the table, HTTP 200. Silent truncation.
    const page = Array.from({ length: 1000 }, () => ({ amount: 1 }));
    await expect(allRows('getLedger', reply(page, 4321))).rejects.toThrow(/TRUNCATED.*4321.*1000/s);
  });

  it('throws even when only one row was dropped', async () => {
    // No tolerance band. One missing ledger row is one wrong total.
    await expect(allRows('t', reply([{ amount: 1 }], 2))).rejects.toThrow(/TRUNCATED/);
  });

  it('names the caller so the error says which read broke', async () => {
    await expect(allRows('getPayrollPreview orders', reply([], 9))).rejects.toThrow(/^getPayrollPreview orders:/);
  });

  it('propagates a query error instead of returning an empty result', async () => {
    // An RLS denial must not read as "this customer has no money".
    await expect(allRows('t', reply(null, null, { message: 'permission denied' })))
      .rejects.toThrow('t: permission denied');
  });

  it('accepts an empty table (0 rows, count 0) — that is not truncation', async () => {
    await expect(allRows('t', reply([], 0))).resolves.toEqual([]);
  });

  it('tolerates a null count rather than inventing truncation', async () => {
    // count is null when the caller forgot { count: 'exact' }. Can't verify; don't fabricate a failure.
    await expect(allRows('t', reply([{ amount: 1 }], null))).resolves.toEqual([{ amount: 1 }]);
  });

  it('treats null data as no rows, not a crash', async () => {
    await expect(allRows('t', reply(null, 0))).resolves.toEqual([]);
  });
});
