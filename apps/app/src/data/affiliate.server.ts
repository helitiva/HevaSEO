import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { IMPERSONATE_AFFILIATE_COOKIE } from '@/lib/impersonation';
import type { PortalData } from '@/data/affiliatePortal';
import type { Affiliate } from '@/data/affiliateMock';
import type { Referral, CommissionEvent, PayoutRequest } from '@/lib/affiliate';
import { defaultTierRows, type EditableTier } from '@/data/adminAffiliate';

// Lane E — an affiliate's REAL portal data. inc-E1: the signed-in affiliate's own (affiliate_*_own RLS).
// inc-E4: admin impersonation reads any tenant affiliate by id (affiliate_*_admin RLS). Maps to the mock
// PortalData shape; marketing metadata (platform/audience/niche/clicks) + per-event order detail aren't
// tabled → defaults. All sub-queries filter by affiliate_id so the admin (all-tenant) path stays scoped.
const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AffRow = { id: string; code: string; tier: string; status: string; joined_at: string | null; platform: string | null; niche: string | null; audience: string | null; clicks: number | null; profiles: { name: string | null; email: string | null } | null };
type RefRow = { id: string; volume: number | string; status: string; created_at: string; customers: { name: string | null; company: string | null } | null };
type LedRow = { id: string; amount: number | string; kind: string; referral_id: string | null; created_at: string };
type PayRow = { id: string; amount: number | string; status: string; requested_at: string };

// PortalData + the authoritative withdrawable balance (affiliate_commission.balance == SUM(ledger)) +
// the config tier ladder (inc-E10; undefined → the UI falls back to the lib default ladder).
export type MyAffiliate = PortalData & { balance: number; tiers?: EditableTier[] };

// Lane E inc-E15 — an affiliate's own payout destinations.
export type AffiliatePayoutMethod = { id: string; kind: 'bank' | 'paypal' | 'wise' | 'crypto'; detail: string; isDefault: boolean };
type PayoutMethodRow = { id: string; kind: string; detail: string; is_default: boolean };

// Short label for a payout method (masks sensitive detail for bank/crypto).
export function payoutMethodLabel(kind: string, detail: string): string {
  const last4 = detail.slice(-4);
  if (kind === 'paypal') return `PayPal · ${detail}`;
  if (kind === 'wise') return `Wise · ${detail}`;
  if (kind === 'bank') return `Bank ••${last4}`;
  if (kind === 'crypto') return `Crypto ••${last4}`;
  return detail;
}

type Supa = Awaited<ReturnType<typeof createClient>>;

// The signed-in affiliate's own payout methods (own RLS), default first.
export async function getMyAffiliatePayoutMethods(): Promise<AffiliatePayoutMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('affiliate_payout_methods')
    .select('id, kind, detail, is_default').order('is_default', { ascending: false }).order('created_at')
    .returns<PayoutMethodRow[]>();
  if (error) throw new Error(`getMyAffiliatePayoutMethods: ${error.message}`);
  return (data ?? []).map((m) => ({ id: m.id, kind: m.kind as AffiliatePayoutMethod['kind'], detail: m.detail, isDefault: m.is_default }));
}

// The tenant's configured tier ladder (RLS tenant-scoped read). undefined when unconfigured → the
// partner UI falls back to the lib ladder. Missing tiers fall back to the shared-ladder default row.
async function readTierLadder(supabase: Supa): Promise<EditableTier[] | undefined> {
  const { data, error } = await supabase.from('affiliate_tier_config').select('tier, min_volume, rate')
    .returns<{ tier: string; min_volume: number | string; rate: number | string }[]>();
  if (error || !data || data.length === 0) return undefined;
  const by = new Map(data.map((t) => [t.tier, t]));
  return defaultTierRows().map((d): EditableTier => {
    const t = by.get(d.id);
    return t ? { ...d, minVolume: Number(t.min_volume), rate: Number(t.rate) } : d;
  });
}

// Build the portal for one resolved affiliate row (all sub-reads scoped to its id).
async function buildPortal(supabase: Supa, aff: AffRow): Promise<MyAffiliate> {
  const [refs, led, pays, bal, tiers, methods] = await Promise.all([
    supabase.from('affiliate_referrals').select('id, volume, status, created_at, customers(name, company)')
      .eq('affiliate_id', aff.id).order('created_at', { ascending: false }).returns<RefRow[]>(),
    supabase.from('commission_ledger').select('id, amount, kind, referral_id, created_at')
      .eq('affiliate_id', aff.id).order('created_at', { ascending: false }).returns<LedRow[]>(),
    supabase.from('affiliate_payouts').select('id, amount, status, requested_at')
      .eq('affiliate_id', aff.id).order('requested_at', { ascending: false }).returns<PayRow[]>(),
    supabase.from('affiliate_commission').select('balance').eq('affiliate_id', aff.id).maybeSingle().returns<{ balance: number | string } | null>(),
    readTierLadder(supabase),
    supabase.from('affiliate_payout_methods').select('kind, detail, is_default').eq('affiliate_id', aff.id)
      .order('is_default', { ascending: false }).order('created_at').returns<PayoutMethodRow[]>(),
  ]);
  if (refs.error || led.error || pays.error || bal.error) throw new Error('getAffiliate portal reads failed');
  const defMethod = methods.data?.find((m) => m.is_default) ?? methods.data?.[0] ?? null;

  const name = aff.profiles?.name ?? 'Affiliate';
  const affiliate: Affiliate = {
    name, handle: `@${aff.code.toLowerCase()}`, code: aff.code, email: aff.profiles?.email ?? '',
    avatarInitials: initialsOf(name), platform: aff.platform ?? '—', audience: aff.audience ?? '—', niche: aff.niche ?? '—',
    joinedAt: aff.joined_at ?? '', status: 'active',
    payoutKind: (defMethod?.kind as Affiliate['payoutKind']) ?? 'paypal',
    payoutLabel: defMethod ? payoutMethodLabel(defMethod.kind, defMethod.detail) : 'No payout method yet',
  };
  const refName = (r: RefRow) => r.customers?.company ?? r.customers?.name ?? 'Referred customer';
  const referrals: Referral[] = (refs.data ?? []).map((r) => ({
    id: r.id, customer: refName(r), joinedAt: ymd(r.created_at),
    orders: Number(r.volume) > 0 ? 1 : 0, volume: Number(r.volume), lastOrderAt: ymd(r.created_at),
    status: r.status === 'churned' ? 'churned' : 'active',
  }));
  const custByRef = new Map(referrals.map((r) => [r.id, r.customer]));
  const events: CommissionEvent[] = (led.data ?? []).filter((l) => l.kind === 'commission').map((l) => ({
    id: l.id, at: ymd(l.created_at), referralId: l.referral_id ?? '',
    customer: (l.referral_id && custByRef.get(l.referral_id)) || '—', orderCode: '—',
    orderValue: 0, rate: 0, amount: Number(l.amount), status: 'cleared',
  }));
  const payouts: PayoutRequest[] = (pays.data ?? []).map((p) => ({
    id: p.id, at: ymd(p.requested_at), amount: Number(p.amount), method: affiliate.payoutLabel,
    status: p.status as PayoutRequest['status'],
  }));
  return { affiliate, referrals, events, payouts, clicks: Number(aff.clicks ?? 0), balance: Number(bal.data?.balance ?? 0), tiers };
}

const AFF_SELECT = 'id, code, tier, status, joined_at, platform, niche, audience, clicks, profiles:user_id(name, email)';

// The signed-in affiliate's own portal (RLS own). null when the session isn't a provisioned affiliate.
export async function getMyAffiliate(): Promise<MyAffiliate | null> {
  const supabase = await createClient();
  const { data: aff, error } = await supabase.from('affiliates').select(AFF_SELECT).limit(1).maybeSingle().returns<AffRow | null>();
  if (error) throw new Error(`getMyAffiliate: ${error.message}`);
  return aff ? buildPortal(supabase, aff) : null;
}

// inc-E4 — a specific affiliate by id (admin RLS reads any tenant affiliate). For admin impersonation.
export async function getAffiliateById(id: string): Promise<MyAffiliate | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data: aff, error } = await supabase.from('affiliates').select(AFF_SELECT).eq('id', id).maybeSingle().returns<AffRow | null>();
  if (error) throw new Error(`getAffiliateById: ${error.message}`);
  return aff ? buildPortal(supabase, aff) : null;
}

// The portal to render: an admin impersonating a partner (real, by cookie id) → that partner; else the
// signed-in affiliate's own. null → the page falls back to the mock (demo persona).
export async function getAffiliatePortalData(): Promise<MyAffiliate | null> {
  const impId = (await cookies()).get(IMPERSONATE_AFFILIATE_COOKIE)?.value;
  if (impId && UUID_RE.test(impId)) {
    const asPartner = await getAffiliateById(impId); // admin RLS; null if not permitted → own/mock fallback
    if (asPartner) return asPartner;
  }
  return getMyAffiliate();
}
