import { notFound } from 'next/navigation';
import { getDocs } from '@/data/docs.server';
import { DocArticle } from '@/app/staff/docs/DocArticle';

export const metadata = { title: 'Document' };

// Lane C inc-C3 — real: getDocs is array-RLS + skill-gated (JWT skills claim), so a doc the staffer
// can't read isn't in the list → notFound.
export default async function DocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = (await getDocs()).find((d) => d.id === id);
  if (!doc) notFound();
  return <DocArticle doc={doc} backHref="/staff/docs" />;
}
