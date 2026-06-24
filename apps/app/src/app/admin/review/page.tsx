import { PageHeader } from '@/components/admin/PageHeader';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, money } from '@/data/adminMock';

export default function ReviewPage() {
  const queue = ORDERS.filter((o) => o.status === 'delivered' || o.status === 'internal_review');
  return (
    <section>
      <PageHeader title="Review queue" subtitle={`${queue.length} awaiting review`} />
      <div className="space-y-3">
        {queue.map((o) => (
          <div key={o.id} className="kcard flex items-center justify-between">
            <div>
              <a href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.code}</a>
              <p className="text-xs text-muted-foreground">{o.customer} · {o.service} · {o.staff} · {money(o.value)}</p>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={o.priority} /><StatusBadge status={o.status} />
              <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Approve</button>
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">Request changes</button>
            </div>
          </div>
        ))}
        {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
      </div>
    </section>
  );
}
