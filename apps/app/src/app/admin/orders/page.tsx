import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { StatusFilter } from './StatusFilter';
import { ORDERS, money, type AdminOrder, type OrderStatus } from '@/data/adminMock';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const rows = status ? ORDERS.filter((o) => o.status === status) : ORDERS;
  const counts = ORDERS.reduce<Partial<Record<OrderStatus, number>>>((a, o) => ({ ...a, [o.status]: (a[o.status] ?? 0) + 1 }), {});

  const columns: Column<AdminOrder>[] = [
    { key: 'code', header: 'Code', render: (o) => <span className="font-medium">{o.code}</span> },
    { key: 'customer', header: 'Customer', render: (o) => o.customer },
    { key: 'service', header: 'Service', render: (o) => <>{o.service} · <span className="text-muted-foreground">{o.pkg}</span></> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'priority', header: 'Priority', render: (o) => <PriorityBadge priority={o.priority} /> },
    { key: 'staff', header: 'Staff', render: (o) => o.staff ?? <span className="text-muted-foreground">—</span> },
    { key: 'value', header: 'Value', align: 'right', render: (o) => money(o.value) },
  ];

  return (
    <section>
      <PageHeader title="Orders" subtitle={`${rows.length} order${rows.length === 1 ? '' : 's'}`} />
      <StatusFilter counts={counts} />
      <DataTable columns={columns} rows={rows} onRowHref={(o) => `/admin/orders/${o.id}`} />
    </section>
  );
}
