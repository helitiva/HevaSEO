import { PageHeader } from '@/components/shared/PageHeader';
import { DocsClient } from './DocsClient';
import { docsForStaff } from '@/data/staffDocs';
import { STAFF, SKILL_META } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';

// Knowledge base. Admin/managers publish technical docs; each staffer sees ONLY the docs for
// their specialty (+ general). The skill-scoping happens in docsForStaff — a backlink writer
// never receives content docs here.
export default async function DocsPage() {
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  const skills = me?.skills ?? [];
  const docs = docsForStaff(skills);
  const skillChips = skills.map((k) => ({ key: k, ...SKILL_META[k] }));

  return (
    <section>
      <PageHeader
        title="Docs"
        subtitle="Technical docs published for your specialty — read-only"
      />
      <DocsClient docs={docs} skillChips={skillChips} />
    </section>
  );
}
