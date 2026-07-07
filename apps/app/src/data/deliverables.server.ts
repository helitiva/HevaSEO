import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminDeliverable, DeliverableAsset } from '@/data/adminMock';

// Step 2 inc-5e — real (RLS-scoped) deliverables for the admin Review board. Replaces the DELIVERABLES
// mock. Maps the DB row to AdminDeliverable: staff name via submitter join; kind/fileName/url from the
// files jsonb; note ← summary; reviewedAt/reviewNote from the inc-5e columns. RLS: admin sees all
// (review board is admin); staff see own; customer sees approved.
type DelivRow = {
  id: string; order_id: string; version: number;
  status: AdminDeliverable['status']; summary: string | null;
  files: { kind?: string; fileName?: string | null; url?: string | null }[] | null;
  submitted_at: string; reviewed_at: string | null; review_note: string | null;
  viewed_at: string | null;
  submitter: { name: string | null } | null;
};
const day = (ts: string | null): string | null => (ts ? ts.slice(0, 10) : null);
const DELIV_SELECT =
  'id, order_id, version, status, summary, files, submitted_at, reviewed_at, review_note, viewed_at, submitter:profiles!deliverables_submitter_id_fkey(name)';

function toAdminDeliverable(r: DelivRow): AdminDeliverable {
  const files: DeliverableAsset[] = (Array.isArray(r.files) ? r.files : []).map((f) => ({
    kind: f.kind === 'link' ? 'link' : 'file',
    fileName: f.fileName ?? null,
    url: f.url ?? null,
  }));
  const first = files[0] ?? { kind: 'file' as const, fileName: null, url: null };
  return {
    id: r.id,
    orderId: r.order_id,
    version: r.version,
    kind: first.kind,
    fileName: first.fileName,
    url: first.url,
    files,
    note: r.summary ?? '',
    staff: r.submitter?.name ?? '',
    status: r.status,
    submittedAt: day(r.submitted_at) ?? '',
    reviewedAt: day(r.reviewed_at),
    reviewNote: r.review_note,
    viewedAt: day(r.viewed_at),
  } satisfies AdminDeliverable;
}

export async function getDeliverables(): Promise<AdminDeliverable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('deliverables').select(DELIV_SELECT).returns<DelivRow[]>();
  if (error) throw new Error(`getDeliverables: ${error.message}`);
  return (data ?? []).map(toAdminDeliverable);
}

/** RLS-scoped deliverable versions for a single order (staff → own; manager → pod; admin → all). Used by
 *  the staff task detail so it shows the real submitted work, not the empty mock. */
export async function getOrderDeliverables(orderId: string): Promise<AdminDeliverable[]> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deliverables').select(DELIV_SELECT).eq('order_id', orderId)
    .order('version', { ascending: true }).returns<DelivRow[]>();
  if (error) throw new Error(`getOrderDeliverables: ${error.message}`);
  return (data ?? []).map(toAdminDeliverable);
}
