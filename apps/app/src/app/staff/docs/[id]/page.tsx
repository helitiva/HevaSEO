import { STAFF } from '@/data/adminMock';
import { currentStaffId } from '@/lib/currentStaff';
import { DocReaderClient } from '@/components/docs/DocReaderClient';

export default async function DocReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await currentStaffId();
  const me = STAFF.find((s) => s.id === sid);
  return <DocReaderClient id={id} audience="staff" skills={me?.skills ?? []} backHref="/staff/docs" />;
}
