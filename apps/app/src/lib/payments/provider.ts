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

// One switch point for the whole app. PAYMENTS_PROVIDER=stripe (+ a StripeProvider) flips it later.
export function getPaymentProvider(): PaymentProvider {
  return mockProvider;
}
