'use client';
import { useEffect, useState } from 'react';
import type { PartnerStatus } from '@/data/adminAffiliate';
import type { TierId, PayoutStatus } from '@/lib/affiliate';

// localStorage-backed in-session admin actions (suspend, approve, mark-paid, rule
// edits) — same pattern as the finance surface. No backend yet; SSR-safe.
const LS_PREFIX = 'heva.affadmin.';
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch { /* ignore corrupt/unavailable storage */ }
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(state)); } catch { /* ignore quota */ }
  }, [key, state, hydrated]);
  return [state, setState] as const;
}

export function Kpi({ icon, label, value, hint, tone, delta }: {
  icon: string; label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad'; delta?: number | null;
}) {
  const toneCls = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-rose-600' : '';
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <i className={`ph-bold ${icon} text-primary`} aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-bold tracking-tight ${toneCls}`}>{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta != null && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            <i className={`ph-bold ${delta > 0 ? 'ph-trend-up' : 'ph-trend-down'}`} aria-hidden />{delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

const STATUS_META: Record<PartnerStatus, { label: string; cls: string; dot: string }> = {
  active:    { label: 'Active',    cls: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
  pending:   { label: 'Pending',   cls: 'bg-amber-500/10 text-amber-600',     dot: 'bg-amber-500' },
  suspended: { label: 'Suspended', cls: 'bg-rose-500/10 text-rose-600',       dot: 'bg-rose-500' },
};

export function StatusBadge({ status }: { status: PartnerStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

const TIER_META: Record<TierId, string> = {
  bronze:   'bg-amber-500/10 text-amber-700 dark:text-amber-500',
  silver:   'bg-slate-400/15 text-slate-600 dark:text-slate-300',
  gold:     'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500',
  platinum: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

export function TierBadge({ tier, rate }: { tier: TierId; rate: number }) {
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${TIER_META[tier]}`}>
      <i className="ph-fill ph-crown-simple text-[10px]" /> {label} · {Math.round(rate * 100)}%
    </span>
  );
}

const PAYOUT_META: Record<PayoutStatus, { label: string; cls: string }> = {
  requested: { label: 'Requested', cls: 'bg-amber-500/10 text-amber-600' },
  approved:  { label: 'Approved',  cls: 'bg-sky-500/10 text-sky-600' },
  paid:      { label: 'Paid',      cls: 'bg-emerald-500/10 text-emerald-600' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-500/10 text-rose-600' },
};

export function PayoutBadge({ status }: { status: PayoutStatus }) {
  const m = PAYOUT_META[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}
