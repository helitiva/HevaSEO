import { SKILL_META, MANAGERS } from '@/data/adminMock';
import { StaffClient } from './StaffClient';
import { buildStaffVMs, buildManagerVMs } from './build';
import { getStaff, getStaffManagers } from '@/data/staff.server';
import { getOrders } from '@/data/orders.server';
import { getPayrollPreview } from '@/data/adminComp.server';

export const metadata = { title: 'Staff' };

export default async function StaffPage() {
  // Pay and pod come from the REAL sources. They used to be derived by rosterSignals(), which looks the
  // person up in the adminMock roster by id — but these are real UUIDs and the mock ids are s1..s6, so
  // it missed every time and quietly fell back to 0/null. The page showed "$0/mo" for the whole team
  // and no manager on any card, while Finance — same people, real tables — showed $1,029.60 and a
  // populated pod. Two admin pages, same question, opposite answers.
  const [staff, orders, payroll, managers] = await Promise.all([
    getStaff(), getOrders(), getPayrollPreview(), getStaffManagers(),
  ]);
  // What this period has accrued for each person — the same figure Finance's "Payouts due" builds from.
  const pay = new Map(payroll.lines.map((l) => [l.profileId, l.total]));
  return (
    <StaffClient
      initialStaff={buildStaffVMs(staff, orders, pay, managers)}
      managers={buildManagerVMs(MANAGERS)}
      skillMeta={SKILL_META}
    />
  );
}
