import { NoteFullEditor } from '../../NoteFullEditor';

export const metadata = { title: 'Edit note' };

export default async function NoteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteFullEditor id={id} />;
}
