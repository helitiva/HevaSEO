import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * The real activity feed, from audit_log — what actually happened in this tenant, newest first.
 * Replaces adminMock's AUDIT, a fixed list of June events that never changed no matter what anyone did.
 *
 * SCOPE: admin only. audit_log's RLS grants SELECT to `current_app_role() = 'admin'` and deliberately
 * has no manager/staff policy (20260629050001_audit.sql), so a manager reading this gets zero rows —
 * /manager/audit stays on the mock until that policy exists. Don't "fix" it by widening this query.
 *
 * The feed is a JOIN done in JS, not SQL: audit_log.entity_id is polymorphic (order / customer / staff),
 * so it carries no foreign key PostgREST could follow. Order codes are resolved from a second read.
 */

export interface AuditEvent {
  id: string;
  at: string;      // ISO
  actor: string;
  action: string;
  change: string;  // human sentence, already resolved
  icon: string;
}

type LogRow = {
  id: string; action: string; entity_type: string; entity_id: string | null;
  meta: Record<string, unknown> | null; created_at: string; seq: number; profiles: { name: string | null } | null;
};

/**
 * Icon per real action verb. The mock keyed off four generic verbs; these are the actions we emit.
 *
 * Keep this in step with every writer of audit_log. A missing verb is not cosmetic: it falls through to
 * `describe`'s default, which prints the raw action and the raw entity_type. 'payroll.run' was missing
 * and the Command Center rendered a literal "payroll run · staff" with a dot icon the moment payroll
 * was first run. If you add an `insert into audit_log` anywhere, add it here too.
 */
const ICONS: Record<string, string> = {
  'order.created': 'ph-plus-circle',
  'order.advanced': 'ph-arrows-left-right',
  'order.assign': 'ph-user-plus',
  'order.auto_assign': 'ph-magic-wand',
  'order.message': 'ph-chat-circle',
  'deliverable.submitted': 'ph-upload-simple',
  'deliverable.approve': 'ph-check-circle',
  'deliverable.request_changes': 'ph-arrow-u-down-left',
  'deliverable.edited': 'ph-pencil-simple',
  'credit.topup': 'ph-arrow-circle-down',
  'commission.posted': 'ph-hand-coins',
  'staff.comp_set': 'ph-sliders',
  'payroll.run': 'ph-hand-coins',
};

const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numOf = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * Build the sentence from the action + whatever meta that action actually carries (mostly nothing).
 *
 * `subject` is the human name of the thing acted on — an order CODE, or a customer/staff NAME. It used
 * to resolve orders only, so a customer or staff row fell back to the raw entity_type and the feed said
 * things like "payroll run · staff" and "Wallet topped up" with no clue whose.
 */
function describe(r: LogRow, subject_: string | null): string {
  const subject = subject_ ?? (r.entity_type === 'order' ? 'Order' : r.entity_type);
  const m = r.meta ?? {};
  switch (r.action) {
    case 'payroll.run': {
      const total = numOf(m.total), period = str(m.period);
      const who = subject_ ? ` — ${subject_}` : '';
      return total !== null
        ? `Payroll run${period ? ` ${period}` : ''}${who} · ${money(total)}`
        : `Payroll run${period ? ` ${period}` : ''}${who}`;
    }
    case 'order.created': return `${subject} placed`;
    case 'order.advanced': {
      const from = str(m.from), to = str(m.to);
      const auto = m.auto_review === true ? ' (auto-review)' : '';
      return from && to ? `${subject} ${from} → ${to}${auto}` : `${subject} advanced${auto}`;
    }
    case 'order.assign': return `${subject} assigned`;
    case 'order.auto_assign': return `${subject} auto-assigned`;
    case 'order.message': return `${subject} — new message`;
    case 'deliverable.submitted': return `${subject} deliverable submitted`;
    case 'deliverable.approve': return `${subject} deliverable approved${m.auto_review === true ? ' (auto-review)' : ''}`;
    case 'deliverable.request_changes': return `${subject} changes requested`;
    case 'deliverable.edited': return `${subject} deliverable edited`;
    case 'credit.topup': return subject_ ? `${subject_} topped up their wallet` : 'Wallet topped up';
    case 'commission.posted': return `${subject} commission posted`;
    case 'staff.comp_set': {
      const base = numOf(m.base_salary), pct = numOf(m.commission_pct);
      const who = subject_ ? `${subject_}: ` : '';
      return base !== null && pct !== null ? `${who}pay set — ${money(base)} base + ${pct}%` : `${who}pay set`;
    }
    default: return `${r.action.replace(/[._]/g, ' ')} · ${subject}`;
  }
}

export async function getAuditFeed(limit = 8): Promise<AuditEvent[]> {
  const supabase = await createClient();
  const logRes = await supabase.from('audit_log')
    .select('id, action, entity_type, entity_id, meta, created_at, seq, profiles(name)')
    // seq breaks ties: rows written in one transaction share an identical created_at (Postgres now()
    // is the transaction timestamp), so without it the auto-review chain renders in arbitrary order.
    .order('created_at', { ascending: false })
    .order('seq', { ascending: false })
    .limit(limit)
    .returns<LogRow[]>();
  if (logRes.error) throw new Error(`getAuditFeed: ${logRes.error.message}`);
  const rows = logRes.data ?? [];

  // Resolve a human label per entity — only for the ids these rows actually reference. The first cut
  // selected the whole orders table to label at most 8 events, and unbounded, so PostgREST's max_rows
  // would have started silently dropping the very rows we needed once the table grew past it.
  //
  // entity_id is polymorphic (order / customer / staff), so each type needs its own lookup — resolving
  // orders alone is why a payroll or top-up event had nothing to name and printed its raw entity_type.
  const idsOf = (type: string) =>
    [...new Set(rows.filter((r) => r.entity_type === type && r.entity_id).map((r) => r.entity_id!))];
  const orderIds = idsOf('order'), customerIds = idsOf('customer'), staffIds = idsOf('staff');

  const [ordRes, custRes, staffRes] = await Promise.all([
    orderIds.length ? supabase.from('orders').select('id, code').in('id', orderIds).returns<{ id: string; code: string }[]>() : null,
    customerIds.length ? supabase.from('customers').select('id, name, company').in('id', customerIds).returns<{ id: string; name: string | null; company: string | null }[]>() : null,
    staffIds.length ? supabase.from('profiles').select('id, name').in('id', staffIds).returns<{ id: string; name: string | null }[]>() : null,
  ]);
  if (ordRes?.error) throw new Error(`getAuditFeed orders: ${ordRes.error.message}`);
  if (custRes?.error) throw new Error(`getAuditFeed customers: ${custRes.error.message}`);
  if (staffRes?.error) throw new Error(`getAuditFeed profiles: ${staffRes.error.message}`);

  const label = new Map<string, string>();
  for (const o of ordRes?.data ?? []) label.set(o.id, o.code);
  for (const c of custRes?.data ?? []) label.set(c.id, c.company || c.name || 'Customer');
  for (const p of staffRes?.data ?? []) label.set(p.id, p.name ?? 'Staff');

  return rows.map((r) => ({
    id: r.id,
    at: r.created_at,
    // a system action (auto-assign, commission posting) has no actor_id — say so rather than blaming a person
    actor: r.profiles?.name ?? 'System',
    action: r.action,
    change: describe(r, r.entity_id ? label.get(r.entity_id) ?? null : null),
    icon: ICONS[r.action] ?? 'ph-dot',
  }));
}
