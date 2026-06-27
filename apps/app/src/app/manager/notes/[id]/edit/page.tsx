import { NoteFullEditor } from '@/app/staff/notes/NoteFullEditor';

export default async function ManagerNoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullEditor id={id} />;
}
