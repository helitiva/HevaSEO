import { notFound } from 'next/navigation';
import { SKILL_META, SERVICE_SKILL, TIER } from '@/data/adminMock';
import { buildStaffProfile } from '@/app/admin/staff/[id]/build';
import { StaffProfileClient } from '@/app/admin/staff/[id]/StaffProfileClient';
import { managerScope, staffInPod, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager staff detail — same profile as admin, but a manager may only open a
// staffer inside their own pod, and the page is money-blind (the Pay & wallet tab
// and all pay figures are hidden; impersonation is view-only). Both enforced by
// the manager ViewerProvider + the pod-ownership guard below.
export default async function ManagerStaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = managerScope(MANAGER_PERSONA);
  if (!staffInPod(scope, id)) notFound();

  const data = buildStaffProfile(id);
  if (!data) notFound();

  return (
    <StaffProfileClient
      insight={data.insight} workload={data.workload} teamAvg={data.teamAvg}
      skillMeta={SKILL_META} tierMeta={TIER} serviceSkill={SERVICE_SKILL}
    />
  );
}
