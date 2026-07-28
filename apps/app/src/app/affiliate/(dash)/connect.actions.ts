'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Lane E inc-E19 — Stripe Connect onboarding for the signed-in affiliate. Creates (once) a Stripe Express
// connected account, stores its id via the claims-derived fn, and returns a hosted onboarding link. The
// secret key is server-only; the affiliate never sees it.
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:4500';

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import('stripe');
  return new Stripe(key);
}

type StartResult = { ok: true; url: string } | { ok: false; error: string };

export async function startAffiliateOnboardingAction(): Promise<StartResult> {
  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: 'Payouts are not configured yet.' };
  const supabase = await createClient();
  const { data: aff, error } = await supabase.from('affiliates').select('id, stripe_account_id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!aff) return { ok: false, error: 'Only an affiliate can set up payouts.' };

  let accountId = aff.stripe_account_id as string | null;
  try {
    if (!accountId) {
      const acct = await stripe.accounts.create({ type: 'express', metadata: { heva_affiliate: aff.id } });
      accountId = acct.id;
      const { error: setErr } = await supabase.rpc('set_affiliate_stripe_account', { p_account_id: accountId, p_enabled: false });
      if (setErr) return { ok: false, error: setErr.message };
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_ORIGIN}/affiliate/settings?stripe=refresh`,
      return_url: `${APP_ORIGIN}/affiliate/settings?stripe=return`,
      type: 'account_onboarding',
    });
    return { ok: true, url: link.url };
  } catch (e) {
    // Most common in test mode: Connect not enabled on the platform account.
    return { ok: false, error: e instanceof Error ? e.message : 'Stripe onboarding failed.' };
  }
}

type RefreshResult = { ok: true; enabled: boolean } | { ok: false; error: string };

export async function refreshAffiliateConnectStatusAction(): Promise<RefreshResult> {
  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: 'Payouts are not configured yet.' };
  const supabase = await createClient();
  const { data: aff } = await supabase.from('affiliates').select('stripe_account_id').maybeSingle();
  if (!aff?.stripe_account_id) return { ok: true, enabled: false };
  try {
    const acct = await stripe.accounts.retrieve(aff.stripe_account_id);
    const enabled = Boolean(acct.payouts_enabled);
    await supabase.rpc('set_affiliate_stripe_account', { p_account_id: aff.stripe_account_id, p_enabled: enabled });
    revalidatePath('/affiliate/settings');
    return { ok: true, enabled };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not refresh status.' };
  }
}
