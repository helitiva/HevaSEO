import { PageHeader } from '@/components/shared/PageHeader';
import { AssignmentClient } from '@/app/admin/assignment/AssignmentClient';
import { buildAssignmentProps } from '@/app/admin/assignment/build';
import { TIER } from '@/data/adminMock';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager Assignment — routes from the shared unassigned queue, but candidates
// and in-flight workload are limited to this manager's pod. Money-blind.
export default function ManagerAssignmentPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const p = buildAssignmentProps(scope.staff);
  return (
    <section className="space-y-4">
      <PageHeader title="Assignment" subtitle="Route work to your pod" />
      <AssignmentClient queue={p.queue} assigned={p.assigned} staff={p.staff} rules={p.rules} kpis={p.kpis} tierMeta={TIER} />
    </section>
  );
}
