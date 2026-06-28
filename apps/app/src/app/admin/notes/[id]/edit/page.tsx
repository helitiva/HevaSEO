import { NoteFullEditor } from '@/app/staff/notes/NoteFullEditor';

export const metadata = { title: 'Edit note' };

export default async function AdminNoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullEditor id={id} />;
}
