import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { allRows } from '@/lib/supabase/allRows';

/**
 * Admin's real money movement: the customer credit ledger, plus the payment receipts behind it.
 * Replaces adminMock's TRANSACTIONS/INVOICES, which modelled a business we don't run.
 *
 * THE SHAPE OF THIS BUSINESS: it is 100% PREPAID. A customer tops up a wallet, then spends that
 * credit on orders. Two things follow, and the mock got both backwards:
 *
 *  · There is no accounts receivable. We never deliver work against a promise to pay, so no customer
 *    can owe us anything. `invoices` is a RECEIPT written *after* the provider confirms a charge —
 *    money we already HAVE — not a bill we're waiting on. (See 20260630140000_invoices.sql.)
 *  · A wallet debit is NOT new cash and NOT revenue. The cash arrived at top-up; the debit only
 *    converts credit into a booked order, and revenue waits for delivery (ASC 606, adminRevenue).
 *
 * So this file reports movement, and deliberately never totals a "revenue" column: that number lives
 * in getRevenueBook() and is earned on delivery, not here.
 */

export type LedgerKind = 'topup' | 'debit' | 'refund' | 'cancel_fee';

/** One row of the customer credit ledger — the single source of truth for customer money. */
export interface LedgerEntry {
  id: string;
  at: string;               // ISO
  kind: LedgerKind;
  amount: number;           // signed as stored: + credit in (topup/refund), − credit out (debit/cancel_fee)
  customer: string;
  customerId: string;
  orderCode: string | null;
  reference: string | null; // provider event id, when the movement came from a real charge
}

/** A payment receipt. Issued once money is in — NOT a bill. */
export interface PaymentReceipt {
  id: string;
  number: string;
  at: string;               // ISO
  amount: number;
  status: 'issued' | 'processing' | 'void';
  provider: string;
  providerRef: string | null;
  customer: string;
  customerId: string;
}

type CustomerRef = { id: string; name: string | null; company: string | null } | null;
type LedgerRow = {
  id: string; amount: number | string; kind: LedgerKind; created_at: string;
  stripe_event_id: string | null; customers: CustomerRef; orders: { code: string } | null;
};
type InvoiceRow = {
  id: string; number: string; amount: number | string; status: string; provider: string;
  provider_ref: string | null; created_at: string; customers: CustomerRef;
};

/** Admin lists by company — that's how the customer directory and order cards label them. */
const nameOf = (c: CustomerRef): string => c?.company || c?.name || 'Unknown';

/** A customer's prepaid wallet. `balance` is what we owe them as work; `spend` is what they've used. */
export interface CustomerWallet {
  id: string;
  name: string;
  company: string;
  tier: string;
  balance: number;
  spend: number;        // lifetime credit spent on orders
  lastActive: string | null;
}

const RECEIPT_STATUSES = ['issued', 'processing', 'void'] as const;
function assertStatus(s: string, number: string): PaymentReceipt['status'] {
  if ((RECEIPT_STATUSES as readonly string[]).includes(s)) return s as PaymentReceipt['status'];
  throw new Error(`getPayments: receipt ${number} has unknown status '${s}' — refusing to guess whether this is settled cash. Teach adminLedger about it.`);
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  // Every figure on the Transactions tab is a sum of these rows, so a truncated read would under-report
  // money with a 200 OK. allRows compares the server's exact count to what came back and throws instead.
  const rows = await allRows<LedgerRow>('getLedger', supabase.from('credit_ledger')
    .select('id, amount, kind, created_at, stripe_event_id, customers(id, name, company), orders(code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .returns<LedgerRow[]>());
  return rows.map((r) => ({
    id: r.id,
    at: r.created_at,
    kind: r.kind,
    amount: Number(r.amount) || 0,
    customer: nameOf(r.customers),
    customerId: r.customers?.id ?? '',
    orderCode: r.orders?.code ?? null,
    reference: r.stripe_event_id,
  }));
}

/**
 * Every customer's prepaid wallet, real. The Wallets tab used to render adminMock CUSTOMERS and print
 * "7 customers holding $2,460 in prepaid credit" — twelve lines below a KPI band that (correctly) said
 * $19,728.98. One screen, two answers to "how much do we owe customers".
 *
 * `customer_balances` is a base table maintained by create_order/topup, and getRevenueBook already sums
 * it for `deferred.unspentCredit` — so this tab and that KPI now come from the same rows and cannot
 * drift apart again.
 */
export async function getCustomerWallets(): Promise<CustomerWallet[]> {
  const supabase = await createClient();
  type BalRow = { balance: number | string; customers: (CustomerRef & { tier: string | null; last_active_at: string | null }) | null };
  type SpendRow = { customer_id: string; amount: number | string; kind: LedgerKind };
  const [balData, ledData] = await Promise.all([
    allRows<BalRow>('getCustomerWallets balances', supabase.from('customer_balances')
      .select('balance, customers(id, name, company, tier, last_active_at)', { count: 'exact' })
      .returns<BalRow[]>()),
    allRows<SpendRow>('getCustomerWallets ledger', supabase.from('credit_ledger')
      .select('customer_id, amount, kind', { count: 'exact' })
      .returns<SpendRow[]>()),
  ]);

  // lifetime spend = credit actually consumed by orders. Deliberately NOT "all negative rows": a
  // cancellation fee leaves the wallet too but isn't spend on work.
  const spendBy = new Map<string, number>();
  for (const l of ledData) {
    if (l.kind !== 'debit') continue;
    spendBy.set(l.customer_id, (spendBy.get(l.customer_id) ?? 0) + Math.abs(Number(l.amount) || 0));
  }

  return balData
    .filter((b) => b.customers)
    .map((b) => ({
      id: b.customers!.id,
      name: b.customers!.name ?? 'Customer',
      company: b.customers!.company ?? '',
      tier: b.customers!.tier ?? 'new',
      balance: Number(b.balance) || 0,
      spend: Math.round((spendBy.get(b.customers!.id) ?? 0) * 100) / 100,
      lastActive: b.customers!.last_active_at,
    }))
    .sort((a, b) => b.balance - a.balance || b.spend - a.spend);
}

export async function getPayments(): Promise<PaymentReceipt[]> {
  const supabase = await createClient();
  const rows = await allRows<InvoiceRow>('getPayments', supabase.from('invoices')
    .select('id, number, amount, status, provider, provider_ref, created_at, customers(id, name, company)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .returns<InvoiceRow[]>());
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    at: r.created_at,
    amount: Number(r.amount) || 0,
    // Fail loudly on an unknown status rather than defaulting. Defaulting to 'issued' would silently
    // book an unrecognised row as settled cash — if someone widens the CHECK constraint to add, say,
    // 'failed', every failed charge would start counting as money we hold. That is the exact shape of
    // the AR bug this file exists to undo.
    status: assertStatus(r.status, r.number),
    provider: r.provider,
    providerRef: r.provider_ref,
    customer: nameOf(r.customers),
    customerId: r.customers?.id ?? '',
  }));
}
