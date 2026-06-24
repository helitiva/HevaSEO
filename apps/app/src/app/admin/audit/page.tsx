import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { AUDIT, type AuditEntry } from '@/data/adminMock';

export default function AuditPage() {
  const columns: Column<AuditEntry>[] = [
    { key: 'at', header: 'Time', render: (a) => <span className="text-muted-foreground">{a.at}</span> },
    { key: 'actor', header: 'Actor', render: (a) => a.actor },
    { key: 'entity', header: 'Entity', render: (a) => <span className="pill pill-good">{a.entity}</span> },
    { key: 'action', header: 'Action', render: (a) => a.action },
    { key: 'change', header: 'Change', render: (a) => <span className="font-medium">{a.change}</span> },
  ];
  return (
    <section>
      <PageHeader title="Audit log" subtitle="Who did what, when" />
      <DataTable columns={columns} rows={AUDIT} />
    </section>
  );
}
