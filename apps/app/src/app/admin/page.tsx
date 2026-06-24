import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { KPIS, ORDERS, TICKETS, AUDIT, money } from '@/data/adminMock';

export default function CommandCenter() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = ORDERS.filter((o) => o.deadline && o.deadline < today && o.status !== 'completed');
  const awaiting = ORDERS.filter((o) => o.status === 'delivered');
  const unassigned = ORDERS.filter((o) => !o.staff && o.status !== 'completed' && o.status !== 'canceled');

  return (
    <section>
      <PageHeader title="Command Center" subtitle="Live operational snapshot" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-tray" label="New orders" value={String(KPIS.newOrders)} hint="awaiting intake" />
        <KpiTile icon="ph-spinner-gap" label="In progress" value={String(KPIS.inProgress)} />
        <KpiTile icon="ph-warning" label="Overdue" value={String(KPIS.overdue)} tone="warn" />
        <KpiTile icon="ph-seal-check" label="Awaiting approval" value={String(KPIS.awaitingApproval)} />
        <KpiTile icon="ph-currency-dollar" label="Revenue today" value={money(KPIS.revenueToday)} tone="good" />
        <KpiTile icon="ph-chart-line-up" label="Revenue MTD" value={money(KPIS.revenueMtd)} tone="good" />
        <KpiTile icon="ph-lifebuoy" label="Open tickets" value={String(KPIS.openTickets)} />
        <KpiTile icon="ph-user-minus" label="Unassigned" value={String(KPIS.unassigned)} tone="warn" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AttentionCard title="Overdue" href="/admin/orders" rows={overdue} />
        <AttentionCard title="Awaiting approval" href="/admin/review" rows={awaiting} />
        <AttentionCard title="Unassigned" href="/admin/assignment" rows={unassigned} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-scroll text-primary" /> Recent activity</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {AUDIT.map((a) => <li key={a.id}><span className="text-foreground">{a.at}</span> — {a.actor} · {a.change}</li>)}
        </ul>
      </div>
    </section>
  );
}

function AttentionCard({ title, href, rows }: { title: string; href: string; rows: typeof ORDERS }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <Link href={href} className="text-xs font-semibold text-primary hover:underline">View all</Link>
      </div>
      <ul className="space-y-2">
        {rows.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{o.code}</span>
            <span className="flex items-center gap-1.5"><PriorityBadge priority={o.priority} /><StatusBadge status={o.status} /></span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted-foreground">All clear.</li>}
      </ul>
    </div>
  );
}
