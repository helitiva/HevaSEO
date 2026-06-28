'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TriageItem, TriageKind } from '@/lib/managerPulse';

// The pod's "Needs you" action queue. Server computes + sorts the items; this
// client shell adds kind filtering and a diversity cap so one busy category
// (e.g. four SLA tickets) can't crowd everything else out of the visible rows.

const TONE_TEXT = { bad: 'text-red-600', warn: 'text-amber-600', good: 'text-emerald-600', info: 'text-primary' } as const;
const TONE_ACCENT = { bad: '#ef4444', warn: '#f59e0b', good: '#10b981', info: 'hsl(var(--primary))' } as const;

const KIND_META: Record<TriageKind, { label: string; href: string }> = {
  overdue: { label: 'Overdue', href: '/manager/orders' },
  sla: { label: 'Tickets', href: '/manager/tickets' },
  review: { label: 'Reviews', href: '/manager/review' },
  changes: { label: 'Changes', href: '/manager/review' },
  assign: { label: 'Route', href: '/manager/assignment' },
};
const KIND_ORDER: TriageKind[] = ['overdue', 'sla', 'review', 'changes', 'assign'];

const VISIBLE = 7;       // rows shown before collapsing into "+N more"
const PER_KIND_CAP = 3;  // max rows of a single kind in the unfiltered view

/** Take up to `limit` items, no more than `cap` of any one kind, weight order preserved. */
function pickDiverse(items: TriageItem[], limit: number, cap: number): TriageItem[] {
  const counts: Partial<Record<TriageKind, number>> = {};
  const out: TriageItem[] = [];
  for (const it of items) {
    if (out.length >= limit) break;
    const c = counts[it.kind] ?? 0;
    if (c >= cap) continue;
    counts[it.kind] = c + 1;
    out.push(it);
  }
  // Few kinds present? Top up with whatever remains so we don't leave gaps.
  if (out.length < limit) {
    for (const it of items) {
      if (out.length >= limit) break;
      if (!out.includes(it)) out.push(it);
    }
  }
  return out;
}

export function TriageQueue({ items }: { items: TriageItem[] }) {
  const [filter, setFilter] = useState<TriageKind | 'all'>('all');

  const counts = items.reduce<Partial<Record<TriageKind, number>>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] ?? 0) + 1;
    return acc;
  }, {});
  const presentKinds = KIND_ORDER.filter((k) => counts[k]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const visible = filter === 'all' ? pickDiverse(filtered, VISIBLE, PER_KIND_CAP) : filtered.slice(0, 8);
  const hidden = filtered.length - visible.length;
  const moreHref = filter === 'all' ? '/manager/assignment' : KIND_META[filter].href;
  const toRoute = counts.assign ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <i className="ph-bold ph-list-checks text-primary" aria-hidden />Needs you
          {items.length > 0 && <span className="pill pill-warn">{items.length}</span>}
        </h2>
        <span className="text-xs text-muted-foreground">Sorted by urgency</span>
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center gap-1 py-10 text-center">
          <i className="ph-bold ph-confetti text-3xl text-emerald-500" aria-hidden />
          <p className="text-sm font-medium">All clear — nothing needs you right now.</p>
          <p className="text-xs text-muted-foreground">Reviews done, no overdue work, SLAs healthy.</p>
        </div>
      ) : (
        <>
          {presentKinds.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter queue by type">
              <Chip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={items.length} />
              {presentKinds.map((k) => (
                <Chip key={k} active={filter === k} onClick={() => setFilter(k)} label={KIND_META[k].label} count={counts[k] ?? 0} />
              ))}
            </div>
          )}
          <ul className="space-y-1.5">
            {visible.map((t) => <TriageRow key={t.id} item={t} />)}
          </ul>
          {hidden > 0 && (
            <Link href={moreHref} className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
              +{hidden} more{filter === 'all' && toRoute > 0 ? ` · ${toRoute} to route` : ''} <i className="ph-bold ph-arrow-right" aria-hidden />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button" role="tab" aria-selected={active} onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
    >
      {label}<span className={active ? 'opacity-80' : 'opacity-60'}> {count}</span>
    </button>
  );
}

function TriageRow({ item }: { item: TriageItem }) {
  return (
    <li>
      <Link href={item.href} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 transition hover:border-primary/50" style={{ borderLeft: `3px solid ${TONE_ACCENT[item.tone]}` }}>
        <i className={`ph-bold ${item.icon} text-lg ${TONE_TEXT[item.tone]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{item.subtitle}</span>
        </span>
        <span className={`shrink-0 text-[11px] font-semibold ${TONE_TEXT[item.tone]}`}>{item.meta}</span>
        <i className="ph-bold ph-caret-right shrink-0 text-xs text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
