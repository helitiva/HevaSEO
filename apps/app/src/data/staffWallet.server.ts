import 'server-only';
import { getServerSession, createClient } from '@/lib/supabase/server';
import { METHOD_DEFAULTS } from '@/lib/staffFinance';
import type {
  WalletEntry, WalletEntryKind, PayoutMethod, PayoutMethodKind, PayoutRequest, PayoutStatus,
} from '@/lib/staffFinance';

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

type MethodRow = { id: string; kind: string; detail: string; is_default: boolean };
type RequestRow = { id: string; amount: number | string; method_id: string | null; status: string; requested_at: string };

// DB method kind → UI kind (the UI has no 'crypto' → fold into 'wise').
function toMethodKind(k: string): PayoutMethodKind {
  return k === 'bank' || k === 'paypal' || k === 'wise' ? k : 'wise';
}
function toMethod(r: MethodRow): PayoutMethod {
  const kind = toMethodKind(r.kind);
  return { id: r.id, kind, label: r.detail, isDefault: r.is_default, feePct: METHOD_DEFAULTS[kind].feePct, etaDays: METHOD_DEFAULTS[kind].etaDays };
}
function toRequest(r: RequestRow): PayoutRequest {
  return { id: r.id, amount: Number(r.amount), methodId: r.method_id ?? '', status: r.status as PayoutStatus, requestedAt: ymd(r.requested_at) };
}

export type StaffWallet = { balance: number; ledger: WalletEntry[]; methods: PayoutMethod[]; payouts: PayoutRequest[] };

// Returns the signed-in staffer's own wallet, or `null` when there's no own wallet row — i.e. the
// session isn't a provisioned staffer (admin/impersonation/demo, or a staffer never paid yet) — so the
// page can fall back to the mock. Filtered by the session profile id (own row), which keeps an admin
// session from matching every staffer's row under the admin RLS policy.
export async function getMyStaffWallet(): Promise<StaffWallet | null> {
  const session = await getServerSession();
  if (!session?.entityId) return null;
  const supabase = await createClient();
  const { data: wallet, error: wErr } = await supabase
    .from('staff_wallet').select('balance').eq('staff_id', session.entityId).maybeSingle();
  if (wErr) throw new Error(`getMyStaffWallet balance: ${wErr.message}`);
  if (!wallet) return null;

  const [led, methods, reqs] = await Promise.all([
    supabase.from('wallet_ledger')
      .select('id, amount, kind, note, created_at, orders(code)')
      .eq('staff_id', session.entityId).order('created_at', { ascending: false }).returns<LedgerRow[]>(),
    supabase.from('staff_payout_methods')
      .select('id, kind, detail, is_default').eq('staff_id', session.entityId).returns<MethodRow[]>(),
    supabase.from('payout_requests')
      .select('id, amount, method_id, status, requested_at')
      .eq('staff_id', session.entityId).order('requested_at', { ascending: false }).returns<RequestRow[]>(),
  ]);
  if (led.error) throw new Error(`getMyStaffWallet ledger: ${led.error.message}`);
  if (methods.error) throw new Error(`getMyStaffWallet methods: ${methods.error.message}`);
  if (reqs.error) throw new Error(`getMyStaffWallet payouts: ${reqs.error.message}`);
  return {
    balance: Number(wallet.balance),
    ledger: (led.data ?? []).map(toEntry),
    methods: (methods.data ?? []).map(toMethod),
    payouts: (reqs.data ?? []).map(toRequest),
  };
}
