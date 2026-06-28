import { DocReaderClient } from '@/components/docs/DocReaderClient';

// Admin can read any doc in the library (it manages them).
export default async function AdminDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocReaderClient id={id} audience="admin" backHref="/admin/docs" />;
}
