import { TIER } from '@/data/adminMock';
import { AssignmentClient } from './AssignmentClient';
import { buildAssignmentProps } from './build';

export default function AssignmentPage() {
  const p = buildAssignmentProps();
  return <AssignmentClient queue={p.queue} assigned={p.assigned} staff={p.staff} rules={p.rules} kpis={p.kpis} tierMeta={TIER} />;
}
