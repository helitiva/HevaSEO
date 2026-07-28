import { PageHeader } from '@/components/shared/PageHeader';
import { TicketsClient } from '@/app/admin/tickets/TicketsClient';
import { buildTicketRows } from '@/app/admin/tickets/rows';
import { getAgentTicketsAction } from '@/app/admin/tickets/actions';
import { TIER } from '@/data/adminMock';
import { getStaff } from '@/data/staff.server';
import { managerScope, MANAGER_PERSONA } from '@/lib/managerScope';

export const metadata = { title: 'Tickets' };

// Manager Tickets — REAL customer tickets, tenant-scoped + money-blind via RLS (tickets_manager_pod,
// see 20260703000000). getAgentTicketsAction reads RLS-scoped, so a manager gets their tenant's tickets
// with the full message thread; replies go through post_ticket_message (managers are now participants).
export default async function ManagerTicketsPage() {
  const [tickets, staff] = await Promise.all([getAgentTicketsAction(), getStaff()]);
  const rows = buildTicketRows(tickets);
  const staffNames = staff.map((s) => s.name); // real pod staff (RLS-scoped) for the assign picker
  const agent = managerScope(MANAGER_PERSONA).manager?.name ?? 'Manager';
  return (
    <section className="space-y-4">
      <PageHeader title="Tickets" subtitle={`${rows.length} tickets in your pod`} />
      <TicketsClient rows={rows} avgFirstResponseH={1.8} staff={staffNames} tierMeta={TIER} agent={agent} />
    </section>
  );
}
