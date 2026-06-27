'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { leaveStatusMeta } from '@/lib/leave';
import type { LeaveRequest, LeaveStatus } from '@/data/adminMock';

type Filter = 'pending' | 'all';
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function LeaveQueueClient({ initial }: { initial: LeaveRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [filter, setFilter] = useState<Filter>('pending');
  const [toast, setToast] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === 'pending').length;
  const shown = useMemo(
    () => (filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests),
    [requests, filter],
  );

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  function decide(id: string, status: LeaveStatus, name: string) {
    setRequests((xs) => xs.map((r) => (r.id === id ? { ...r, status } : r)));
    flash(status === 'approved'
      ? `${name}’s leave approved — marked unavailable for those days`
      : `${name}’s leave declined`);
  }

  return (
    <section>
      <PageHeader
        title="Leave requests"
        subtitle="Approve or decline staff time off. Approved days mark the staffer unavailable to the router."
        actions={<Link href="/admin/staff" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-arrow-left mr-1" aria-hidden />Staff roster</Link>}
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {(['pending', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 capitalize transition ${filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {f}{f === 'pending' && pending > 0 ? ` (${pending})` : ''}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500"><i className="ph-bold ph-check-circle text-2xl" aria-hidden /></span>
          <p className="display mt-2 text-lg font-bold">No pending requests</p>
          <p className="mt-1 text-sm text-muted-foreground">The team’s time off is all handled.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => {
            const meta = leaveStatusMeta(r.status);
            const h = hueOf(r.staffName);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Link href={`/admin/staff/${r.staffId}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }} title={`Open ${r.staffName}`}>{initials(r.staffName)}</Link>
                <div className="min-w-0">
                  <p className="font-semibold">{r.staffName} <span className="text-xs font-normal text-muted-foreground">· {r.role}</span></p>
                  <p className="text-sm text-muted-foreground"><i className="ph-bold ph-calendar-blank mr-1" aria-hidden />{r.from} → {r.to} · <b className="text-foreground">{r.days} day{r.days === 1 ? '' : 's'}</b></p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">requested {r.requestedAt}</span>
                  {r.status === 'pending' ? (
                    <>
                      <button onClick={() => decide(r.id, 'declined', r.staffName)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-destructive/50 hover:text-destructive">
                        <i className="ph-bold ph-x" aria-hidden /> Decline
                      </button>
                      <button onClick={() => decide(r.id, 'approved', r.staffName)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                        <i className="ph-bold ph-check" aria-hidden /> Approve
                      </button>
                    </>
                  ) : (
                    <span className={`pill ${meta.pill}`}>{meta.label}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toast && (
        <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">
          <i className="ph-bold ph-check-circle mr-1.5 text-emerald-500" aria-hidden />{toast}
        </div>
      )}
    </section>
  );
}
