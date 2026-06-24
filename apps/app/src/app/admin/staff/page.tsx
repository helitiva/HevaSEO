import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { STAFF, type AdminStaff } from '@/data/adminMock';

export default function StaffPage() {
  const columns: Column<AdminStaff>[] = [
    { key: 'name', header: 'Staff', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'skills', header: 'Skills', render: (s) => <span className="flex flex-wrap gap-1">{s.skills.map((k) => <span key={k} className="pill pill-good">{k}</span>)}</span> },
    { key: 'load', header: 'Load', render: (s) => <span>{s.openLoad}/{s.capacity}</span> },
    { key: 'composite', header: 'Score', align: 'right', render: (s) => <span className="display font-bold text-primary">{s.composite}</span> },
    { key: 'onTime', header: 'On-time', align: 'right', render: (s) => `${s.onTime}%` },
    { key: 'throughput', header: 'Done', align: 'right', render: (s) => s.throughput },
  ];
  return (
    <section>
      <PageHeader title="Staff" subtitle={`${STAFF.length} members`} />
      <DataTable columns={columns} rows={STAFF} onRowHref={(s) => `/admin/staff/${s.id}`} />
    </section>
  );
}
