import { notFound } from 'next/navigation';
import { getDocs } from '@/data/docs.server';
import { DocArticle } from '@/app/staff/docs/DocArticle';

export const metadata = { title: 'Document' };

// Admin can read any doc in the tenant library (docs_admin RLS). Lane C inc-C3 — real.
export default async function AdminDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = (await getDocs()).find((d) => d.id === id);
  if (!doc) notFound();
  return <DocArticle doc={doc} backHref="/admin/docs" />;
}
