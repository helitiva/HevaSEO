import 'server-only';
import { createClient } from '@/lib/supabase/server';

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

export async function getLedger(): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('credit_ledger')
    .select('id, amount, kind, created_at, stripe_event_id, customers(id, name, company), orders(code)')
    .order('created_at', { ascending: false })
    .returns<LedgerRow[]>();
  if (error) throw new Error(`getLedger: ${error.message}`);
  return (data ?? []).map((r) => ({
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

export async function getPayments(): Promise<PaymentReceipt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('invoices')
    .select('id, number, amount, status, provider, provider_ref, created_at, customers(id, name, company)')
    .order('created_at', { ascending: false })
    .returns<InvoiceRow[]>();
  if (error) throw new Error(`getPayments: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    number: r.number,
    at: r.created_at,
    amount: Number(r.amount) || 0,
    status: (r.status === 'processing' || r.status === 'void') ? r.status : 'issued',
    provider: r.provider,
    providerRef: r.provider_ref,
    customer: nameOf(r.customers),
    customerId: r.customers?.id ?? '',
  }));
}
