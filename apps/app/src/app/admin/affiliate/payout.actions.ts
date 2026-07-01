'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TierId } from '@/lib/affiliate';
import type { ProgramRules, EditableTier } from '@/data/adminAffiliate';

export type ResolveResult = { ok: true } | { ok: false; error: string };

const ERR: Record<string, string> = {
  NOT_ADMIN: 'Only an admin can resolve payouts.',
  REQUEST_NOT_FOUND: 'That payout request no longer exists.',
  ALREADY_RESOLVED: 'This payout is already settled.',
  BAD_ACTION: 'Invalid action.',
};

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import('stripe');
  return new Stripe(key);
}

// Lane E inc-E3/E20 — admin resolves an affiliate payout, MONEY (gác③). On 'pay', when Stripe is
// configured, a real Stripe transfer moves the money to the affiliate's connected account (inc-E19)
// BEFORE the DB marks it paid — so we never mark paid without a settled transfer, and the transfer id is
// stored as provider_ref. reject refunds the held amount. Idempotent + admin-gated in the fn.
export async function resolveAffiliatePayoutAction(payoutId: string, action: 'approve' | 'pay' | 'reject'): Promise<ResolveResult> {
  const supabase = await createClient();
  let providerRef: string | undefined;

  if (action === 'pay') {
    const stripe = await getStripe();
    if (stripe) {
      const { data: pay, error: readErr } = await supabase
        .from('affiliate_payouts')
        .select('amount, status, affiliates(stripe_account_id, stripe_payouts_enabled)')
        .eq('id', payoutId).maybeSingle();
      if (readErr) return { ok: false, error: readErr.message };
      if (!pay) return { ok: false, error: ERR.REQUEST_NOT_FOUND };
      if (pay.status === 'paid' || pay.status === 'rejected') return { ok: false, error: ERR.ALREADY_RESOLVED };
      const acct = Array.isArray(pay.affiliates) ? pay.affiliates[0] : pay.affiliates;
      if (!acct?.stripe_account_id || !acct.stripe_payouts_enabled) {
        return { ok: false, error: 'This partner hasn’t connected a Stripe payout account yet — ask them to finish onboarding in Settings.' };
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(Number(pay.amount) * 100), currency: 'usd',
          destination: acct.stripe_account_id, metadata: { heva_payout: payoutId },
        });
        providerRef = transfer.id;
      } catch (e) {
        return { ok: false, error: e instanceof Error ? `Transfer failed: ${e.message}` : 'Transfer failed.' };
      }
    }
  }

  const { error } = await supabase.rpc('resolve_affiliate_payout', { p_request: payoutId, p_action: action, p_provider_ref: providerRef });
  if (error) {
    const key = Object.keys(ERR).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERR[key] : error.message };
  }
  revalidatePath('/admin/affiliate');
  revalidatePath('/affiliate'); revalidatePath('/affiliate/payouts');
  return { ok: true };
}

// Lane E inc-E5 — admin approves/suspends/reactivates a partner. UI status ('active'|'pending'|'suspended')
// → set_affiliate_status maps 'suspended'→'churned'. Admin-gated.
export async function setAffiliateStatusAction(affiliateId: string, status: 'active' | 'pending' | 'suspended'): Promise<ResolveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_affiliate_status', { p_affiliate: affiliateId, p_status: status });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change a partner’s status.' };
    if (error.message.includes('AFFILIATE_NOT_FOUND')) return { ok: false, error: 'That partner no longer exists.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}

// Lane E inc-E7 — admin saves the program rules (Rules tab). Admin-gated via upsert_affiliate_program_config.
export async function saveAffiliateRulesAction(rules: ProgramRules): Promise<ResolveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('upsert_affiliate_program_config', {
    p_approval_mode: rules.approvalMode, p_attribution: rules.attribution,
    p_cookie_window_days: rules.cookieWindowDays, p_hold_days: rules.holdDays,
    p_min_payout: rules.minPayout, p_self_referral_block: rules.selfReferralBlock, p_recurring: rules.recurring,
  });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change program rules.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}

// Lane E inc-E7 — admin saves the commission-tier definitions (replaces all rows).
export async function saveAffiliateTiersAction(tiers: EditableTier[]): Promise<ResolveResult> {
  const supabase = await createClient();
  const payload = tiers.map((t) => ({ tier: t.id, min_volume: t.minVolume, rate: t.rate }));
  const { error } = await supabase.rpc('upsert_affiliate_tier_config', { p_tiers: payload });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change tiers.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}

// Lane E inc-E13 — admin provisions a new affiliate partner (shadow profile + affiliate row; the
// partner claims it by signing up with the same email). Admin-gated via create_affiliate_partner.
export type CreatePartnerResult = { ok: true; code: string } | { ok: false; error: string };
export async function createAffiliatePartnerAction(input: {
  name: string; email: string; code: string; tier: TierId; platform?: string; niche?: string; audience?: string;
}): Promise<CreatePartnerResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_affiliate_partner', {
    p_name: input.name, p_email: input.email, p_code: input.code, p_tier: input.tier,
    p_platform: input.platform || undefined, p_niche: input.niche || undefined, p_audience: input.audience || undefined,
  });
  if (error) {
    const map: Record<string, string> = {
      NOT_ADMIN: 'Only an admin can create partners.',
      BAD_EMAIL: 'Enter a valid email.', BAD_CODE: '3–20 letters/numbers only.', BAD_NAME: 'Enter a name.',
      EMAIL_TAKEN: 'An account with this email already exists.', CODE_TAKEN: 'That referral code is taken.',
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, error: key ? map[key] : error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true, code: (data as { code: string }).code };
}

// Lane E inc-E6 — admin pins a partner's tier (override the volume ladder) or reverts to auto (tier=null).
// Admin-gated via set_affiliate_tier.
export async function setAffiliateTierAction(affiliateId: string, tier: TierId | null): Promise<ResolveResult> {
  const supabase = await createClient();
  // null tier → omit p_tier so the fn's `default null` revert-to-auto path runs
  const { error } = await supabase.rpc('set_affiliate_tier', { p_affiliate: affiliateId, p_tier: tier ?? undefined });
  if (error) {
    if (error.message.includes('NOT_ADMIN')) return { ok: false, error: 'Only an admin can change a partner’s tier.' };
    if (error.message.includes('AFFILIATE_NOT_FOUND')) return { ok: false, error: 'That partner no longer exists.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/admin/affiliate');
  return { ok: true };
}
