import { NotesClient } from '@/app/staff/notes/NotesClient';

export const metadata = { title: 'Notes' };

export default function CustomerNotesPage() {
  return (
    <section>
      <header className="mb-5">
        <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your private notebook — ideas, links, and reminders, with labels &amp; categories.</p>
      </header>
      <NotesClient />
    </section>
  );
}
