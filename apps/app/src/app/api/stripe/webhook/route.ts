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
      await supabase.rpc('sync_stripe_account_status', { p_account_id: acct.id, p_enabled: Boolean(acct.payouts_enabled) });
    } else if (event.type === 'transfer.reversed') {
      const tr = event.data.object as { id: string };
      await supabase.rpc('revert_affiliate_payout_by_transfer', { p_transfer_ref: tr.id });
    }
  } catch {
    // ACK anyway — a durable reconcile job backstops a dropped handler; retrying rarely helps.
  }
  return NextResponse.json({ received: true });
}
