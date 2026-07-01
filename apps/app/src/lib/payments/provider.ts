import 'server-only';

// Payment-provider seam (Phase 2). The money/ledger side is REAL (the `topup` DB fn credits the
// balance); only the card-charge is behind this interface. Today it's a MockProvider that simulates a
// successful charge; swapping in real Stripe later = a StripeProvider implementing the same `charge`
// (its webhook calls the same topup). The top-up server action only credits AFTER `charge` resolves
// ok — mock stands in for Stripe's payment confirmation, so the client can never self-credit.

export type ChargeInput = { amount: number; customerId: string; description: string };
export type ChargeResult = { ok: true; ref: string } | { ok: false; error: string };

export interface PaymentProvider {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
}

// Mock gateway: always "succeeds" except a magic amount used to exercise the decline/rollback path —
// any amount whose cents are .99 simulates a declined card (so a $x.99 top-up tests the error branch).
const mockProvider: PaymentProvider = {
  name: 'mock',
  async charge({ amount }: ChargeInput): Promise<ChargeResult> {
    if (!(amount > 0)) return { ok: false, error: 'Invalid amount.' };
    if (Math.round((amount % 1) * 100) === 99) return { ok: false, error: 'Card declined (simulated).' };
    return { ok: true, ref: `mock_pi_${Math.random().toString(36).slice(2, 12)}` };
  },
};

// Real Stripe in TEST mode. The card never touches our server (PCI-safe): we charge Stripe's built-in
// test payment-method token (pm_card_visa succeeds; pm_card_visaChargeDeclined fails), so this creates a
// genuine test-mode PaymentIntent visible in the Stripe dashboard — no client-side Stripe.js needed.
// Enable with PAYMENTS_PROVIDER=stripe + STRIPE_SECRET_KEY=sk_test_… (keep .99 as the decline shortcut).
const stripeProvider: PaymentProvider = {
  name: 'stripe-test',
  async charge({ amount, description }: ChargeInput): Promise<ChargeResult> {
    if (!(amount > 0)) return { ok: false, error: 'Invalid amount.' };
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { ok: false, error: 'Stripe key not configured.' };
    const declined = Math.round((amount % 1) * 100) === 99; // keep the $x.99 = decline test
    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(key);
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        description,
        payment_method: declined ? 'pm_card_visaChargeDeclined' : 'pm_card_visa',
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });
      return pi.status === 'succeeded' ? { ok: true, ref: pi.id } : { ok: false, error: `Payment ${pi.status}.` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Card declined.' };
    }
  },
};

// One switch point for the whole app. PAYMENTS_PROVIDER=stripe (+ STRIPE_SECRET_KEY) → real Stripe test.
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENTS_PROVIDER === 'stripe' && process.env.STRIPE_SECRET_KEY) return stripeProvider;
  return mockProvider;
}
