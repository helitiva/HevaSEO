import { PageHeader } from '@/components/shared/PageHeader';
import { NotesClient } from '@/app/staff/notes/NotesClient';

// Manager's private notebook — same notes feature as staff, but its own storage
// (namespaced by area in notesStore) so a manager's notes are separate from any
// staffer's.
export default function ManagerNotesPage() {
  return (
    <section>
      <PageHeader title="Notes" subtitle="Your private notebook — snippets, ideas, images, links & videos" />
      <NotesClient />
    </section>
  );
}
