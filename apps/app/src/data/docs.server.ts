import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { StaffDoc, DocAudience, DocBlock, DocFormat, DocResource } from '@/data/staffDocs';

// Lane C inc-C1 — the signed-in user's real docs, array-RLS-scoped: the `docs` table policies return
// only docs distributed to the viewer's role (admin all; customer/manager by audience; staff by
// audience + skill-gate). So this reader does NO filtering — RLS already did. Replaces the docsStore mock.
// The rich metadata (summary/format/tags/author/readMins/blocks/resources) lives in docs.body jsonb;
// the top-level columns (title/audiences/required_skills/pinned) drive RLS + listing.
type DocRow = {
  id: string;
  title: string;
  body: { summary?: string; format?: DocFormat; tags?: string[]; author?: string; readMins?: number; blocks?: DocBlock[]; resources?: DocResource[]; html?: string } | null;
  audiences: string[];
  pinned: boolean;
  updated_at: string;
};

const ymd = (ts: string): string => new Date(ts).toISOString().slice(0, 10);

function toDoc(r: DocRow): StaffDoc {
  const b = r.body ?? {};
  const audiences = (r.audiences ?? []) as DocAudience[];
  return {
    id: r.id,
    title: r.title,
    audience: audiences[0] ?? 'general',
    audiences,
    format: b.format ?? 'guide',
    summary: b.summary ?? '',
    tags: b.tags ?? [],
    author: b.author ?? 'HevaSEO',
    updatedAt: ymd(r.updated_at),
    readMins: b.readMins ?? 3,
    body: b.blocks ?? [],
    html: b.html,
    resources: b.resources ?? [],
    pinned: r.pinned,
    system: true, // DB docs are read-only in the portal (authoring = admin, a later increment)
  };
}

export async function getDocs(): Promise<StaffDoc[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('docs')
    .select('id, title, body, audiences, pinned, updated_at')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .returns<DocRow[]>();
  if (error) throw new Error(`getDocs: ${error.message}`);
  return (data ?? []).map(toDoc);
}
