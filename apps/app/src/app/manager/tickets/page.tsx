import { PageHeader } from '@/components/shared/PageHeader';
import { TicketsClient } from '@/app/admin/tickets/TicketsClient';
import { buildTicketRows } from '@/app/admin/tickets/rows';
import { TIER } from '@/data/adminMock';
import { managerScope, ticketsForPod, MANAGER_PERSONA } from '@/lib/managerScope';

// Manager Tickets — only tickets for this pod's customers (or assigned to a pod
// member). Same client, money-blind (customer LTV/credit/ledger hidden).
export default function ManagerTicketsPage() {
  const scope = managerScope(MANAGER_PERSONA);
  const rows = buildTicketRows(ticketsForPod(scope));
  const staffNames = scope.staff.filter((s) => s.active).map((s) => s.name);
  return (
    <section className="space-y-4">
      <PageHeader title="Tickets" subtitle={`${rows.length} tickets in your pod`} />
      <TicketsClient rows={rows} avgFirstResponseH={1.8} staff={staffNames} tierMeta={TIER} agent={scope.manager?.name ?? 'Manager'} />
    </section>
  );
}
