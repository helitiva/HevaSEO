import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AdminDeliverable } from '@/data/adminMock';

// Step 2 inc-5e — real (RLS-scoped) deliverables for the admin Review board. Replaces the DELIVERABLES
// mock. Maps the DB row to AdminDeliverable: staff name via submitter join; kind/fileName/url from the
// files jsonb; note ← summary; reviewedAt/reviewNote from the inc-5e columns. RLS: admin sees all
// (review board is admin); staff see own; customer sees approved.
type DelivRow = {
  id: string; order_id: string; version: number;
  status: AdminDeliverable['status']; summary: string | null;
  files: { kind?: string; fileName?: string | null; url?: string | null }[] | null;
  submitted_at: string; reviewed_at: string | null; review_note: string | null;
  submitter: { name: string | null } | null;
};
const day = (ts: string | null): string | null => (ts ? ts.slice(0, 10) : null);

export async function getDeliverables(): Promise<AdminDeliverable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deliverables')
    .select('id, order_id, version, status, summary, files, submitted_at, reviewed_at, review_note, submitter:profiles!deliverables_submitter_id_fkey(name)')
    .returns<DelivRow[]>();
  if (error) throw new Error(`getDeliverables: ${error.message}`);
  return (data ?? []).map((r) => {
    const f = (Array.isArray(r.files) && r.files[0]) || {};
    return {
      id: r.id,
      orderId: r.order_id,
      version: r.version,
      kind: (f.kind === 'link' ? 'link' : 'file'),
      fileName: f.fileName ?? null,
      url: f.url ?? null,
      note: r.summary ?? '',
      staff: r.submitter?.name ?? '',
      status: r.status,
      submittedAt: day(r.submitted_at) ?? '',
      reviewedAt: day(r.reviewed_at),
      reviewNote: r.review_note,
    } satisfies AdminDeliverable;
  });
}
