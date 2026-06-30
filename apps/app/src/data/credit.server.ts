import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CreditTx, Invoice } from '@/data/mock';

// Lane B inc-B1 + Phase 2 inc-P2 — the signed-in customer's real credit (balance + ledger + invoices)
// for the /credit page. Replaces the CREDIT_BALANCE/TRANSACTIONS/INVOICES mock. RLS-scoped: a customer
// reads only their own customer_balances + credit_ledger + invoices rows (staff/manager are money-blind,
// admins use /admin). Top-up writes go through the topUpAction server action (provider seam → topup fn).
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

type InvoiceRow = { number: string; amount: number | string; status: string; created_at: string };

function toInvoice(r: InvoiceRow): Invoice {
  return {
    no: r.number,
    date: usDate(r.created_at),
    amount: Number(r.amount),
    status: r.status === 'processing' ? 'processing' : 'issued',
  };
}

export async function getMyCredit(): Promise<{ balance: number; transactions: CreditTx[]; invoices: Invoice[] }> {
  const supabase = await createClient();
  const [bal, led, inv] = await Promise.all([
    supabase.from('customer_balances').select('balance').maybeSingle(),
    supabase.from('credit_ledger')
      .select('amount, kind, created_at, orders(code)')
      .order('created_at', { ascending: false })
      .returns<LedgerRow[]>(),
    supabase.from('invoices')
      .select('number, amount, status, created_at')
      .order('created_at', { ascending: false })
      .returns<InvoiceRow[]>(),
  ]);
  if (bal.error) throw new Error(`getMyCredit balance: ${bal.error.message}`);
  if (led.error) throw new Error(`getMyCredit ledger: ${led.error.message}`);
  if (inv.error) throw new Error(`getMyCredit invoices: ${inv.error.message}`);
  return {
    balance: bal.data ? Number(bal.data.balance) : 0,
    transactions: (led.data ?? []).map(toCreditTx),
    invoices: (inv.data ?? []).map(toInvoice),
  };
}
