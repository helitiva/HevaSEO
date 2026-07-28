import { STAFF, TIER } from '@/data/adminMock';
import { TicketsClient } from './TicketsClient';
import { buildTicketRows } from './rows';
import { getAgentTicketsAction } from './actions';

export const metadata = { title: 'Tickets' };

export default async function TicketsPage() {
  const staff = STAFF.filter((s) => s.active).map((s) => s.name);
  const tickets = await getAgentTicketsAction(); // real customer tickets (RLS: admin all / staff assigned)
  return <TicketsClient rows={buildTicketRows(tickets)} avgFirstResponseH={1.8} staff={staff} tierMeta={TIER} agent="Mai T." />;
}
