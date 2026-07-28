import { PageHeader } from '@/components/shared/PageHeader';
import { DocsLibrary } from '@/components/docs/DocsLibrary';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { getDocs } from '@/data/docs.server';

export const metadata = { title: 'Docs' };

// Knowledge base. Admin publishes docs to chosen audiences; each staffer sees ONLY the docs for their
// specialty (+ general). The skill-scoping is enforced by RLS server-side (Lane C inc-C2: getDocs reads
// the docs table gated by the JWT `skills` claim) — a backlink writer never receives keyword docs here.
// `skills` is still passed for the banner chips (cosmetic; matches the same staff_details seed).
export default async function DocsPage() {
  const [sid, docs] = await Promise.all([currentStaffId(), getDocs()]);
  const me = STAFF.find((s) => s.id === sid);
  return (
    <section>
      <PageHeader title="Docs" subtitle="Technical docs published for your specialty — read-only" />
      <DocsLibrary audience="staff" skills={me?.skills ?? []} docs={docs} />
    </section>
  );
}
