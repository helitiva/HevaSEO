import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Payroll computed from REAL work, admin-side (RLS: admin sees the whole tenant).
 *
 * Commission sits on the same ASC 606 basis as the revenue book: an order contributes on the day it was
 * DELIVERED (orders.delivered_at), never when it was merely placed — so we never pay commission on revenue
 * we haven't earned. Who earns what:
 *   · staff   → orders where they were the assignee
 *   · manager → orders delivered by their pod (they're paid on what they oversaw)
 *
 * pay = base_salary + commission(basis × pct). Penalties/bonus/gig remain their own ledgers.
 */

const RECOGNIZED = ['delivered', 'approved', 'completed'];

export interface CompLine {
  profileId: string;
  name: string;
  role: 'staff' | 'manager';
  baseSalary: number;
  commissionPct: number;
  /** recognized order value this person earned in the period */
  basis: number;
  commission: number;
  orders: number;
  total: number;
  configured: boolean;
}
export interface PayrollPreview {
  period: string;              // YYYY-MM
  lines: CompLine[];
  totals: { base: number; commission: number; total: number; basis: number };
}

type OrderRow = { value: number | string; state: string; delivered_at: string | null; assignee_id: string | null };
type ProfileRow = { id: string; name: string | null; role: string };
type CompRow = { profile_id: string; base_salary: number | string; commission_pct: number | string };
type PodRow = { profile_id: string; manager_id: string | null };

const num = (v: number | string | null): number => Number(v) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** period: 'YYYY-MM' (defaults to the current month). */
export async function getPayrollPreview(period?: string): Promise<PayrollPreview> {
  const supabase = await createClient();
  const p = period ?? new Date().toISOString().slice(0, 7);

  const [ordersRes, profRes, compRes, podRes] = await Promise.all([
    supabase.from('orders').select('value, state, delivered_at, assignee_id').returns<OrderRow[]>(),
    supabase.from('profiles').select('id, name, role').in('role', ['staff', 'manager']).returns<ProfileRow[]>(),
    supabase.from('staff_comp').select('profile_id, base_salary, commission_pct').returns<CompRow[]>(),
    supabase.from('staff_details').select('profile_id, manager_id').returns<PodRow[]>(),
  ]);
  // Surface every read failure. Swallowing the comp read is how a missing GRANT silently rendered every
  // salary as "not set" instead of erroring.
  if (ordersRes.error) throw new Error(`getPayrollPreview orders: ${ordersRes.error.message}`);
  if (profRes.error) throw new Error(`getPayrollPreview profiles: ${profRes.error.message}`);
  if (compRes.error) throw new Error(`getPayrollPreview staff_comp: ${compRes.error.message}`);
  if (podRes.error) throw new Error(`getPayrollPreview staff_details: ${podRes.error.message}`);

  // only work actually earned in this period counts toward commission
  const earned = (ordersRes.data ?? []).filter(
    (o) => o.delivered_at && RECOGNIZED.includes(o.state) && o.delivered_at.slice(0, 7) === p,
  );
  const comp = new Map((compRes.data ?? []).map((c) => [c.profile_id, c]));
  const managerOf = new Map((podRes.data ?? []).map((r) => [r.profile_id, r.manager_id]));

  const lines: CompLine[] = (profRes.data ?? []).map((prof) => {
    const mine = prof.role === 'manager'
      ? earned.filter((o) => o.assignee_id && managerOf.get(o.assignee_id) === prof.id)
      : earned.filter((o) => o.assignee_id === prof.id);
    const basis = round2(mine.reduce((s, o) => s + num(o.value), 0));
    const c = comp.get(prof.id);
    const baseSalary = num(c?.base_salary ?? 0);
    const commissionPct = num(c?.commission_pct ?? 0);
    const commission = round2((basis * commissionPct) / 100);
    return {
      profileId: prof.id,
      name: prof.name ?? '—',
      role: prof.role as 'staff' | 'manager',
      baseSalary, commissionPct, basis, commission,
      orders: mine.length,
      total: round2(baseSalary + commission),
      configured: !!c,
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    period: p,
    lines,
    totals: {
      base: round2(lines.reduce((s, l) => s + l.baseSalary, 0)),
      commission: round2(lines.reduce((s, l) => s + l.commission, 0)),
      total: round2(lines.reduce((s, l) => s + l.total, 0)),
      basis: round2(lines.filter((l) => l.role === 'staff').reduce((s, l) => s + l.basis, 0)),
    },
  };
}
