import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CreditTx } from '@/data/mock';

// Lane B inc-B1 — the signed-in customer's real credit (balance + ledger) for the /credit page.
// Replaces the CREDIT_BALANCE/TRANSACTIONS mock. RLS-scoped: a customer reads only their own
// customer_balances + credit_ledger rows (staff/manager are money-blind, admins use /admin). Invoices
// have no table yet → stay mock (Phase 2). Top-up/charge mutations are Stripe Phase 2.
type LedgerRow = {
  amount: number | string;
  kind: 'topup' | 'debit' | 'refund' | 'cancel_fee';
  created_at: string;
  orders: { code: string } | null;
};

const usDate = (ts: string): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
};

function descFor(kind: LedgerRow['kind'], code: string | null): string {
  switch (kind) {
    case 'debit': return code ? `Order ${code}` : 'Order';
    case 'refund': return code ? `Refund · ${code}` : 'Refund';
    case 'cancel_fee': return code ? `Cancellation fee · ${code}` : 'Cancellation fee';
    case 'topup': return 'Top-up';
  }
}

function toCreditTx(r: LedgerRow): CreditTx {
  return {
    date: usDate(r.created_at),
    description: descFor(r.kind, r.orders?.code ?? null),
    type: r.kind === 'debit' ? 'order' : 'topup',
    amount: Number(r.amount),
    status: 'success',
  };
}

export async function getMyCredit(): Promise<{ balance: number; transactions: CreditTx[] }> {
  const supabase = await createClient();
  const [bal, led] = await Promise.all([
    supabase.from('customer_balances').select('balance').maybeSingle(),
    supabase.from('credit_ledger')
      .select('amount, kind, created_at, orders(code)')
      .order('created_at', { ascending: false })
      .returns<LedgerRow[]>(),
  ]);
  if (bal.error) throw new Error(`getMyCredit balance: ${bal.error.message}`);
  if (led.error) throw new Error(`getMyCredit ledger: ${led.error.message}`);
  return {
    balance: bal.data ? Number(bal.data.balance) : 0,
    transactions: (led.data ?? []).map(toCreditTx),
  };
}
