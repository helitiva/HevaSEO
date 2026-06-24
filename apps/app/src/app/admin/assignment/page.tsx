import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { RULES, STAFF, type AdminRule } from '@/data/adminMock';

export default function AssignmentPage() {
  const columns: Column<AdminRule>[] = [
    { key: 'service', header: 'Service', render: (r) => <span className="font-medium">{r.service}{r.pkg ? ` · ${r.pkg}` : ''}</span> },
    { key: 'mode', header: 'Mode', render: (r) => <span className={`pill ${r.mode === 'pin' ? 'pill-warn' : 'pill-good'}`}>{r.mode}</span> },
    { key: 'target', header: 'Target', render: (r) => r.target ?? <span className="text-muted-foreground">skill pool</span> },
    { key: 'priority', header: 'Priority', align: 'right', render: (r) => r.priority },
    { key: 'active', header: '', align: 'right', render: (r) => <span className={`pill ${r.active ? 'pill-live' : 'pill'}`}>{r.active ? 'on' : 'off'}</span> },
  ];
  return (
    <section>
      <PageHeader title="Assignment" subtitle="Routing rules & staff workload"
        actions={<button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">New rule</button>} />
      <DataTable columns={columns} rows={RULES} />
      <p className="mb-3 mt-6 text-sm font-semibold">Workload</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAFF.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><span className="font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.openLoad}/{s.capacity}</span></div>
            <div className="mt-2 bar"><i style={{ width: `${(s.openLoad / s.capacity) * 100}%` }} /></div>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.skills.join(', ')}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
