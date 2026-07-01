'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, LinkAuthenticationElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useToast } from './Toast';
import { createTopUpIntentAction, confirmTopUpAction } from '@/app/(portal)/credit.actions';

// Stripe Payment Element top-up (surfaces Link + card + Apple/Google Pay in one embedded widget). The PK
// is a NEXT_PUBLIC var (safe in the bundle). loadStripe is memoised at module scope so it loads once.
const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= PK ? loadStripe(PK) : Promise.resolve(null));

export function stripeConfigured(): boolean {
  return Boolean(PK);
}

// Inner form — has access to the Elements context, confirms in-browser, then credits server-side.
function PayForm({ amount, piId, onDone }: { amount: number; piId: string; onDone?: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  async function pay() {
    if (!stripe || !elements || paying) return;
    setPaying(true);
    // confirm in-browser; redirect:'if_required' keeps card/Link inline (only redirect-based methods leave)
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setPaying(false); toast(error.message ?? 'Payment failed.', 'error'); return; }
    if (paymentIntent?.status !== 'succeeded') { setPaying(false); toast('Payment not completed.', 'error'); return; }
    // credit only AFTER the server re-verifies the PaymentIntent succeeded (client can't self-credit)
    const res = await confirmTopUpAction(piId);
    setPaying(false);
    if (!res.ok) { toast(res.error, 'error'); return; }
    toast(`Topped up $${res.amount} — added to your balance`, 'success');
    onDone?.();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <LinkAuthenticationElement />
      <PaymentElement options={{ layout: 'tabs' }} />
      <button type="button" disabled={!stripe || paying} onClick={pay}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60">
        <i className={`ph-bold ${paying ? 'ph-circle-notch animate-spin' : 'ph-lock-simple'}`} aria-hidden /> {paying ? 'Processing…' : `Pay $${amount}`}
      </button>
    </div>
  );
}

// Creates a PaymentIntent for the amount, then mounts Elements with its clientSecret. Re-creates when the
// amount changes (Elements is keyed by clientSecret).
export function StripeTopUp({ amount, onDone }: { amount: number; onDone?: () => void }) {
  const [state, setState] = useState<{ clientSecret: string; piId: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState(null); setError('');
    if (!(amount > 0)) return;
    createTopUpIntentAction(amount).then((r) => {
      if (cancelled) return;
      if (r.ok) setState({ clientSecret: r.clientSecret, piId: r.piId });
      else setError(r.error);
    });
    return () => { cancelled = true; };
  }, [amount]);

  if (error) return <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>;
  if (!state) return <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><i className="ph-bold ph-circle-notch animate-spin" aria-hidden /> Loading secure payment…</p>;

  return (
    <div className="mt-4">
      <Elements stripe={getStripe()} options={{ clientSecret: state.clientSecret, appearance: { theme: 'stripe' } }}>
        <PayForm amount={amount} piId={state.piId} onDone={onDone} />
      </Elements>
    </div>
  );
}
