import { SKILL_META, MANAGERS } from '@/data/adminMock';
import { StaffClient } from './StaffClient';
import { buildStaffVMs, buildManagerVMs } from './build';
import { getStaff } from '@/data/staff.server';
import { getOrders } from '@/data/orders.server';

export const metadata = { title: 'Staff' };

export default async function StaffPage() {
  const [staff, orders] = await Promise.all([getStaff(), getOrders()]); // RLS-scoped real reads
  return <StaffClient initialStaff={buildStaffVMs(staff, orders)} managers={buildManagerVMs(MANAGERS)} skillMeta={SKILL_META} />;
}
