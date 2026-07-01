import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminAffiliate, AdminPayout, PartnerStatus } from '@/data/adminAffiliate';
import type { PayoutStatus, TierId } from '@/lib/affiliate';

// Lane E inc-E3 — admin affiliate console reads (admin RLS = all tenant affiliates). Aggregates the real
// tables into the AdminAffiliate / AdminPayout shapes the console already renders: refs = referral count,
// volume = Σ referral volume, commission = Σ commission ledger, claimed = Σ paid payouts. Marketing
// metadata (platform/niche/lastActive) is untabled → defaults.
const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const toPartnerStatus = (s: string): PartnerStatus => (s === 'pending' ? 'pending' : s === 'churned' ? 'suspended' : 'active');

type AffRow = { id: string; code: string; status: string; tier: string; tier_pinned: boolean; joined_at: string | null; profiles: { name: string | null; email: string | null } | null };

export async function getAffiliates(): Promise<AdminAffiliate[]> {
  const supabase = await createClient();
  const [affs, refs, led, pays] = await Promise.all([
    supabase.from('affiliates').select('id, code, status, tier, tier_pinned, joined_at, profiles:user_id(name, email)').returns<AffRow[]>(),
    supabase.from('affiliate_referrals').select('affiliate_id, volume').returns<{ affiliate_id: string; volume: number | string }[]>(),
    supabase.from('commission_ledger').select('affiliate_id, amount, kind').returns<{ affiliate_id: string; amount: number | string; kind: string }[]>(),
    supabase.from('affiliate_payouts').select('affiliate_id, amount, status').returns<{ affiliate_id: string; amount: number | string; status: string }[]>(),
  ]);
  if (affs.error) throw new Error(`getAffiliates: ${affs.error.message}`);
  if (refs.error || led.error || pays.error) throw new Error('getAffiliates aggregates failed');

  const refCount = new Map<string, number>(); const volume = new Map<string, number>();
  for (const r of refs.data ?? []) { refCount.set(r.affiliate_id, (refCount.get(r.affiliate_id) ?? 0) + 1); volume.set(r.affiliate_id, (volume.get(r.affiliate_id) ?? 0) + Number(r.volume)); }
  const commission = new Map<string, number>();
  for (const l of led.data ?? []) if (l.kind === 'commission') commission.set(l.affiliate_id, (commission.get(l.affiliate_id) ?? 0) + Number(l.amount));
  const claimed = new Map<string, number>();
  for (const p of pays.data ?? []) if (p.status === 'paid') claimed.set(p.affiliate_id, (claimed.get(p.affiliate_id) ?? 0) + Number(p.amount));

  return (affs.data ?? []).map((a): AdminAffiliate => {
    const name = a.profiles?.name ?? 'Affiliate';
    return {
      id: a.id, name, handle: `@${a.code.toLowerCase()}`, avatarInitials: initialsOf(name),
      platform: '—', niche: '—', email: a.profiles?.email ?? '', code: a.code,
      status: toPartnerStatus(a.status), joinedAt: a.joined_at ?? '', lastActiveAt: a.joined_at ?? '',
      refs: refCount.get(a.id) ?? 0, volume: volume.get(a.id) ?? 0,
      commission: commission.get(a.id) ?? 0, claimed: claimed.get(a.id) ?? 0,
      tierPinned: a.tier_pinned, pinnedTier: a.tier as TierId,
    };
  });
}

type PayRow = { id: string; affiliate_id: string; amount: number | string; status: string; requested_at: string; affiliates: { code: string; profiles: { name: string | null } | null } | null };

export async function getAffiliatePayouts(): Promise<AdminPayout[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affiliate_payouts')
    .select('id, affiliate_id, amount, status, requested_at, affiliates(code, profiles:user_id(name))')
    .order('requested_at', { ascending: false })
    .returns<PayRow[]>();
  if (error) throw new Error(`getAffiliatePayouts: ${error.message}`);
  return (data ?? []).map((p): AdminPayout => {
    const name = p.affiliates?.profiles?.name ?? 'Affiliate';
    return {
      id: p.id, affiliateId: p.affiliate_id, partner: name,
      handle: p.affiliates?.code ? `@${p.affiliates.code.toLowerCase()}` : '',
      at: ymd(p.requested_at), amount: Number(p.amount), method: 'PayPal ••…',
      status: p.status as PayoutStatus,
    };
  });
}
