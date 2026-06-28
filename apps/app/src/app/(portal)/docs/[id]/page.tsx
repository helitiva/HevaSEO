import { DocReaderClient } from '@/components/docs/DocReaderClient';

export default async function CustomerDocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocReaderClient id={id} audience="customer" backHref="/docs" />;
}
