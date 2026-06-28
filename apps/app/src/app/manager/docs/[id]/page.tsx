import { DocReaderClient } from '@/components/docs/DocReaderClient';

export const metadata = { title: 'Document' };

export default async function ManagerDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocReaderClient id={id} audience="manager" backHref="/manager/docs" />;
}
