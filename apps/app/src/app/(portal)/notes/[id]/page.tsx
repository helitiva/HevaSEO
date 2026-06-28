import { NoteFullReader } from '@/app/staff/notes/NoteFullReader';

export const metadata = { title: 'Note' };

export default async function CustomerNoteReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullReader id={id} />;
}
