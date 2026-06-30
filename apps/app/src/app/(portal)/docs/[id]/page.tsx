import { notFound } from 'next/navigation';
import { getDocs } from '@/data/docs.server';
import { DocArticle } from '@/app/staff/docs/DocArticle';

export const metadata = { title: 'Document' };

// Lane C inc-C3 — real: getDocs is array-RLS-scoped, so a doc not shared with this customer simply
// isn't in the list → notFound (existence never leaks).
export default async function CustomerDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = (await getDocs()).find((d) => d.id === id);
  if (!doc) notFound();
  return <DocArticle doc={doc} backHref="/docs" />;
}
