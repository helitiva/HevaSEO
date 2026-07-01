'use client';
import { useMemo, useState } from 'react';
import { money } from '@/data/adminMock';
import type { TierId } from '@/lib/affiliate';
import { partnerUnclaimed, tierRowFor, type PartnerStatus, type EditableTier } from '@/data/adminAffiliate';
import { isTierOverridden, type AdminAffiliateWithTier } from '@/data/affiliateAdminStore';
import { StatusBadge } from './shared';
import { TierEditControl } from './TierEditControl';
import { PartnerHoverCard } from '../PartnerHoverCard';

type SortKey = 'name' | 'refs' | 'volume' | 'commission' | 'claimed' | 'unclaimed' | 'lastActiveAt';
const STATUS_FILTERS: (PartnerStatus | 'all')[] = ['all', 'active', 'pending', 'suspended'];

export function PartnersTab({ partners, tierRows, overrides, onToggle, onSelect, onSetTier }: {
  partners: AdminAffiliateWithTier[];
  tierRows: EditableTier[];
  overrides: Record<string, TierId>;
  onToggle: (id: string, next: PartnerStatus) => void;
  onSelect: (id: string) => void;
  onSetTier?: (id: string, tier: TierId | null) => void;
}) {
  const [status, setStatus] = useState<PartnerStatus | 'all'>('all');
  const [tier, setTier] = useState<TierId | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('volume');
  const [dir, setDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const enriched = partners.map((p) => {
      // Effective tier (override wins over volume) with the rate from the admin-edited rows.
      const tierId = p.effectiveTier;
      const rate = tierRows.find((t) => t.id === tierId)?.rate ?? tierRowFor(tierRows, p.volume).rate;
      return { ...p, tierId, rate, overridden: isTierOverridden(p.id, overrides), unclaimed: partnerUnclaimed(p) };
    });
    const filtered = enriched.filter((p) =>
      (status === 'all' || p.status === status) &&
      (tier === 'all' || p.tierId === tier) &&
      (!q || `${p.name} ${p.handle} ${p.code}`.toLowerCase().includes(q.toLowerCase())));
    return filtered.sort((a, b) => {
      const va = a[sort]; const vb = b[sort];
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return cmp * dir;
    });
  }, [partners, tierRows, overrides, status, tier, q, sort, dir]);

  const toggleSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(k === 'name' ? 1 : -1); }
  };
  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>
      <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${right ? 'flex-row-reverse' : ''}`}>
        {children}{sort === k && <i className={`ph-bold text-[10px] ${dir === 1 ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1 capitalize transition ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
          ))}
        </div>
        <select value={tier} onChange={(e) => setTier(e.target.value as TierId | 'all')}
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold outline-none">
          <option value="all">All tiers</option>
          <option value="bronze">Bronze</option><option value="silver">Silver</option>
          <option value="gold">Gold</option><option value="platinum">Platinum</option>
        </select>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm">
          <i className="ph-bold ph-magnifying-glass text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search partner / code…" className="w-44 bg-transparent text-xs outline-none" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{rows.length} partner{rows.length === 1 ? '' : 's'}</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <Th k="name">Partner</Th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <Th k="refs" right>Refs</Th>
                <Th k="volume" right>Volume</Th>
                <Th k="commission" right>Commission</Th>
                <Th k="claimed" right>Claimed</Th>
                <Th k="unclaimed" right>Unclaimed</Th>
                <Th k="lastActiveAt" right>Last active</Th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${p.name}`}
                  className="cursor-pointer border-b border-border/60 outline-none transition last:border-0 hover:bg-muted/30 focus-visible:bg-muted/50"
                >
                  <td className="px-3 py-2.5">
                    <PartnerHoverCard affiliateId={p.id} className="group items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">{p.avatarInitials}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:text-primary">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.handle} · {p.platform}</span>
                      </span>
                    </PartnerHoverCard>
                  </td>
                  <td className="px-3 py-2.5">{p.status === 'pending' ? <span className="text-xs text-muted-foreground">—</span> : <TierEditControl partnerId={p.id} tier={p.tierId} rate={p.rate} overridden={p.overridden} onSetTier={onSetTier} />}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.refs}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(p.volume)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(p.commission)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{money(p.claimed)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-amber-600">{money(p.unclaimed)}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{p.lastActiveAt}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {p.status === 'pending' ? (
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => onToggle(p.id, 'active')} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20">Approve</button>
                        <button type="button" onClick={() => onToggle(p.id, 'suspended')} className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/20">Reject</button>
                      </div>
                    ) : p.status === 'active' ? (
                      <button type="button" onClick={() => onToggle(p.id, 'suspended')} className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-rose-600">Suspend</button>
                    ) : (
                      <button type="button" onClick={() => onToggle(p.id, 'active')} className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-emerald-600">Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">No partners match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
