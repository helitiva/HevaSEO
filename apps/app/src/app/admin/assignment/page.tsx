import { TIER } from '@/data/adminMock';
import { AssignmentClient } from './AssignmentClient';
import { buildAssignmentProps } from './build';
import { getStaff } from '@/data/staff.server';
import { getOrders } from '@/data/orders.server';
import { getRules } from '@/data/assignmentRules.server';

export const metadata = { title: 'Assignment' };

export default async function AssignmentPage() {
  const [staff, orders, rules] = await Promise.all([getStaff(), getOrders(), getRules()]); // RLS-scoped
  const p = buildAssignmentProps(staff, orders, rules);
  return <AssignmentClient queue={p.queue} assigned={p.assigned} staff={p.staff} rules={p.rules} kpis={p.kpis} tierMeta={TIER} />;
}
