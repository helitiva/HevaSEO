'use client';
import { money } from '@/data/adminMock';
import type { PayoutStatus } from '@/lib/affiliate';
import type { AdminPayout } from '@/data/adminAffiliate';
import { PayoutBadge } from './shared';

export function PayoutsTab({ payouts, onAction }: {
  payouts: AdminPayout[];
  onAction: (id: string, next: PayoutStatus) => void;
}) {
  const awaiting = payouts.filter((p) => p.status === 'requested' || p.status === 'approved');
  const owed = awaiting.reduce((s, p) => s + p.amount, 0);
  const requestedCount = payouts.filter((p) => p.status === 'requested').length;
  const paidTotal = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  // Action-ordered: things needing a decision (requested → approved) float to the top,
  // settled rows (paid/rejected) sink. Within a status, newest first.
  const PRIORITY: Record<typeof payouts[number]['status'], number> = { requested: 0, approved: 1, paid: 2, rejected: 3 };
  const ordered = [...payouts].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || b.at.localeCompare(a.at));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <p className="text-xs text-muted-foreground">Owed (awaiting payment)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-600">{money(owed)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{requestedCount} new request{requestedCount === 1 ? '' : 's'} to review</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Paid out (lifetime)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(paidTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Requests in queue</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{awaiting.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Partner</th>
                <th className="px-3 py-2 font-semibold">Requested</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 transition hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{p.partner}</p>
                    <p className="text-xs text-muted-foreground">{p.handle}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.at}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(p.amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.method}</td>
                  <td className="px-3 py-2.5"><PayoutBadge status={p.status} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      {p.status === 'requested' && (
                        <>
                          <button type="button" onClick={() => onAction(p.id, 'approved')} className="rounded-lg bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-600 transition hover:bg-sky-500/20">Approve</button>
                          <button type="button" onClick={() => onAction(p.id, 'rejected')} className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/20">Reject</button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button type="button" onClick={() => onAction(p.id, 'paid')} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20">Mark paid</button>
                      )}
                      {(p.status === 'paid' || p.status === 'rejected') && <span className="text-[11px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
