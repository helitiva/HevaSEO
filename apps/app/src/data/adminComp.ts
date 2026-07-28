/**
 * Payroll accrual math — the pure brain of "what do we owe each worker this period", split from the I/O
 * in adminComp.server.ts on the convention this codebase uses (adminRevenue.ts / adminRevenue.server.ts).
 * Kept pure so it can be unit-tested: this is the computation that decides real pay, and it had no test.
 *
 * Commission sits on the same ASC 606 basis as the revenue book: an order contributes on the day it was
 * DELIVERED (orders.delivered_at), never when it was merely placed — so we never pay commission on
 * revenue we haven't earned. Who earns what:
 *   · staff   → orders where they were the assignee
 *   · manager → orders delivered by their pod (they're paid on what they oversaw)
 *
 * pay = base_salary + commission(basis × pct). Penalties/bonus/gig remain their own ledgers.
 */

export const RECOGNIZED = ['delivered', 'approved', 'completed'];

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
  /** what this period ACCRUED for this person: base + commission */
  total: number;
  /** what payroll_runs says has already been paid for this period (0 = payroll not run yet) */
  paid: number;
  /** accrued − paid. This, not `total`, is what we still owe. */
  outstanding: number;
  configured: boolean;
}
export interface PayrollPreview {
  period: string;              // YYYY-MM
  lines: CompLine[];
  /**
   * `total` is what the period accrued; `outstanding` is what's still owed after payroll_runs.
   * Finance's "Payouts due" must read `outstanding` — reading `total` is why that KPI never moved: it
   * recomputed the gross accrual on every load and subtracted nothing, so paying everyone changed
   * nothing on screen.
   */
  totals: { base: number; commission: number; total: number; basis: number; paid: number; outstanding: number };
}

export type OrderRow = { value: number | string; state: string; delivered_at: string | null; assignee_id: string | null };
export type ProfileRow = { id: string; name: string | null; role: string };
export type CompRow = { profile_id: string; base_salary: number | string; commission_pct: number | string };
export type PodRow = { profile_id: string; manager_id: string | null };
export type RunRow = { staff_id: string; total: number | string };

const num = (v: number | string | null): number => Number(v) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Build the payroll preview from already-fetched rows. Pure: no I/O, no clock — `period` ('YYYY-MM') is
 * passed in so the "earned in this period" filter is deterministic and testable.
 */
export function computePayrollPreview(
  period: string,
  orders: OrderRow[],
  profiles: ProfileRow[],
  comps: CompRow[],
  pods: PodRow[],
  runs: RunRow[],
): PayrollPreview {
  const paidBy = new Map<string, number>();
  for (const r of runs) paidBy.set(r.staff_id, (paidBy.get(r.staff_id) ?? 0) + num(r.total));

  // only work actually earned in this period counts toward commission (delivered, recognized, this month)
  const earned = orders.filter(
    (o) => o.delivered_at && RECOGNIZED.includes(o.state) && o.delivered_at.slice(0, 7) === period,
  );
  const comp = new Map(comps.map((c) => [c.profile_id, c]));
  const managerOf = new Map(pods.map((r) => [r.profile_id, r.manager_id]));

  const lines: CompLine[] = profiles.map((prof) => {
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
      paid: round2(paidBy.get(prof.id) ?? 0),
      // never negative: an over-payment (a manual run bigger than the accrual) is a thing to notice, not
      // a credit that quietly cancels someone else's outstanding pay in the total.
      outstanding: Math.max(0, round2(baseSalary + commission - (paidBy.get(prof.id) ?? 0))),
      configured: !!c,
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    period,
    lines,
    totals: {
      base: round2(lines.reduce((s, l) => s + l.baseSalary, 0)),
      commission: round2(lines.reduce((s, l) => s + l.commission, 0)),
      total: round2(lines.reduce((s, l) => s + l.total, 0)),
      // basis totals only STAFF — a manager's basis is the same pod orders, so summing both double-counts
      basis: round2(lines.filter((l) => l.role === 'staff').reduce((s, l) => s + l.basis, 0)),
      paid: round2(lines.reduce((s, l) => s + l.paid, 0)),
      outstanding: round2(lines.reduce((s, l) => s + l.outstanding, 0)),
    },
  };
}
