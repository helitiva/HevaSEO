import { PageHeader } from '@/components/shared/PageHeader';
import { DocsClient } from '@/app/staff/docs/DocsClient';
import { docsForManager } from '@/data/staffDocs';

// Manager knowledge base — docs the admin publishes for managers (`manager`
// audience) plus anything shared with everyone (`general`). Admin decides per-doc
// whether managers and staff overlap. Same client as staff, but no skill chips
// (managers aren't skill-scoped).
export default function ManagerDocsPage() {
  const docs = docsForManager();
  return (
    <section>
      <PageHeader title="Docs" subtitle="Playbooks & policies published for managers — read-only" />
      <DocsClient docs={docs} skillChips={[]} />
    </section>
  );
}
