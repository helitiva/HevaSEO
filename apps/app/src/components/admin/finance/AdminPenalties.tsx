'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/data/adminMock';
import { applyPenaltyAction, waivePenaltyAction } from '@/app/admin/finance/penalty.actions';
import type { AdminPenalty, WalletStaff } from '@/data/adminPenalties.server';

// Lane D inc-D5 — admin applies a penalty (debits the worker's wallet) or waives one (refunds it).
const PILL: Record<AdminPenalty['status'], string> = {
  applied: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  disputed: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  waived: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};
const TYPES = ['revision', 'late', 'rating', 'manual'] as const;
const field = 'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export function AdminPenalties({ penalties, staff }: { penalties: AdminPenalty[]; staff: WalletStaff[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [staffId, setStaffId] = useState(staff[0]?.profileId ?? '');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<string>('manual');
  const [detail, setDetail] = useState('');

  async function apply() {
    setBusy(true); setErr('');
    const res = await applyPenaltyAction(staffId, Number(amount), type, detail);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setAmount(''); setDetail(''); router.refresh();
  }
  async function waive(id: string) {
    setBusy(true); setErr('');
    const res = await waivePenaltyAction(id);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-foreground/5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><i className="ph-bold ph-warning-octagon text-primary" /> Penalties</h3>
      {err && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      {/* apply form */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Staff
          <select className={field} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.length === 0 && <option value="">No staff with a wallet</option>}
            {staff.map((s) => <option key={s.profileId} value={s.profileId}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Type
          <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Amount ($)
          <input className={`${field} w-24`} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">Reason
          <input className={field} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Late delivery on KW-1013" />
        </label>
        <button type="button" disabled={busy || !staffId || !amount} onClick={apply}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">Apply</button>
      </div>

      {/* list */}
      {penalties.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Staff</th><th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Reason</th><th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th><th className="py-2 pl-3 text-right font-medium">Action</th>
            </tr></thead>
            <tbody>
              {penalties.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{p.staffName}</td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{p.type}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.detail ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-rose-500">−{money(p.amount)}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PILL[p.status]}`}>{p.status}</span></td>
                  <td className="py-2.5 pl-3 text-right">
                    {p.status !== 'waived'
                      ? <button type="button" disabled={busy} onClick={() => waive(p.id)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent disabled:opacity-50">Waive (refund)</button>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Applying debits the worker's wallet immediately; waiving refunds it. Workers can dispute from their finance page.</p>
    </div>
  );
}
