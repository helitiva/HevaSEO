'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type PayrollResult = { ok: true } | { ok: false; error: string };

// Lane D inc-D7 — admin posts a worker's pay (salary+gig+bonus+commission) for a period, MONEY (gác③).
// run_payroll is admin-gated + idempotent per (worker, period) — re-running never pays twice.
//
// `commission` was added 2026-07-17. Without it this action could not settle the commission half of what
// Finance says we owe: the KPI accrues base + commission from staff_comp, but payroll could only record
// salary/gig/bonus — so "Payouts due" stayed at its gross accrual forever, no matter who got paid.
export async function runPayrollAction(
  staffId: string, period: string, salary: number, gig: number, bonus: number, commission = 0,
): Promise<PayrollResult> {
  if (!staffId) return { ok: false, error: 'Pick a worker.' };
  if (!/^\d{4}-\d{2}$/.test(period)) return { ok: false, error: 'Period must be YYYY-MM.' };
  if ([salary, gig, bonus, commission].some((n) => !Number.isFinite(n) || n < 0)) return { ok: false, error: 'Amounts must be 0 or more.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('run_payroll', { p_staff: staffId, p_period: period, p_salary: salary, p_gig: gig, p_bonus: bonus, p_commission: commission });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can run payroll.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/finance');
  return { ok: true };
}
