import { PageHeader } from '@/components/shared/PageHeader';
import { DocsLibrary } from '@/components/docs/DocsLibrary';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';

// Knowledge base. Admin publishes docs to chosen audiences; each staffer sees ONLY the
// docs for their specialty (+ general). The skill-scoping happens in the data-layer gate
// (docsForStaff) — a backlink writer never receives content docs here.
export default async function DocsPage() {
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  return (
    <section>
      <PageHeader title="Docs" subtitle="Technical docs published for your specialty — read-only" />
      <DocsLibrary audience="staff" skills={me?.skills ?? []} />
    </section>
  );
}
