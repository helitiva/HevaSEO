import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { CUSTOMERS, money, type AdminCustomer } from '@/data/adminMock';

export default function CustomersPage() {
  const columns: Column<AdminCustomer>[] = [
    { key: 'name', header: 'Customer', render: (c) => <><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.company}</span></> },
    { key: 'status', header: 'Status', render: (c) => <span className={`pill ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span> },
    { key: 'orders', header: 'Orders', align: 'right', render: (c) => c.orders },
    { key: 'spend', header: 'Total spend', align: 'right', render: (c) => <span className="font-semibold">{money(c.spend)}</span> },
    { key: 'balance', header: 'Credit', align: 'right', render: (c) => money(c.balance) },
    { key: 'last', header: 'Last active', render: (c) => c.lastActive },
  ];
  return (
    <section>
      <PageHeader title="Customers" subtitle={`${CUSTOMERS.length} accounts`} />
      <DataTable columns={columns} rows={CUSTOMERS} onRowHref={(c) => `/admin/customers/${c.id}`} />
    </section>
  );
}
