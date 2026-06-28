import { NoteFullReader } from '../NoteFullReader';

export const metadata = { title: 'Note' };

export default async function NoteReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullReader id={id} />;
}
