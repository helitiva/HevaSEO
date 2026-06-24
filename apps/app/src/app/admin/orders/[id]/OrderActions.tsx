'use client';

import { useState } from 'react';
import type { OrderStatus } from '@/data/adminMock';

const NEXT: Record<OrderStatus, { label: string; primary?: boolean }[]> = {
  new: [{ label: 'Confirm', primary: true }, { label: 'Cancel' }],
  confirmed: [{ label: 'Assign staff', primary: true }, { label: 'Cancel' }],
  assigned: [{ label: 'Start work', primary: true }],
  in_progress: [{ label: 'Send to review', primary: true }],
  internal_review: [{ label: 'Deliver', primary: true }, { label: 'Kick back' }],
  delivered: [{ label: 'Approve', primary: true }, { label: 'Request changes' }],
  changes_requested: [{ label: 'Resume work', primary: true }],
  approved: [{ label: 'Mark completed', primary: true }],
  completed: [],
  canceled: [],
};

const OPS = [
  { icon: 'ph-user-gear', label: 'Assign / reassign staff' },
  { icon: 'ph-calendar-blank', label: 'Set deadline' },
  { icon: 'ph-flag', label: 'Set priority' },
  { icon: 'ph-coins', label: 'Adjust credit' },
  { icon: 'ph-arrow-u-down-left', label: 'Refund' },
  { icon: 'ph-note-pencil', label: 'Add internal note' },
  { icon: 'ph-paperclip', label: 'Attach file' },
  { icon: 'ph-x-circle', label: 'Cancel order', danger: true },
];

export function OrderActions({ status }: { status: OrderStatus }) {
  const [open, setOpen] = useState(false);
  const actions = NEXT[status] ?? [];
  const primary = actions.find((a) => a.primary);
  const others = actions.filter((a) => !a.primary);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary && <button className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">{primary.label}</button>}
      {others.map((a) => <button key={a.label} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-accent">{a.label}</button>)}
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:bg-accent" aria-label="More actions"><i className="ph-bold ph-dots-three-outline" /></button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {OPS.map((o) => (
                <button key={o.label} onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition hover:bg-muted ${o.danger ? 'text-destructive' : ''}`}>
                  <i className={`ph-bold ${o.icon} ${o.danger ? '' : 'text-muted-foreground'}`} /> {o.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
