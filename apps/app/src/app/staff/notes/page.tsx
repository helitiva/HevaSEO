import { PageHeader } from '@/components/shared/PageHeader';
import { NotesClient } from './NotesClient';

// Personal notebook — private to the signed-in staffer. Rich notes with images, links and
// YouTube videos, organised by category + labels. Phase 0: seeded mock + client-side CRUD.
export default function NotesPage() {
  return (
    <section>
      <PageHeader title="Notes" subtitle="Your private notebook — snippets, ideas, images, links & videos" />
      <NotesClient />
    </section>
  );
}
