'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { OrderDetailClient } from '@/app/admin/orders/[id]/OrderDetailClient';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { money, type AdminOrder } from '@/data/adminMock';

type Tone = 'warn' | 'primary';

interface Column {
  title: string;
  href: string;
  rows: AdminOrder[];
  tone: Tone;
}

export function NeedsAttention({ overdue, awaiting, unassigned }: {
  overdue: AdminOrder[];
  awaiting: AdminOrder[];
  unassigned: AdminOrder[];
}) {
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const selectedProps = selected ? buildOrderDetailProps(selected.id) : null;

  const columns: Column[] = [
    { title: 'Overdue',           href: '/admin/orders',     rows: overdue,    tone: 'warn' },
    { title: 'Awaiting approval', href: '/admin/review',     rows: awaiting,   tone: 'primary' },
    { title: 'Unassigned',        href: '/admin/assignment', rows: unassigned, tone: 'warn' },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {col.title} <span className={col.tone === 'warn' ? 'text-amber-500' : 'text-primary'}>{col.rows.length}</span>
              </p>
              <Link href={col.href} className="text-[11px] font-semibold text-primary hover:underline">All</Link>
            </div>
            <ul className="space-y-1.5">
              {col.rows.map((o) => (
                <li key={o.id}>
                  <AttentionCard order={o} overdue={!!o.deadline && o.deadline < today} onOpen={() => setSelected(o)} />
                </li>
              ))}
              {col.rows.length === 0 && (
                <li className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-muted-foreground">All clear</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <SlideOver open={selected !== null} onClose={() => setSelected(null)} title={selected?.code ?? 'Order'} widthClass="max-w-5xl">
        {selectedProps && <OrderDetailClient key={selectedProps.order.id} {...selectedProps} />}
      </SlideOver>
    </>
  );
}

function AttentionCard({ order: o, overdue, onOpen }: { order: AdminOrder; overdue: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Preview order ${o.code} — ${o.customer}`}
      className="group block w-full rounded-lg border border-border/70 bg-background/40 px-2.5 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[13px] font-semibold">
          {o.code}
          <i className="ph-bold ph-arrow-right -translate-x-1 text-[11px] text-primary opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </span>
        <PriorityBadge priority={o.priority} />
      </div>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground"><CustomerHoverCard customer={o.customer}><span className="hover:underline">{o.customer}</span></CustomerHoverCard> · {money(o.value)}</p>
      <p className="truncate text-[11px] text-muted-foreground">{o.service} · {o.pkg}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        <StatusBadge status={o.status} />
        {o.staff ? (
          <StaffHoverCard staff={o.staff} className="items-center gap-1">
            <span className="flex items-center gap-1 underline-offset-2 hover:underline"><i className="ph-bold ph-user" aria-hidden />{o.staff}</span>
          </StaffHoverCard>
        ) : (
          <span className="flex items-center gap-1"><i className="ph-bold ph-user-minus" aria-hidden />Unassigned</span>
        )}
        {o.deadline && (
          <span className={`flex items-center gap-1 ${overdue ? 'font-semibold text-amber-500' : ''}`}>
            <i className="ph-bold ph-calendar-blank" aria-hidden />
            {o.deadline}{overdue ? ' · overdue' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

