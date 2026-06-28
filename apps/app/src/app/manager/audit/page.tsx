import { PageHeader } from '@/components/shared/PageHeader';
import { AuditView } from '@/app/admin/audit/AuditView';
import { AUDIT } from '@/data/adminMock';
import { managerScope, auditInPod, MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'Audit log' };

// Manager Audit log — the same view, scoped to events that touch this pod's
// staff, customers or orders.
export default function ManagerAuditPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const events = AUDIT.filter((e) => auditInPod(scope, e));
  return (
    <section className="space-y-4">
      <PageHeader title="Audit log" subtitle="Activity across your pod’s staff, customers & orders" />
      <AuditView source={events} />
    </section>
  );
}
