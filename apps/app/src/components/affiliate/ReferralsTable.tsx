'use client';
import { useState } from 'react';
import { money } from '@/data/adminMock';
import { tierFor, type Referral } from '@/lib/affiliate';

type SortKey = 'customer' | 'joinedAt' | 'orders' | 'volume' | 'commission';

// Each referral's commission shown here is what THIS affiliate earned from that
// customer's orders, at the affiliate's current tier rate (own earnings only).
export function ReferralsTable({
  referrals, lifetimeVolume, limit, compact = false,
}: { referrals: Referral[]; lifetimeVolume: number; limit?: number; compact?: boolean }) {
  const rate = tierFor(lifetimeVolume).rate;
  const [sort, setSort] = useState<SortKey>('volume');
  const [dir, setDir] = useState<1 | -1>(-1);

  const withCommission = referrals.map((r) => ({ ...r, commission: Math.round(r.volume * rate) }));
  const sorted = [...withCommission].sort((a, b) => {
    const va = a[sort]; const vb = b[sort];
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return cmp * dir;
  });
  const rows = limit ? sorted.slice(0, limit) : sorted;

  const toggle = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(k === 'customer' ? 1 : -1); }
  };

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 font-semibold ${className}`}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sort === k && <i className={`ph-bold text-[10px] ${dir === 1 ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />}
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <Th k="customer">Customer</Th>
              {!compact && <Th k="joinedAt">Joined</Th>}
              <Th k="orders" className="text-right"><span className="block text-right">Orders</span></Th>
              <Th k="volume" className="text-right"><span className="block text-right">Volume</span></Th>
              <Th k="commission" className="text-right"><span className="block text-right">Your commission</span></Th>
              {!compact && <th className="px-3 py-2 text-right font-semibold">Status</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 transition hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                      {r.customer.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium">{r.customer}</span>
                  </div>
                </td>
                {!compact && <td className="px-3 py-2.5 text-muted-foreground">{r.joinedAt}</td>}
                <td className="px-3 py-2.5 text-right tabular-nums">{r.orders}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(r.volume)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-600">{money(r.commission)}</td>
                {!compact && (
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      {r.status}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
