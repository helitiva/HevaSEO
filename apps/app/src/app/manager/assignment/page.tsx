import { PageHeader } from '@/components/shared/PageHeader';
import { AssignmentClient } from '@/app/admin/assignment/AssignmentClient';
import { buildAssignmentProps } from '@/app/admin/assignment/build';
import { TIER } from '@/data/adminMock';
import { getStaff } from '@/data/staff.server';
import { getPodOrders, getOrderDetailsByIds } from '@/data/orders.server';
import { getRules } from '@/data/assignmentRules.server';

export const metadata = { title: 'Assignment' };

// Manager Assignment — the REAL pod queue: unassigned + pod orders via the money-stripped orders_mgr
// view, routed to pod staff. RLS scopes the reads to this manager's pod; assign_order permits
// pod-scoped manager assignment. (Previously this rendered mock data and never showed real orders.)
export default async function ManagerAssignmentPage() {
  const [staff, orders, rules] = await Promise.all([getStaff(), getPodOrders(), getRules()]);
  const details = await getOrderDetailsByIds(orders.map((o) => o.id));
  const p = buildAssignmentProps(staff, orders, rules, details);
  return (
    <section className="space-y-4">
      <PageHeader title="Assignment" subtitle="Route work to your pod" />
      <AssignmentClient queue={p.queue} assigned={p.assigned} staff={p.staff} rules={p.rules} kpis={p.kpis} tierMeta={TIER} />
    </section>
  );
}
