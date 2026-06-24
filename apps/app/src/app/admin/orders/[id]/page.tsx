import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, AUDIT, money } from '@/data/adminMock';

const NEXT: Record<string, string[]> = { new: ['Confirm','Cancel'], confirmed: ['Assign','Cancel'], assigned: ['Start'], in_progress: ['Internal review'], internal_review: ['Deliver'], delivered: ['Approve','Request changes'], approved: ['Complete'] };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === id);
  if (!order) notFound();
  const actions = NEXT[order.status] ?? [];

  return (
    <section className="max-w-3xl">
      <PageHeader title={order.code} subtitle={`${order.service} · ${order.pkg} · ${money(order.value)} · ${order.source}`}
        actions={<><PriorityBadge priority={order.priority} /><StatusBadge status={order.status} /></>} />

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Actions</p>
        <div className="flex flex-wrap gap-2">
          {actions.length ? actions.map((a) => (
            <button key={a} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{a}</button>
          )) : <span className="text-sm text-muted-foreground">No further actions.</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Customer</p>
          <p className="text-sm">{order.customer}</p>
          <p className="mt-2 text-sm font-semibold">Assigned staff</p>
          <p className="text-sm text-muted-foreground">{order.staff ?? 'Unassigned'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Deliverables</p>
          <p className="text-sm text-muted-foreground">No deliverables yet (module 4).</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Activity</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {AUDIT.filter((a) => a.change.startsWith(order.code)).map((a) => <li key={a.id}>{a.at} — {a.action}: {a.change}</li>)}
        </ul>
      </div>
    </section>
  );
}
