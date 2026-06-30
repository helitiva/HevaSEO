import { NextResponse } from 'next/server';
import { getOrderService, priceQuickOrder } from '@heva/catalog/orders';
import { createServiceClient } from '@/lib/supabase/service';
import { getPaymentProvider } from '@/lib/payments/provider';

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
  'Access-Control-Allow-Origin': process.env.MARKETING_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// chốt 2: best-effort in-memory rate limit (per server instance). Real abuse control = Turnstile +
// a shared store (Redis); this just blunts a naive loop in the demo.
const HITS = new Map<string, { n: number; t: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = HITS.get(ip);
  if (!cur || now - cur.t > RATE_WINDOW_MS) { HITS.set(ip, { n: 1, t: now }); return false; }
  cur.n += 1;
  return cur.n > RATE_MAX;
}

type Body = {
  serviceSlug?: unknown; packageId?: unknown; qty?: unknown;
  addonPicks?: unknown; email?: unknown; name?: unknown;
};
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (rateLimited(ip)) return json({ ok: false, error: 'Too many attempts — please wait a minute.' }, 429);

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return json({ ok: false, error: 'Invalid request body.' }, 400); }

  // ── validate (chốt 1 inputs) ──
  if (!isStr(body.serviceSlug) || !isStr(body.packageId) || !isStr(body.email) || !isStr(body.name)) {
    return json({ ok: false, error: 'Missing required fields.' }, 400);
  }
  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Enter a valid email.' }, 400);
  const qty = typeof body.qty === 'number' && body.qty > 0 ? Math.floor(body.qty) : undefined;
  const addonPicks = (body.addonPicks && typeof body.addonPicks === 'object')
    ? (body.addonPicks as Record<string, string>) : {};

  const service = getOrderService(body.serviceSlug);
  if (!service) return json({ ok: false, error: 'Unknown service.' }, 404);

  // ── chốt 1: server-side price (never trust a client total) ──
  const priced = priceQuickOrder(service, { packageId: body.packageId, qty, addonPicks });
  if (!priced.hasNumericTotal) {
    return json({ ok: false, error: 'This plan needs a custom quote — please contact sales.' }, 422);
  }
  if (!(priced.value > 0)) return json({ ok: false, error: 'Nothing to charge for this selection.' }, 400);

  const svc = createServiceClient();

  // ── chốt 4/5: provision or link the account ──
  // Branch on the auth-linked identity (a profile with user_id = an existing login).
  const { data: profileRow } = await svc
    .from('profiles').select('id, user_id').eq('tenant_id', AGENCY_TENANT).eq('email', email).maybeSingle();

  let profileId = profileRow?.id ?? null;
  let tempPassword: string | null = null;
  const existingAccount = !!profileRow?.user_id; // already-claimed login (chốt 5)

  if (!existingAccount) {
    // new email OR an admin-provisioned shadow → create an auth login with a temp password (the trigger
    // links the shadow profile or creates a fresh customer profile).
    tempPassword = `Heva-${Math.random().toString(36).slice(2, 8)}${Math.floor(10 + Math.random() * 90)}`;
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
      .insert({ tenant_id: AGENCY_TENANT, user_id: profileId, name: body.name, email, status: 'claimed', tier: 'new' })
      .select('id').single();
    if (insErr) return json({ ok: false, error: insErr.message }, 500);
    customerId = created.id;
  } else if (existingCust && existingCust.user_id !== profileId) {
    await svc.from('customers').update({ user_id: profileId, status: 'claimed' }).eq('id', customerId);
  }

  // ── "charge" via the provider seam (mock now / Stripe later) ──
  const charge = await getPaymentProvider().charge({ amount: priced.value, customerId, description: `${service.name} — ${priced.plan?.name ?? ''}` });
  if (!charge.ok) return json({ ok: false, error: charge.error }, 402);

  // ── chốt H2: atomic topup + order (idempotent by the payment ref) ──
  const code = `QO-${Math.floor(1000 + Math.random() * 9000)}`;
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
