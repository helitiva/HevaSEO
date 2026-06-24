import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { PriorityBadge } from '@/components/admin/StatBadge';
import { TICKETS, type AdminTicket } from '@/data/adminMock';

const TONE: Record<string, string> = { open: 'pill-warn', pending: 'pill', resolved: 'pill-live', closed: 'pill' };

export default function TicketsPage() {
  const columns: Column<AdminTicket>[] = [
    { key: 'subject', header: 'Subject', render: (t) => <span className="font-medium">{t.subject}</span> },
    { key: 'customer', header: 'Customer', render: (t) => t.customer },
    { key: 'status', header: 'Status', render: (t) => <span className={`pill ${TONE[t.status]}`}>{t.status}</span> },
    { key: 'priority', header: 'Priority', render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: 'assignee', header: 'Assignee', render: (t) => t.assignee ?? <span className="text-muted-foreground">—</span> },
    { key: 'age', header: 'Age', align: 'right', render: (t) => t.age },
  ];
  return (
    <section>
      <PageHeader title="Tickets" subtitle={`${TICKETS.length} support tickets`} />
      <DataTable columns={columns} rows={TICKETS} />
    </section>
  );
}
