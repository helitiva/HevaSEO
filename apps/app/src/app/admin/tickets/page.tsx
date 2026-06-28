import { TICKETS, STAFF, TIER } from '@/data/adminMock';
import { TicketsClient } from './TicketsClient';
import { buildTicketRows } from './rows';

export const metadata = { title: 'Tickets' };

export default function TicketsPage() {
  const staff = STAFF.filter((s) => s.active).map((s) => s.name);
  return <TicketsClient rows={buildTicketRows(TICKETS)} avgFirstResponseH={1.8} staff={staff} tierMeta={TIER} agent="Mai T." />;
}
