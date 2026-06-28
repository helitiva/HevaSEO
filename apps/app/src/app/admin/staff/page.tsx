import { STAFF, SKILL_META, MANAGERS } from '@/data/adminMock';
import { StaffClient } from './StaffClient';
import { buildStaffVMs, buildManagerVMs } from './build';

export const metadata = { title: 'Staff' };

export default function StaffPage() {
  return <StaffClient initialStaff={buildStaffVMs(STAFF)} managers={buildManagerVMs(MANAGERS)} skillMeta={SKILL_META} />;
}
