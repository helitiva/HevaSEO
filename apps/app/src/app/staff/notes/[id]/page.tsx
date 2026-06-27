import { NoteFullReader } from '../NoteFullReader';

export default async function NoteReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullReader id={id} />;
}
