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

/** Icon per real action verb. The mock keyed off four generic verbs; these are the actions we emit. */
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
};

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numOf = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Build the sentence from the action + whatever meta that action actually carries (mostly nothing). */
function describe(r: LogRow, code: string | null): string {
  const subject = code ?? (r.entity_type === 'order' ? 'Order' : r.entity_type);
  const m = r.meta ?? {};
  switch (r.action) {
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
    case 'credit.topup': return 'Wallet topped up';
    case 'commission.posted': return `${subject} commission posted`;
    case 'staff.comp_set': {
      const base = numOf(m.base_salary), pct = numOf(m.commission_pct);
      return base !== null && pct !== null ? `Pay set — $${base} base + ${pct}%` : 'Pay set';
    }
    default: return `${r.action.replace(/[._]/g, ' ')} · ${subject}`;
  }
}

export async function getAuditFeed(limit = 8): Promise<AuditEvent[]> {
  const supabase = await createClient();
  const [logRes, ordersRes] = await Promise.all([
    supabase.from('audit_log')
      .select('id, action, entity_type, entity_id, meta, created_at, seq, profiles(name)')
      // seq breaks ties: rows written in one transaction share an identical created_at (Postgres now()
      // is the transaction timestamp), so without it the auto-review chain renders in arbitrary order.
      .order('created_at', { ascending: false })
      .order('seq', { ascending: false })
      .limit(limit)
      .returns<LogRow[]>(),
    supabase.from('orders').select('id, code').returns<{ id: string; code: string }[]>(),
  ]);
  if (logRes.error) throw new Error(`getAuditFeed: ${logRes.error.message}`);
  if (ordersRes.error) throw new Error(`getAuditFeed orders: ${ordersRes.error.message}`);

  const codeById = new Map((ordersRes.data ?? []).map((o) => [o.id, o.code]));
  return (logRes.data ?? []).map((r) => ({
    id: r.id,
    at: r.created_at,
    // a system action (auto-assign, commission posting) has no actor_id — say so rather than blaming a person
    actor: r.profiles?.name ?? 'System',
    action: r.action,
    change: describe(r, r.entity_id ? codeById.get(r.entity_id) ?? null : null),
    icon: ICONS[r.action] ?? 'ph-dot',
  }));
}
