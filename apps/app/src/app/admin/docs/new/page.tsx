import { PageHeader } from '@/components/shared/PageHeader';
import { DocComposer } from '@/components/docs/DocComposer';

export default function AdminDocNewPage() {
  return (
    <section>
      <PageHeader title="New doc" subtitle="Write a doc and choose who receives it" />
      <DocComposer />
    </section>
  );
}
