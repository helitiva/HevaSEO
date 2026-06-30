import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { DocComposer } from '@/components/docs/DocComposer';
import { getDocs } from '@/data/docs.server';

export const metadata = { title: 'Edit doc' };

export default async function AdminDocEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = (await getDocs()).find((d) => d.id === id) ?? null;
  if (!existing) notFound();
  return (
    <section>
      <PageHeader title="Edit doc" subtitle="Update the content or change who receives it" />
      <DocComposer existing={existing} />
    </section>
  );
}
