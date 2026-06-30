'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/data/adminMock';
import { runPayrollAction } from '@/app/admin/finance/payroll.actions';
import type { PayrollRun } from '@/data/adminPayroll.server';
import type { WalletStaff } from '@/data/adminPenalties.server';

// Lane D inc-D7 — admin runs payroll: post a worker's fixed pay (salary+gig+bonus) for a period.
// Idempotent per (worker, period) — re-running the same period is a no-op (the DB fn returns the
// existing record), so it's safe to click twice.
const thisPeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const field = 'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export function AdminPayroll({ runs, staff }: { runs: PayrollRun[]; staff: WalletStaff[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [staffId, setStaffId] = useState(staff[0]?.profileId ?? '');
  const [period, setPeriod] = useState(thisPeriod());
  const [salary, setSalary] = useState('');
  const [gig, setGig] = useState('');
  const [bonus, setBonus] = useState('');

  const total = (Number(salary) || 0) + (Number(gig) || 0) + (Number(bonus) || 0);

  async function run() {
    setBusy(true); setErr('');
    const res = await runPayrollAction(staffId, period, Number(salary) || 0, Number(gig) || 0, Number(bonus) || 0);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setSalary(''); setGig(''); setBonus(''); router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-foreground/5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><i className="ph-bold ph-receipt text-primary" /> Payroll runs</h3>
      {err && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Worker
          <select className={field} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.length === 0 && <option value="">No workers with a wallet</option>}
            {staff.map((s) => <option key={s.profileId} value={s.profileId}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Period
          <input className={`${field} w-28`} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-06" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Salary ($)
          <input className={`${field} w-24`} type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="1300" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Gig ($)
          <input className={`${field} w-20`} type="number" min={0} value={gig} onChange={(e) => setGig(e.target.value)} placeholder="11" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Bonus ($)
          <input className={`${field} w-20`} type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
        </label>
        <button type="button" disabled={busy || !staffId || total <= 0} onClick={run}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">Run · {money(total)}</button>
      </div>

      {runs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Worker</th><th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 text-right font-medium">Salary</th><th className="px-3 py-2 text-right font-medium">Gig</th>
              <th className="px-3 py-2 text-right font-medium">Bonus</th><th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{r.staffName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.salary)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.gig)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(r.bonus)}</td>
                  <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Fixed pay (salary + gig + bonus) per period; commission is separate (the worker's wallet). Idempotent per worker + period.</p>
    </div>
  );
}
