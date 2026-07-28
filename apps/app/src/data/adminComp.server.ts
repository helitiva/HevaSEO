import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { allRows } from '@/lib/supabase/allRows';
import {
  computePayrollPreview,
  type OrderRow, type ProfileRow, type CompRow, type PodRow, type RunRow, type PayrollPreview,
} from '@/data/adminComp';

/**
 * Payroll computed from REAL work, admin-side (RLS: admin sees the whole tenant). This file is the I/O
 * half; the accrual MATH lives in adminComp.ts (pure, unit-tested by adminComp.test.ts).
 */
export type { CompLine, PayrollPreview } from '@/data/adminComp';

/** period: 'YYYY-MM' (defaults to the current month). */
export async function getPayrollPreview(period?: string): Promise<PayrollPreview> {
  const supabase = await createClient();
  const p = period ?? new Date().toISOString().slice(0, 7);

  // allRows surfaces every read failure AND a truncated read. Swallowing the comp read is how a missing
  // GRANT silently rendered every salary as "not set" instead of erroring; a truncated orders read would
  // do the same thing to commission — under-pay every worker, with nothing in the logs.
  const [orders, profiles, comps, pods, runs] = await Promise.all([
    allRows<OrderRow>('getPayrollPreview orders', supabase.from('orders')
      .select('value, state, delivered_at, assignee_id', { count: 'exact' }).returns<OrderRow[]>()),
    allRows<ProfileRow>('getPayrollPreview profiles', supabase.from('profiles')
      .select('id, name, role', { count: 'exact' }).in('role', ['staff', 'manager']).returns<ProfileRow[]>()),
    allRows<CompRow>('getPayrollPreview staff_comp', supabase.from('staff_comp')
      .select('profile_id, base_salary, commission_pct', { count: 'exact' }).returns<CompRow[]>()),
    allRows<PodRow>('getPayrollPreview staff_details', supabase.from('staff_details')
      .select('profile_id, manager_id', { count: 'exact' }).returns<PodRow[]>()),
    // what has actually been PAID for this period. run_payroll is idempotent per (worker, period), so
    // at most one row each — but sum defensively rather than assume.
    allRows<RunRow>('getPayrollPreview payroll_runs', supabase.from('payroll_runs')
      .select('staff_id, total', { count: 'exact' }).eq('period', p).returns<RunRow[]>()),
  ]);

  return computePayrollPreview(p, orders, profiles, comps, pods, runs);
}
