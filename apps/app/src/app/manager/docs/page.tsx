import { PageHeader } from '@/components/shared/PageHeader';
import { DocsLibrary } from '@/components/docs/DocsLibrary';

export const metadata = { title: 'Docs' };

// Manager knowledge base — docs the admin distributes to managers (or to everyone).
export default function ManagerDocsPage() {
  return (
    <section>
      <PageHeader title="Docs" subtitle="Playbooks & policies published for managers — read-only" />
      <DocsLibrary audience="manager" />
    </section>
  );
}
