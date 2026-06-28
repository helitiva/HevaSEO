'use client';
import { useState } from 'react';
import { money } from '@/data/adminMock';
import type { CommissionEvent, PayoutRequest } from '@/lib/affiliate';

const EVENT_BADGE: Record<CommissionEvent['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  cleared: 'bg-sky-500/10 text-sky-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
};
const PAYOUT_BADGE: Record<PayoutRequest['status'], string> = {
  requested: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-sky-500/10 text-sky-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-rose-500/10 text-rose-600',
};

export function CommissionLedger({
  events, payouts, payoutLabel, compact = false,
}: { events: CommissionEvent[]; payouts: PayoutRequest[]; payoutLabel: string; compact?: boolean }) {
  // Balances are derived from event status: pending = not yet clearable;
  // cleared = available to withdraw; paid = already withdrawn.
  const available = events.filter((e) => e.status === 'cleared').reduce((s, e) => s + e.amount, 0);
  const pending = events.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const lifetimePaid = events.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amount, 0);

  const [requested, setRequested] = useState(false);
  const eventRows = compact ? events.slice(0, 5) : events;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-wallet text-primary" /> Commission & payouts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Your earnings — withdraw cleared balance to {payoutLabel}</p>
        </div>
        <button
          type="button" disabled={available === 0 || requested} onClick={() => setRequested(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <i className={`ph-bold ${requested ? 'ph-check' : 'ph-arrow-line-down'}`} />
          {requested ? 'Payout requested' : `Request payout · ${money(available)}`}
        </button>
      </div>

      {/* balances */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Available</p>
          <p className="text-lg font-bold tabular-nums text-emerald-600">{money(available)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Pending</p>
          <p className="text-lg font-bold tabular-nums text-amber-600">{money(pending)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Paid out</p>
          <p className="text-lg font-bold tabular-nums">{money(lifetimePaid)}</p>
        </div>
      </div>

      {/* commission events */}
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent commission</p>
      <div className="space-y-1.5">
        {eventRows.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.customer} <span className="font-normal text-muted-foreground">· {e.orderCode}</span></p>
              <p className="text-xs text-muted-foreground">{e.at} · {money(e.orderValue)} order · {Math.round(e.rate * 100)}%</p>
            </div>
            <span className="font-semibold tabular-nums text-emerald-600">+{money(e.amount)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${EVENT_BADGE[e.status]}`}>{e.status}</span>
          </div>
        ))}
      </div>

      {/* payout history */}
      {!compact && (
        <>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payout history</p>
          <div className="space-y-1.5">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <i className="ph-bold ph-arrow-line-down text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{money(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{p.at} · {p.method}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PAYOUT_BADGE[p.status]}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
