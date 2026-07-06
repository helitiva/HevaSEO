'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { loadStripe, type Stripe, type Appearance } from '@stripe/stripe-js';
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

// Stripe's own appearance panel has no light/dark switch, so we drive it from the app's theme. We can't
// read the CSS tokens off the DOM at render time — next-themes flips the `.dark` class in a post-render
// effect, so getComputedStyle races and returns the wrong palette. Instead we pre-bake two static
// appearances from the same @heva/ui/tokens.css values (hex — Stripe rejects space-separated hsl() and
// silently drops the whole appearance if any value is invalid). Keep these in sync with tokens.css.
function hslTripleToHex(h: number, s: number, l: number): string {
  const sN = s / 100, lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const ch = (n: number) => lN - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - (n + h / 30) % 12, 1));
  const hex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${hex(ch(0))}${hex(ch(8))}${hex(ch(4))}`;
}
const LIGHT_APPEARANCE: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: hslTripleToHex(213, 90, 50),
    colorBackground: '#ffffff',
    colorText: hslTripleToHex(222, 47, 9),
    colorDanger: hslTripleToHex(0, 72, 51),
    borderRadius: '0.6rem',
  },
};
const DARK_APPEARANCE: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: hslTripleToHex(213, 92, 64),
    colorBackground: hslTripleToHex(240, 7, 10),   // --card (dark)
    colorText: hslTripleToHex(0, 0, 98),
    colorTextSecondary: hslTripleToHex(240, 6, 72),
    colorDanger: hslTripleToHex(0, 70, 55),
    borderRadius: '0.6rem',
  },
  rules: { '.Input': { border: `1px solid ${hslTripleToHex(240, 6, 23)}` } }, // --border (dark)
};

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
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<{ clientSecret: string; piId: string } | null>(null);
  const [error, setError] = useState('');
  // static per-theme palette (no DOM read → no race with next-themes' class flip)
  const appearance = resolvedTheme === 'dark' ? DARK_APPEARANCE : LIGHT_APPEARANCE;

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
      {/* key by theme so a light/dark toggle re-mounts Elements with the new appearance (react-stripe-js
          doesn't always apply appearance updates live); same clientSecret → same PaymentIntent. */}
      <Elements key={resolvedTheme ?? 'light'} stripe={getStripe()} options={{ clientSecret: state.clientSecret, appearance }}>
        <PayForm amount={amount} piId={state.piId} onDone={onDone} />
      </Elements>
    </div>
  );
}
