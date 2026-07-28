import 'server-only';
import { createClient } from '@/lib/supabase/server';

// Real "Recent activity" for the customer overview — derived from the tables the customer can read
// (orders, credit ledger, tickets); audit_log is admin-only. Merged + sorted, newest first.
export type ActivityItem = { icon: string; html: string; meta: string };

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const rel = (iso: string): string => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type Ev = { ts: string; icon: string; html: string };

export async function getMyActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const [ordersRes, ledgerRes, ticketsRes] = await Promise.all([
    supabase.from('orders').select('code, service, state, created_at, delivered_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('credit_ledger').select('amount, kind, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('tickets').select('code, subject, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  const ev: Ev[] = [];
  for (const o of ordersRes.data ?? []) {
    ev.push({ ts: o.created_at, icon: 'ph-package', html: `Order <b>${esc(o.code)}</b> placed · ${esc(o.service)}` });
    if (o.delivered_at) ev.push({ ts: o.delivered_at, icon: 'ph-check-circle', html: `<b>${esc(o.code)}</b> delivered — ready for your review` });
  }
  for (const l of ledgerRes.data ?? []) {
    const amt = Number(l.amount);
    if (l.kind === 'topup') ev.push({ ts: l.created_at, icon: 'ph-wallet', html: `Topped up <b>$${Math.abs(amt).toLocaleString('en-US')}</b> credit` });
    else if (l.kind === 'debit') ev.push({ ts: l.created_at, icon: 'ph-shopping-cart', html: `Charged <b>$${Math.abs(amt).toLocaleString('en-US')}</b> for an order` });
    else if (l.kind === 'refund') ev.push({ ts: l.created_at, icon: 'ph-arrow-counter-clockwise', html: `Refunded <b>$${Math.abs(amt).toLocaleString('en-US')}</b> to credit` });
  }
  for (const t of ticketsRes.data ?? []) {
    ev.push({ ts: t.created_at, icon: 'ph-lifebuoy', html: `Ticket <b>#${esc(t.code)}</b> opened · ${esc(t.subject)}` });
  }

  return ev
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 8)
    .map((e) => ({ icon: e.icon, html: e.html, meta: rel(e.ts) }));
}
