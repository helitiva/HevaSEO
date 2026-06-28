import { PageHeader } from '@/components/shared/PageHeader';
import { StaffClient } from '@/app/admin/staff/StaffClient';
import { buildStaffVMs, buildManagerVMs } from '@/app/admin/staff/build';
import { SKILL_META } from '@/data/adminMock';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'My staff' };

// Manager Staff — only this manager's pod. Same roster client, money-blind
// (pay/wallet columns hidden) and impersonation is view-only for managers.
export default function ManagerStaffPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const staff = buildStaffVMs(scope.staff);
  const managers = scope.manager ? buildManagerVMs([scope.manager]) : [];
  return (
    <section>
      <PageHeader title="My staff" subtitle={`${staff.length} people in your pod`} />
      <StaffClient initialStaff={staff} managers={managers} skillMeta={SKILL_META} />
    </section>
  );
}
