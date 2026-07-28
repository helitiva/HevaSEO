'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import { billingComplete, type BillingForm } from '@/lib/billing';

// Real profile + billing for the settings page (RLS-scoped read; safe-column write via a fn).
export type ProfileForm = { name: string; email: string; phone: string; company: string; industry: string; website: string };
export type { BillingForm } from '@/lib/billing'; // re-export so existing importers keep working

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

// Light fetch for the top-bar avatar (photo + name → initials). Separate from getMyProfileAction so the
// portal layout doesn't pull the whole profile/billing/notif payload on every page.
export async function getMyAvatarAction(): Promise<{ avatarUrl: string; name: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('avatar_url, name').maybeSingle();
  return { avatarUrl: s(data?.avatar_url), name: s(data?.name) };
}

export type NotifPrefs = Record<string, boolean>;
export async function getMyProfileAction(): Promise<{ profile: ProfileForm; billing: BillingForm; notif: NotifPrefs } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers').select('name, email, phone, company, industry, website, billing, notif_prefs').maybeSingle();
  if (error || !data) return null;
  const b = (data.billing && typeof data.billing === 'object' && !Array.isArray(data.billing) ? data.billing : {}) as Record<string, unknown>;
  const n = (data.notif_prefs && typeof data.notif_prefs === 'object' && !Array.isArray(data.notif_prefs) ? data.notif_prefs : {}) as Record<string, unknown>;
  const notif: NotifPrefs = {};
  for (const [k, v] of Object.entries(n)) notif[k] = Boolean(v);
  return {
    profile: { name: s(data.name), email: s(data.email), phone: s(data.phone), company: s(data.company), industry: s(data.industry), website: s(data.website) },
    billing: billingFromJson(b, data),
    notif,
  };
}

// Map the billing jsonb → BillingForm, filling blanks from the customer's base fields and migrating the
// legacy single-line `address` into line1.
function billingFromJson(b: Record<string, unknown>, data: { name?: string | null; email?: string | null; phone?: string | null; company?: string | null }): BillingForm {
  return {
    name: s(b.name) || s(data.name),
    email: s(b.email) || s(data.email),
    phone: s(b.phone) || s(data.phone),
    company: s(b.company) || s(data.company),
    taxId: s(b.taxId),
    line1: s(b.line1) || s(b.address),
    line2: s(b.line2),
    city: s(b.city),
    state: s(b.state),
    postalCode: s(b.postalCode),
    country: s(b.country),
  };
}

// Lighter read for the top-up flow: the saved billing + whether it's complete enough to charge.
export async function getMyBillingAction(): Promise<{ billing: BillingForm; complete: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('name, email, phone, company, billing').maybeSingle();
  const b = (data?.billing && typeof data.billing === 'object' && !Array.isArray(data.billing) ? data.billing : {}) as Record<string, unknown>;
  const billing = billingFromJson(b, data ?? {});
  return { billing, complete: billingComplete(billing) };
}

// Real password change via Supabase Auth (the logged-in user's session).
export async function updatePasswordAction(newPassword: string): Promise<SaveResult> {
  if (newPassword.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateNotifPrefsAction(prefs: NotifPrefs): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_notif_prefs', { p_notif: prefs as unknown as Json });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type SaveResult = { ok: boolean; error?: string };

export async function updateProfileAction(p: ProfileForm): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_my_profile', {
    p_name: p.name, p_phone: p.phone, p_company: p.company, p_industry: p.industry, p_website: p.website,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateBillingAction(b: BillingForm): Promise<SaveResult> {
  const supabase = await createClient();
  const billing = {
    name: b.name, email: b.email, phone: b.phone, company: b.company, taxId: b.taxId,
    line1: b.line1, line2: b.line2, city: b.city, state: b.state, postalCode: b.postalCode, country: b.country,
  } as unknown as Json;
  const { error } = await supabase.rpc('update_my_profile', { p_billing: billing });
  return error ? { ok: false, error: error.message } : { ok: true };
}
