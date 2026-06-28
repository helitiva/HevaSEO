import { PageHeader } from '@/components/shared/PageHeader';
import { NotesClient } from '@/app/staff/notes/NotesClient';

export const metadata = { title: 'Notes' };

// Admin's own private notebook — separate storage from staff/manager/customer notes.
export default function AdminNotesPage() {
  return (
    <section>
      <PageHeader title="Notes" subtitle="Your private notebook — snippets, ideas, images, links & videos" />
      <NotesClient />
    </section>
  );
}
