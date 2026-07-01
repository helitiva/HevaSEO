import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Lane E inc-E22 — Stripe webhook backstop. Reconciles state that changes out-of-band from our
// synchronous flows: `account.updated` (Connect onboarding completes → payouts_enabled) backstops the
// settings return-redirect, and `transfer.reversed` refunds a reversed payout. Signature-verified;
// writes via the service-role client through service-role-only SECURITY DEFINER fns. Always ACKs 2xx on a
// handled event so Stripe doesn't retry-storm; unknown events are ignored.
async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const { default: Stripe } = await import('stripe');
  return new Stripe(key);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = await getStripe();
  if (!stripe || !secret) return new NextResponse('Webhook not configured', { status: 503 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const supabase = createServiceClient();
  try {
    if (event.type === 'account.updated') {
      const acct = event.data.object as { id: string; payouts_enabled?: boolean };
      const { error } = await supabase.rpc('sync_stripe_account_status', { p_account_id: acct.id, p_enabled: Boolean(acct.payouts_enabled) });
      if (error) throw error;
    } else if (event.type === 'transfer.reversed') {
      const tr = event.data.object as { id: string };
      const { error } = await supabase.rpc('revert_affiliate_payout_by_transfer', { p_transfer_ref: tr.id });
      if (error) throw error;
    }
    // unknown event types fall through and get ACKed below (no retry-storm on events we don't handle).
  } catch {
    // A HANDLED event whose reconcile failed → return 5xx so Stripe RETRIES with backoff (both fns are
    // idempotent, so a replay is safe). This closes the "silent clawback loss" gap: previously the
    // handler swallowed the error and ACKed 2xx, so Stripe never retried and a reversed transfer's
    // refund could be lost.
    return new NextResponse('Handler failed — retry', { status: 500 });
  }
  return NextResponse.json({ received: true });
}
