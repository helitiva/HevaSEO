import { notFound } from 'next/navigation';
import { docForManager } from '@/data/staffDocs';
import { DocArticle } from '@/app/staff/docs/DocArticle';

// A manager may read manager/general docs only — docForManager gates it, so a
// skill-specialty doc id 404s here exactly like a non-existent one.
export default async function ManagerDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = docForManager(id);
  if (!doc) notFound();

  return <DocArticle doc={doc} backHref="/manager/docs" />;
}
