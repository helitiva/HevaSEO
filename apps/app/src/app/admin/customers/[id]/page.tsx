import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { StatusBadge } from '@/components/admin/StatBadge';
import { CUSTOMERS, ORDERS, money } from '@/data/adminMock';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) notFound();
  const orders = ORDERS.filter((o) => o.customer === c.company);
  return (
    <section className="max-w-4xl">
      <PageHeader title={c.name} subtitle={`${c.company} · ${c.email}`}
        actions={<button className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold">Adjust credit</button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile icon="ph-coins" label="Total spend (LTV)" value={money(c.spend)} tone="good" />
        <KpiTile icon="ph-wallet" label="Credit balance" value={money(c.balance)} />
        <KpiTile icon="ph-package" label="Orders" value={String(c.orders)} />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Ordered services</p>
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between text-sm">
              <a href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.code} · {o.service}</a>
              <span className="flex items-center gap-2"><StatusBadge status={o.status} /><span>{money(o.value)}</span></span>
            </li>
          ))}
          {orders.length === 0 && <li className="text-sm text-muted-foreground">No orders.</li>}
        </ul>
      </div>
    </section>
  );
}
