// Deliberately not behind `import 'server-only'`, like orderMap.ts: this is a pure check over a result
// that has already been awaited — no I/O, no secrets, nothing to leak — and the boundary stays where it
// belongs, on the *.server.ts callers. Keeping it importable is what lets allRows.test.ts run at all,
// and an unproven tripwire is not a tripwire.

/**
 * Read every row of a query — or fail loudly. Never silently a prefix.
 *
 * PostgREST caps every response at `max_rows` (1000, see supabase/config.toml) and **does not error
 * when it truncates**: it returns 1000 rows and a 200. Any code that then sums, counts or filters the
 * result is quietly wrong from row 1,001 onward, forever, with nothing in the logs.
 *
 * Adding `.limit(1000)` does not fix that — it only makes the truncation intentional. The fix is to
 * know. `count: 'exact'` makes Postgres report the true total alongside the page, so the two can be
 * compared: if the server holds more rows than it handed back, that is a bug in this code (a read that
 * outgrew the cap), and a bug about money must stop the page rather than under-report it.
 *
 * Use this for reads whose CORRECTNESS depends on completeness — anything summed, counted or
 * reconciled. For a genuinely long list a human scrolls, paginate instead; for aggregates, do the
 * aggregate in SQL (see the revenue_book RPC) so the row count never matters at all.
 *
 * @example
 *   const rows = await allRows('getLedger', supabase.from('credit_ledger')
 *     .select('id, amount, kind', { count: 'exact' }).order('created_at', { ascending: false }));
 */
export async function allRows<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>,
): Promise<T[]> {
  const { data, error, count } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  const rows = data ?? [];
  if (count !== null && count > rows.length) {
    throw new Error(
      `${label}: read was TRUNCATED — the database holds ${count} rows and PostgREST returned ${rows.length}. ` +
      `Every total derived from this would be wrong and nothing would say so. Aggregate in SQL, or paginate ` +
      `this read (see lib/supabase/allRows.ts).`,
    );
  }
  return rows;
}
