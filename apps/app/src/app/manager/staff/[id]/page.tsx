import { notFound } from 'next/navigation';
import { SKILL_META, SERVICE_SKILL, TIER } from '@/data/adminMock';
import { buildStaffProfile } from '@/app/admin/staff/[id]/build';
import { StaffProfileClient } from '@/app/admin/staff/[id]/StaffProfileClient';
import { ManagerStaffChat } from '@/components/manager/ManagerStaffChat';
import { getStaff } from '@/data/staff.server';
import { getStaffThread } from '@/data/staffThread.server';

export const metadata = { title: 'Staff profile' };

// Manager staff detail — gated to a REAL staffer in the manager's pod (getStaff is RLS-scoped), money-blind
// (Pay & wallet tab + figures hidden; impersonation view-only). Includes the real manager↔staff chat so the
// manager can message the staffer directly (they see it on their task detail). The rich profile below is
// the mock demo view, shown when a mock profile exists for the id.
export default async function ManagerStaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  const target = staff.find((s) => s.id === id);
  if (!target) notFound();

  const [thread, data] = await Promise.all([getStaffThread(id), Promise.resolve(buildStaffProfile(id))]);

  return (
    <section className="space-y-4">
      <ManagerStaffChat staffId={id} staffName={target.name} initial={thread} />
      {data && (
        <StaffProfileClient
          insight={data.insight} workload={data.workload} teamAvg={data.teamAvg}
          skillMeta={SKILL_META} tierMeta={TIER} serviceSkill={SERVICE_SKILL}
        />
      )}
    </section>
  );
}
