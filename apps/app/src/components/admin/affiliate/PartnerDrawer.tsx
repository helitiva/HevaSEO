'use client';
import { money } from '@/data/adminMock';
import { buildAffiliateUrl } from '@/lib/affiliate';
import { impersonateAffiliate } from '@/lib/impersonation';
import { partnerUnclaimed, tierStateFromRows, partnerVolumeSeries, type AdminAffiliate, type PartnerStatus, type AdminPayout, type EditableTier } from '@/data/adminAffiliate';
import { SlideOver } from '@/components/shared/SlideOver';
import { CopyButton } from '@/components/affiliate/CopyButton';
import { StatusBadge, TierBadge, PayoutBadge } from './shared';
import { PartnerVolumeChart } from './PartnerVolumeChart';
import { ReferredServiceMix } from './ReferredServiceMix';

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-border bg-background p-3">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={`mt-0.5 text-base font-bold tabular-nums ${tone ?? ''}`}>{value}</p>
  </div>
);

export function PartnerDrawer({ partner, payouts, tierRows, onToggle, onClose }: {
  partner: AdminAffiliate | null;
  payouts: AdminPayout[];
  tierRows: EditableTier[];
  onToggle: (id: string, next: PartnerStatus) => void;
  onClose: () => void;
}) {
  if (!partner) return null;
  const p = partner;
  const isPending = p.status === 'pending';
  const { current: tier, next, pct, remaining } = tierStateFromRows(tierRows, p.volume);
  const unclaimed = partnerUnclaimed(p);
  const mine = payouts.filter((x) => x.affiliateId === p.id);

  return (
    <SlideOver open={!!partner} onClose={onClose} title={p.name} widthClass="max-w-lg">
      {/* identity */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">{p.avatarInitials}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.handle} · {p.platform}</p>
          <p className="truncate text-xs text-muted-foreground">{p.niche} · {p.email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        {!isPending && <TierBadge tier={tier.id} rate={tier.rate} />}
        <span className="text-[11px] text-muted-foreground">joined {p.joinedAt} · active {p.lastActiveAt}</span>
      </div>

      {/* affiliate link + open-as-them (impersonate) */}
      {!isPending && (
        <div className="mt-4 rounded-xl border border-border bg-background p-3">
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <i className="ph-bold ph-link text-primary" aria-hidden />
              <span className="truncate font-mono text-xs">{buildAffiliateUrl(p.code)}</span>
            </div>
            <CopyButton value={buildAffiliateUrl(p.code)} label="Copy" iconOnly />
          </div>
          <button
            type="button" onClick={() => impersonateAffiliate(p.id)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <i className="ph-bold ph-user-switch" aria-hidden /> Open dashboard as {p.name.split(' ')[0]}
          </button>
        </div>
      )}

      {/* stats */}
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <Stat label="Referrals" value={String(p.refs)} />
        <Stat label="Volume" value={money(p.volume)} />
        <Stat label="Commission" value={money(p.commission)} />
        <Stat label="Claimed" value={money(p.claimed)} tone="text-muted-foreground" />
        <Stat label="Unclaimed" value={money(unclaimed)} tone="text-amber-600" />
        <Stat label="Net to us" value={money(p.volume - p.commission)} tone="text-emerald-600" />
      </div>

      {/* tier progress (admin-neutral) */}
      {!isPending && (
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold">{tier.label} · {Math.round(tier.rate * 100)}%</span>
            {next ? <span className="text-muted-foreground">{money(remaining)} to {next.label}</span> : <span className="text-muted-foreground">top tier</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* volume trend (1M / 3M / 6M / 1Y) */}
      {!isPending && p.volume > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-background p-3">
          <PartnerVolumeChart series={partnerVolumeSeries(p)} heightClass="h-20" />
        </div>
      )}

      {/* what the customers they referred order */}
      {!isPending && (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referred customers order</p>
          <ReferredServiceMix affiliateId={p.id} limit={6} emptyHint="No referred customer orders yet." />
        </>
      )}

      {/* payout history */}
      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payouts</p>
      {mine.length === 0 ? (
        <p className="rounded-lg border border-border/60 px-3 py-3 text-sm text-muted-foreground">No payout requests yet.</p>
      ) : (
        <div className="space-y-1.5">
          {mine.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <i className="ph-bold ph-arrow-line-down text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">{money(x.amount)}</p>
                <p className="text-xs text-muted-foreground">{x.at} · {x.method}</p>
              </div>
              <PayoutBadge status={x.status} />
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="mt-6 flex gap-2 border-t border-border pt-4">
        {isPending ? (
          <>
            <button type="button" onClick={() => { onToggle(p.id, 'active'); onClose(); }} className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/20">Approve partner</button>
            <button type="button" onClick={() => { onToggle(p.id, 'suspended'); onClose(); }} className="flex-1 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/20">Reject</button>
          </>
        ) : p.status === 'active' ? (
          <button type="button" onClick={() => { onToggle(p.id, 'suspended'); onClose(); }} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-rose-600">Suspend partner</button>
        ) : (
          <button type="button" onClick={() => { onToggle(p.id, 'active'); onClose(); }} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-emerald-600">Reactivate partner</button>
        )}
      </div>
    </SlideOver>
  );
}
