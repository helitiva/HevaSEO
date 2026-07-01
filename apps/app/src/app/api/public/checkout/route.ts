import { NextResponse } from 'next/server';
import { randomBytes, randomInt } from 'node:crypto';
import { getOrderService, priceQuickOrder } from '@heva/catalog/orders';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider } from '@/lib/payments/provider';
import type { Json } from '@/lib/supabase/database.types';

// Phase 2 / inc-Q2 — public marketing quick-checkout (ADR §7, the 6 chốt). An anonymous visitor on the
// Astro marketing site buys a package; this trusted server endpoint prices it, "charges" via the payment
// provider (mock now / Stripe later), provisions/links the customer account, and materializes the order
// atomically. MONEY (gác③).
//
// The 6 chốt:
//  1. server-side price        → priceQuickOrder() from the shared catalog; client total never trusted.
//  2. rate-limit + Turnstile   → light in-memory IP limiter below; Turnstile verify is a documented stub
//                                (needs a Cloudflare key) — wire verifyTurnstile() when keys exist.
//  3. idempotent               → materialize_order is idempotent by checkout_ref (the payment ref).
//  4. temp-password            → new/shadow accounts get a temp password (emailed for real; returned
//                                here for the demo) and should change it on first login.
//  5. email-collision guard    → an already-claimed account is NEVER auto-logged-in or re-created; the
//                                order is attached and they get a login link only.
//  6. reconcile job            → N/A for the synchronous mock; with real Stripe a poller backstops a
//                                lost webhook (documented).

const AGENCY_TENANT = 'a9e0c0de-0000-4000-8000-000000000001';
const CORS = {
  'Access-Control-Allow-Origin': process.env.MARKETING_ORIGIN ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// chốt 2: durable per-IP rate limit via Postgres rate_hit() (multi-instance-safe; replaces the old
// in-memory Map). Turnstile verify remains a documented stub.
const RATE_WINDOW_SECS = 60;
const RATE_MAX = 8;

type Body = {
  serviceSlug?: unknown; packageId?: unknown; qty?: unknown;
  addonPicks?: unknown; email?: unknown; name?: unknown;
  billing?: unknown; saveBilling?: unknown; turnstileToken?: unknown;
};
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// chốt 2 (bot): Cloudflare Turnstile server verify. Gated on TURNSTILE_SECRET — when unset (local/dev)
// it's a no-op so nothing breaks; wire the widget token as body.turnstileToken to activate in prod.
async function turnstileOk(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // not configured → skip
  if (typeof token !== 'string' || !token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const d = (await r.json()) as { success?: boolean };
    return Boolean(d.success);
  } catch { return false; }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const svc = createServiceClient();

  // durable rate limit; fail-open on limiter error so a paid checkout is never blocked by limiter downtime.
  try {
    const { data: allowed, error } = await svc.rpc('rate_hit', { p_key: `checkout:${ip}`, p_max: RATE_MAX, p_window_secs: RATE_WINDOW_SECS });
    if (!error && allowed === false) return json({ ok: false, error: 'Too many attempts — please wait a minute.' }, 429);
  } catch { /* limiter unavailable → fail open */ }

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return json({ ok: false, error: 'Invalid request body.' }, 400); }

  // ── validate (chốt 1 inputs) ──
  if (!isStr(body.serviceSlug) || !isStr(body.packageId) || !isStr(body.email) || !isStr(body.name)) {
    return json({ ok: false, error: 'Missing required fields.' }, 400);
  }
  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Enter a valid email.' }, 400);
  if (!(await turnstileOk(body.turnstileToken))) return json({ ok: false, error: 'Bot check failed — please retry.' }, 403);
  const qty = typeof body.qty === 'number' && body.qty > 0 ? Math.floor(body.qty) : undefined;
  const addonPicks = (body.addonPicks && typeof body.addonPicks === 'object')
    ? (body.addonPicks as Record<string, string>) : {};
  // billing is saved only when the buyer opts in (chốt 4 convenience — prefill their dashboard later)
  const billing: Json | null = body.saveBilling && body.billing && typeof body.billing === 'object'
    ? (body.billing as Json) : null;

  const service = getOrderService(body.serviceSlug);
  if (!service) return json({ ok: false, error: 'Unknown service.' }, 404);

  // ── chốt 1: server-side price (never trust a client total) ──
  const priced = priceQuickOrder(service, { packageId: body.packageId, qty, addonPicks });
  if (!priced.hasNumericTotal) {
    return json({ ok: false, error: 'This plan needs a custom quote — please contact sales.' }, 422);
  }
  if (!(priced.value > 0)) return json({ ok: false, error: 'Nothing to charge for this selection.' }, 400);

  // ── chốt 4/5: provision or link the account ──
  // Branch on the auth-linked identity (a profile with user_id = an existing login).
  const { data: profileRow } = await svc
    .from('profiles').select('id, user_id, role').eq('tenant_id', AGENCY_TENANT).eq('email', email).maybeSingle();

  // SECURITY: never let a public, unverified checkout claim or provision against a privileged
  // (staff/manager/admin/affiliate) identity — that would be an escalation path. Team emails sign in
  // through the proper flow, not the storefront.
  if (profileRow && profileRow.role !== 'customer') {
    return json({ ok: false, error: 'This email is registered to a team account — please sign in instead.' }, 409);
  }

  let profileId = profileRow?.id ?? null;
  let tempPassword: string | null = null;
  const existingAccount = !!profileRow?.user_id; // already-claimed login (chốt 5)

  if (!existingAccount) {
    // new email OR an admin-provisioned shadow → create an auth login with a temp password (the trigger
    // links the shadow profile or creates a fresh customer profile).
    tempPassword = `Heva-${randomBytes(9).toString('base64url')}`;
    const { error: cuErr } = await svc.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true, user_metadata: { name: body.name },
    });
    if (cuErr) return json({ ok: false, error: cuErr.message }, 500);
    const { data: fresh } = await svc
      .from('profiles').select('id').eq('tenant_id', AGENCY_TENANT).eq('email', email).maybeSingle();
    profileId = fresh?.id ?? null;
  }
  if (!profileId) return json({ ok: false, error: 'Could not provision the account.' }, 500);

  // ── ensure a customer row, linked to the profile ──
  const { data: existingCust } = await svc
    .from('customers').select('id, user_id').eq('tenant_id', AGENCY_TENANT).eq('email', email).maybeSingle();
  let customerId = existingCust?.id ?? null;
  if (!customerId) {
    const { data: created, error: insErr } = await svc.from('customers')
      .insert({ tenant_id: AGENCY_TENANT, user_id: profileId, name: body.name, email, status: 'claimed', tier: 'new', billing })
      .select('id').single();
    if (insErr) return json({ ok: false, error: insErr.message }, 500);
    customerId = created.id;
  } else if (existingCust && existingCust.user_id !== profileId) {
    // link/claim the shadow customer (and refresh billing if opted in this time)
    await svc.from('customers').update({ user_id: profileId, status: 'claimed', ...(billing ? { billing } : {}) }).eq('id', customerId);
  } else if (billing) {
    await svc.from('customers').update({ billing }).eq('id', customerId);
  }

  // ── "charge" via the provider seam (mock now / Stripe later) ──
  const charge = await getPaymentProvider().charge({ amount: priced.value, customerId, description: `${service.name} — ${priced.plan?.name ?? ''}` });
  if (!charge.ok) return json({ ok: false, error: charge.error }, 402);

  // ── chốt H2: atomic topup + order (idempotent by the payment ref) ──
  const code = `QO-${randomInt(1000, 10000)}`;
  const { data: order, error: moErr } = await svc.rpc('materialize_order', {
    p_tenant: AGENCY_TENANT, p_customer: customerId, p_code: code,
    p_service: service.name, p_value: priced.value, p_actor: profileId, p_ref: charge.ref,
  });
  if (moErr) return json({ ok: false, error: moErr.message }, 500);

  // (real: send_order_email(order, 'checkout') with login link + temp password — Phase 2 email tables.)
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? ''}/login?email=${encodeURIComponent(email)}`;
  return json({
    ok: true,
    orderCode: order.code,
    amount: priced.value,
    account: { email, existing: existingAccount, tempPassword, loginUrl },
  });
}
