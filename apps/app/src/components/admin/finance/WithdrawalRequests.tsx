'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/data/adminMock';
import { resolvePayoutAction } from '@/app/admin/finance/payout.actions';
import type { AdminPayoutRequest } from '@/data/adminPayouts.server';

// Lane D inc-D4 — real staff withdrawal requests (payout_requests). Admin approves / pays / rejects;
// reject refunds the staffer's wallet (resolve_payout). Sits above the mock payroll table.
const PILL: Record<AdminPayoutRequest['status'], string> = {
  requested: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  approved: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

export function WithdrawalRequests({ requests }: { requests: AdminPayoutRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const open = requests.filter((r) => r.status === 'requested' || r.status === 'approved').length;

  async function act(id: string, action: 'approve' | 'pay' | 'reject') {
    setBusy(`${id}:${action}`);
    setErr('');
    const res = await resolvePayoutAction(id, action);
    setBusy(null);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm shadow-foreground/5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><i className="ph-bold ph-hand-coins text-primary" /> Withdrawal requests</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{open} open</span>
      </div>
      {err && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      {requests.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No staff withdrawal requests yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Requested</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const actionable = r.status === 'requested' || r.status === 'approved';
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-foreground">{r.staffName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.method ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(r.amount)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.requestedAt}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PILL[r.status]}`}>{r.status}</span></td>
                    <td className="py-2.5 pl-3">
                      {actionable ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'requested' && (
                            <button type="button" disabled={!!busy} onClick={() => act(r.id, 'approve')}
                              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-accent disabled:opacity-50">Approve</button>
                          )}
                          <button type="button" disabled={!!busy} onClick={() => act(r.id, 'pay')}
                            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">Mark paid</button>
                          <button type="button" disabled={!!busy} onClick={() => act(r.id, 'reject')}
                            className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">Reject</button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Rejecting refunds the amount to the staffer's wallet. (Payroll runs below are still the mock period view.)</p>
    </div>
  );
}
