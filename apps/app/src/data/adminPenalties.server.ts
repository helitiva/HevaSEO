import 'server-only';
import { createClient } from '@/lib/supabase/server';

// Lane D inc-D5 — admin view of staff penalties + the workers who have a wallet (for the apply form).
// Admin RLS sees the whole tenant; manager/customer see nothing.
export type AdminPenalty = {
  id: string;
  staffName: string;
  type: string;
  amount: number;
  detail: string | null;
  status: 'applied' | 'disputed' | 'waived';
  createdAt: string;
};
export type WalletStaff = { profileId: string; name: string };

const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

export async function getPenalties(): Promise<AdminPenalty[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_penalties')
    .select('id, type, amount, detail, status, created_at, profiles:staff_id(name)')
    .order('created_at', { ascending: false })
    .returns<{ id: string; type: string; amount: number | string; detail: string | null; status: string; created_at: string; profiles: { name: string } | null }[]>();
  if (error) throw new Error(`getPenalties: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, staffName: r.profiles?.name ?? 'Staff', type: r.type, amount: Number(r.amount),
    detail: r.detail, status: r.status as AdminPenalty['status'], createdAt: ymd(r.created_at),
  }));
}

// Workers who have a wallet (the only ones a penalty can debit) — for the admin apply dropdown.
export async function getWalletStaff(): Promise<WalletStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_wallet')
    .select('staff_id, profiles:staff_id(name)')
    .returns<{ staff_id: string; profiles: { name: string } | null }[]>();
  if (error) throw new Error(`getWalletStaff: ${error.message}`);
  return (data ?? []).map((r) => ({ profileId: r.staff_id, name: r.profiles?.name ?? 'Staff' }));
}
