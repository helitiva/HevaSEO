import { PageHeader } from '@/components/shared/PageHeader';
import { DocsLibrary } from '@/components/docs/DocsLibrary';
import { getDocs } from '@/data/docs.server';

export const metadata = { title: 'Docs' };

// Manager knowledge base — docs the admin distributes to managers (or to everyone).
// Lane C inc-C2: real docs, array-RLS-scoped to the manager audience.
export default async function ManagerDocsPage() {
  const docs = await getDocs();
  return (
    <section>
      <PageHeader title="Docs" subtitle="Playbooks & policies published for managers — read-only" />
      <DocsLibrary audience="manager" docs={docs} />
    </section>
  );
}
