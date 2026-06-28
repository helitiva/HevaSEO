import { notFound } from 'next/navigation';
import { SKILL_META, SERVICE_SKILL, TIER } from '@/data/adminMock';
import { StaffProfileClient } from './StaffProfileClient';
import { buildStaffProfile } from './build';

export const metadata = { title: 'Staff profile' };

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = buildStaffProfile(id);
  if (!data) notFound();

  return (
    <StaffProfileClient
      insight={data.insight} workload={data.workload} teamAvg={data.teamAvg}
      skillMeta={SKILL_META} tierMeta={TIER} serviceSkill={SERVICE_SKILL}
    />
  );
}
