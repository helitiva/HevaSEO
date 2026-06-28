import { PageHeader } from '@/components/shared/PageHeader';
import { DocComposer } from '@/components/docs/DocComposer';

export default async function AdminDocEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section>
      <PageHeader title="Edit doc" subtitle="Update the content or change who receives it" />
      <DocComposer editId={id} />
    </section>
  );
}
