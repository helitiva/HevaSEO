import 'server-only';
import { createClient } from '@/lib/supabase/server';

// Lane D inc-D4 — admin view of staff withdrawal requests (the staffer-initiated payout_requests).
// Admin RLS sees the whole tenant; manager/customer get nothing. Resolved via resolvePayoutAction.
export type AdminPayoutRequest = {
  id: string;
  staffName: string;
  amount: number;
  status: 'requested' | 'approved' | 'paid' | 'rejected';
  method: string | null;
  requestedAt: string; // YYYY-MM-DD
};

type Row = {
  id: string;
  amount: number | string;
  status: string;
  requested_at: string;
  profiles: { name: string } | null;
  staff_payout_methods: { kind: string; detail: string } | null;
};

const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

export async function getPayoutRequests(): Promise<AdminPayoutRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payout_requests')
    .select('id, amount, status, requested_at, profiles:staff_id(name), staff_payout_methods:method_id(kind, detail)')
    .order('requested_at', { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`getPayoutRequests: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    staffName: r.profiles?.name ?? 'Staff',
    amount: Number(r.amount),
    status: r.status as AdminPayoutRequest['status'],
    method: r.staff_payout_methods ? `${r.staff_payout_methods.kind} · ${r.staff_payout_methods.detail}` : null,
    requestedAt: ymd(r.requested_at),
  }));
}
