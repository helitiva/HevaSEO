import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { WalletEntry, WalletEntryKind } from '@/lib/staffFinance';

// Lane D inc-D1 — the signed-in staffer's real commission wallet (balance + ledger). RLS-scoped: a
// staffer reads only their own staff_wallet + wallet_ledger; managers/customers are money-blind (0
// rows), admins use /admin. Mirrors getMyCredit for the customer side. Credited by post_staff_pay.
type LedgerRow = {
  id: string;
  amount: number | string;
  kind: 'commission' | 'bonus' | 'penalty' | 'payout' | 'adjustment';
  note: string | null;
  created_at: string;
  orders: { code: string } | null;
};

const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

// DB kinds → the UI's WalletEntryKind (adjustment folds into commission for display).
function toKind(k: LedgerRow['kind']): WalletEntryKind {
  return k === 'penalty' || k === 'payout' || k === 'bonus' ? k : 'commission';
}
const DEFAULT_LABEL: Record<WalletEntryKind, string> = {
  commission: 'Commission', bonus: 'Bonus', penalty: 'Penalty', payout: 'Payout',
};

function toEntry(r: LedgerRow): WalletEntry {
  const kind = toKind(r.kind);
  return {
    id: r.id,
    kind,
    label: r.note ?? DEFAULT_LABEL[kind],
    taskCode: r.orders?.code ?? null,
    at: ymd(r.created_at),
    amount: Number(r.amount), // already signed in the ledger (+ earn, − penalty/payout)
  };
}

export async function getMyStaffWallet(): Promise<{ balance: number; ledger: WalletEntry[] }> {
  const supabase = await createClient();
  const [wallet, led] = await Promise.all([
    supabase.from('staff_wallet').select('balance').maybeSingle(),
    supabase.from('wallet_ledger')
      .select('id, amount, kind, note, created_at, orders(code)')
      .order('created_at', { ascending: false })
      .returns<LedgerRow[]>(),
  ]);
  if (wallet.error) throw new Error(`getMyStaffWallet balance: ${wallet.error.message}`);
  if (led.error) throw new Error(`getMyStaffWallet ledger: ${led.error.message}`);
  return {
    balance: wallet.data ? Number(wallet.data.balance) : 0,
    ledger: (led.data ?? []).map(toEntry),
  };
}
