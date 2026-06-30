import 'server-only';
import { createClient } from '@/lib/supabase/server';

// Lane D inc-D7 — admin view of payroll runs (fixed pay posted per worker per period). Admin RLS sees
// the tenant; workers see their own. Created via runPayrollAction (run_payroll).
export type PayrollRun = {
  id: string;
  staffName: string;
  period: string;
  salary: number;
  gig: number;
  bonus: number;
  total: number;
  createdAt: string;
};

const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

export async function getPayrollRuns(): Promise<PayrollRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('id, period, salary, gig, bonus, total, created_at, profiles:staff_id(name)')
    .order('created_at', { ascending: false })
    .returns<{ id: string; period: string; salary: number | string; gig: number | string; bonus: number | string; total: number | string; created_at: string; profiles: { name: string } | null }[]>();
  if (error) throw new Error(`getPayrollRuns: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, staffName: r.profiles?.name ?? 'Staff', period: r.period,
    salary: Number(r.salary), gig: Number(r.gig), bonus: Number(r.bonus), total: Number(r.total),
    createdAt: ymd(r.created_at),
  }));
}
