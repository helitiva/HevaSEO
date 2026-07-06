import { PageHeader } from '@/components/shared/PageHeader';
import { StaffClient } from '@/app/admin/staff/StaffClient';
import { buildStaffVMs, buildManagerVMs } from '@/app/admin/staff/build';
import { SKILL_META } from '@/data/adminMock';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';
import { getStaff } from '@/data/staff.server';

export const metadata = { title: 'My staff' };

// Manager Staff — REAL staff roster (getStaff is RLS-scoped to the manager's pod, money-blind: pay/wallet
// columns hidden). Impersonation is view-only for managers. The manager's own identity card stays from the
// persona (identity only, not cleared data).
export default async function ManagerStaffPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const staff = buildStaffVMs(await getStaff());
  const managers = scope.manager ? buildManagerVMs([scope.manager]) : [];
  return (
    <section>
      <PageHeader title="My staff" subtitle={`${staff.length} people in your pod`} />
      <StaffClient initialStaff={staff} managers={managers} skillMeta={SKILL_META} />
    </section>
  );
}
