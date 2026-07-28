import { notFound } from 'next/navigation';
import { SKILL_META, SERVICE_SKILL, TIER } from '@/data/adminMock';
import { StaffProfileClient } from './StaffProfileClient';
import { buildStaffProfile, buildStaffProfileReal } from './build';
import { getStaff } from '@/data/staff.server';
import { getOrders } from '@/data/orders.server';

export const metadata = { title: 'Staff profile' };

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // mock demo profile first; for a REAL staff (getStaff, uuid id from the real list) build a real-header
  // profile so the admin staff list → profile never 404s (bugfix). notFound only for a genuinely unknown id.
  let data = buildStaffProfile(id);
  if (!data) {
    const [staff, orders] = await Promise.all([getStaff(), getOrders()]);
    const rs = staff.find((s) => s.id === id);
    if (rs) data = buildStaffProfileReal(rs, orders, staff);
  }
  if (!data) notFound();

  return (
    <StaffProfileClient
      insight={data.insight} workload={data.workload} teamAvg={data.teamAvg}
      skillMeta={SKILL_META} tierMeta={TIER} serviceSkill={SERVICE_SKILL}
    />
  );
}
