'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

// Real, customer-scoped backing for the Settings tabs that used to be mock/localStorage:
// security (2FA flag + session sign-out), billing (plan request, auto top-up, payment methods),
// API & webhook, and appearance (locale/timezone). All writes go through SECURITY DEFINER fns.

export type SaveResult = { ok: boolean; error?: string };

export type AutoTopup = { enabled: boolean; threshold: number; amount: number };
export type ApiKey = { id: string; label: string; last4: string; createdAt: string; revokedAt: string | null };
export type Webhook = { id: string; url: string; events: string[] } | null;
export type PaymentMethod = { id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null; isDefault: boolean };
export type MySettings = {
  twoFactor: boolean;
  autoTopup: AutoTopup;
  locale: string;
  timezone: string;
  plan: string;              // real customer tier
  avatarUrl: string;
  apiKeys: ApiKey[];
  webhook: Webhook;
  paymentMethods: PaymentMethod[];
};

const DEFAULT_TOPUP: AutoTopup = { enabled: false, threshold: 40, amount: 199 };
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Everything the Settings page needs beyond profile/billing (one round trip). RLS-scoped. */
export async function getMySettingsAction(): Promise<MySettings | null> {
  const supabase = await createClient();
  const [cust, keys, hooks, pms] = await Promise.all([
    supabase.from('customers').select('two_factor_enabled, auto_topup, locale, timezone, tier, avatar_url').maybeSingle(),
    supabase.from('api_keys').select('id, label, last4, created_at, revoked_at').order('created_at', { ascending: false }),
    supabase.from('webhooks').select('id, url, events').maybeSingle(),
    supabase.from('payment_methods').select('id, brand, last4, exp_month, exp_year, is_default').order('created_at', { ascending: false }),
  ]);
  if (cust.error || !cust.data) return null;
  const at = (cust.data.auto_topup && typeof cust.data.auto_topup === 'object' && !Array.isArray(cust.data.auto_topup)
    ? cust.data.auto_topup : {}) as Record<string, unknown>;
  return {
    twoFactor: Boolean(cust.data.two_factor_enabled),
    autoTopup: { enabled: Boolean(at.enabled), threshold: num(at.threshold, DEFAULT_TOPUP.threshold), amount: num(at.amount, DEFAULT_TOPUP.amount) },
    locale: cust.data.locale ?? 'English',
    timezone: cust.data.timezone ?? '(GMT-8) Los Angeles',
    plan: cust.data.tier ?? 'new',
    avatarUrl: cust.data.avatar_url ?? '',
    apiKeys: (keys.data ?? []).map((k) => ({ id: k.id, label: k.label, last4: k.last4, createdAt: k.created_at, revokedAt: k.revoked_at })),
    webhook: hooks.data ? { id: hooks.data.id, url: hooks.data.url, events: hooks.data.events ?? [] } : null,
    paymentMethods: (pms.data ?? []).map((p) => ({ id: p.id, brand: p.brand, last4: p.last4, expMonth: p.exp_month, expYear: p.exp_year, isDefault: p.is_default })),
  };
}

// ── security ────────────────────────────────────────────────────────────────────
export async function setTwoFactorAction(on: boolean): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_my_settings', { p_two_factor: on });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Sign out every OTHER session (keeps the current one). Real Supabase auth, no fake device list. */
export async function signOutOtherSessionsAction(): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── billing ───────────────────────────────────────────────────────────────────
export async function setAutoTopupAction(t: AutoTopup): Promise<SaveResult> {
  const supabase = await createClient();
  const payload = { enabled: Boolean(t.enabled), threshold: num(t.threshold, DEFAULT_TOPUP.threshold), amount: num(t.amount, DEFAULT_TOPUP.amount) } as unknown as Json;
  const { error } = await supabase.rpc('set_my_settings', { p_auto_topup: payload });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** A customer must never self-upgrade their tier — a plan change is filed as a real billing ticket. */
export async function requestPlanChangeAction(plan: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_ticket', {
    p_subject: `Plan change request: ${plan}`,
    p_type: 'billing',
    p_body: `Customer requested to switch to the ${plan} plan from the Settings page.`,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function addPaymentMethodAction(m: { brand: string; last4: string; expMonth: number | null; expYear: number | null }): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_payment_method', {
    p_brand: m.brand, p_last4: m.last4, p_exp_month: m.expMonth ?? undefined, p_exp_year: m.expYear ?? undefined,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function removePaymentMethodAction(id: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_payment_method', { p_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function setDefaultPaymentMethodAction(id: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_default_payment_method', { p_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── API keys ────────────────────────────────────────────────────────────────────
/** Generates a real key. The plaintext token is returned ONCE (only its hash is stored). */
export async function createApiKeyAction(label: string): Promise<{ ok: true; token: string; key: ApiKey } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_api_key', { p_label: label });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: 'Key creation failed' };
  return { ok: true, token: row.token, key: { id: row.id, label: row.label, last4: row.last4, createdAt: row.created_at, revokedAt: null } };
}
export async function revokeApiKeyAction(id: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_api_key', { p_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── webhooks ─────────────────────────────────────────────────────────────────────
export async function saveWebhookAction(url: string, events: string[]): Promise<{ ok: true; webhook: Webhook } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_webhook', { p_url: url, p_events: events });
  if (error) return { ok: false, error: error.message };
  return { ok: true, webhook: data ? { id: data.id, url: data.url, events: data.events ?? [] } : null };
}
export async function deleteWebhookAction(id: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_webhook', { p_id: id });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Real outbound test delivery: POST a sample event to the endpoint (5s timeout, http/https only). */
export async function sendWebhookTestAction(url: string): Promise<SaveResult> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { ok: false, error: 'Enter a valid URL first' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, error: 'URL must be http(s)' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(parsed.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hevaseo-event': 'ping' },
      body: JSON.stringify({ type: 'ping', sent_at: new Date().toISOString() }),
      signal: ctrl.signal,
    });
    return res.ok ? { ok: true } : { ok: false, error: `Endpoint responded ${res.status}` };
  } catch {
    return { ok: false, error: 'Delivery failed — endpoint unreachable or timed out' };
  } finally {
    clearTimeout(t);
  }
}

// ── avatar / logo ─────────────────────────────────────────────────────────────────
/** Persist the resolved public avatar URL (file itself is uploaded client-side to Storage). '' clears it. */
export async function setAvatarUrlAction(url: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_my_settings', { p_avatar_url: url });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── appearance ────────────────────────────────────────────────────────────────────
export async function setAppearanceAction(a: { locale: string; timezone: string }): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_my_settings', { p_locale: a.locale, p_timezone: a.timezone });
  return error ? { ok: false, error: error.message } : { ok: true };
}
