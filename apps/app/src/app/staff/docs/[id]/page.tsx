import { notFound } from 'next/navigation';
import { docForStaff } from '@/data/staffDocs';
import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { DocArticle } from '../DocArticle';

export default async function DocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  const doc = docForStaff(id, me?.skills ?? []);

  // Not found OR not permitted for this specialty — treated identically so existence never leaks.
  if (!doc) notFound();

  return <DocArticle doc={doc} backHref="/staff/docs" />;
}
