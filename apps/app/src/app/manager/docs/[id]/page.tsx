import { notFound } from 'next/navigation';
import { getDocs } from '@/data/docs.server';
import { DocArticle } from '@/app/staff/docs/DocArticle';

export const metadata = { title: 'Document' };

// Lane C inc-C3 — real: getDocs is array-RLS-scoped to the manager audience → notFound otherwise.
export default async function ManagerDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = (await getDocs()).find((d) => d.id === id);
  if (!doc) notFound();
  return <DocArticle doc={doc} backHref="/manager/docs" />;
}
