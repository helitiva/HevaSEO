import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PortalData } from '@/data/affiliatePortal';
import type { Affiliate } from '@/data/affiliateMock';
import type { Referral, CommissionEvent, PayoutRequest } from '@/lib/affiliate';

// Lane E inc-E1 — the signed-in affiliate's REAL portal data, RLS-scoped (affiliate_*_own policies →
// their own affiliate row, referrals, commission ledger + balance, payouts). Maps to the mock PortalData
// shape so the dashboard just swaps its source. Marketing metadata (platform/audience/niche/clicks) and
// per-event order details aren't tabled → sensible defaults. Returns null when the session isn't a
// provisioned affiliate (→ dash falls back to the mock).
const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

type AffRow = { id: string; code: string; tier: string; status: string; joined_at: string | null; profiles: { name: string | null; email: string | null } | null };
type RefRow = { id: string; volume: number | string; status: string; created_at: string; customers: { name: string | null; company: string | null } | null };
type LedRow = { id: string; amount: number | string; kind: string; referral_id: string | null; created_at: string };
type PayRow = { id: string; amount: number | string; status: string; requested_at: string };

// PortalData + the authoritative withdrawable balance (affiliate_commission.balance == SUM(ledger)).
export type MyAffiliate = PortalData & { balance: number };

export async function getMyAffiliate(): Promise<MyAffiliate | null> {
  const supabase = await createClient();
  const { data: aff, error } = await supabase
    .from('affiliates')
    .select('id, code, tier, status, joined_at, profiles:user_id(name, email)')
    .limit(1)
    .maybeSingle()
    .returns<AffRow | null>();
  if (error) throw new Error(`getMyAffiliate: ${error.message}`);
  if (!aff) return null;

  const [refs, led, pays, bal] = await Promise.all([
    supabase.from('affiliate_referrals').select('id, volume, status, created_at, customers(name, company)')
      .order('created_at', { ascending: false }).returns<RefRow[]>(),
    supabase.from('commission_ledger').select('id, amount, kind, referral_id, created_at')
      .order('created_at', { ascending: false }).returns<LedRow[]>(),
    supabase.from('affiliate_payouts').select('id, amount, status, requested_at')
      .order('requested_at', { ascending: false }).returns<PayRow[]>(),
    supabase.from('affiliate_commission').select('balance').maybeSingle().returns<{ balance: number | string } | null>(),
  ]);
  if (refs.error) throw new Error(`getMyAffiliate referrals: ${refs.error.message}`);
  if (led.error) throw new Error(`getMyAffiliate ledger: ${led.error.message}`);
  if (pays.error) throw new Error(`getMyAffiliate payouts: ${pays.error.message}`);
  if (bal.error) throw new Error(`getMyAffiliate balance: ${bal.error.message}`);

  const name = aff.profiles?.name ?? 'Affiliate';
  const affiliate: Affiliate = {
    name, handle: `@${aff.code.toLowerCase()}`, code: aff.code, email: aff.profiles?.email ?? '',
    avatarInitials: initialsOf(name), platform: '—', audience: '—', niche: '—',
    joinedAt: aff.joined_at ?? '', status: 'active', payoutKind: 'paypal', payoutLabel: 'PayPal ••…',
  };

  const refName = (r: RefRow) => r.customers?.company ?? r.customers?.name ?? 'Referred customer';
  const referrals: Referral[] = (refs.data ?? []).map((r) => ({
    id: r.id, customer: refName(r), joinedAt: ymd(r.created_at),
    orders: Number(r.volume) > 0 ? 1 : 0, volume: Number(r.volume), lastOrderAt: ymd(r.created_at),
    status: r.status === 'churned' ? 'churned' : 'active',
  }));
  const custByRef = new Map(referrals.map((r) => [r.id, r.customer]));

  const events: CommissionEvent[] = (led.data ?? [])
    .filter((l) => l.kind === 'commission')
    .map((l) => ({
      id: l.id, at: ymd(l.created_at), referralId: l.referral_id ?? '',
      customer: (l.referral_id && custByRef.get(l.referral_id)) || '—', orderCode: '—',
      orderValue: 0, rate: 0, amount: Number(l.amount), status: 'cleared',
    }));

  const payouts: PayoutRequest[] = (pays.data ?? []).map((p) => ({
    id: p.id, at: ymd(p.requested_at), amount: Number(p.amount), method: affiliate.payoutLabel,
    status: p.status as PayoutRequest['status'],
  }));

  return { affiliate, referrals, events, payouts, clicks: 0, balance: Number(bal.data?.balance ?? 0) };
}
