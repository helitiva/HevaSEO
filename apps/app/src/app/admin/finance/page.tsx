import { PageHeader } from '@/components/admin/PageHeader';
import { KpiTile } from '@/components/admin/KpiTile';
import { KPIS, ORDERS, money } from '@/data/adminMock';

export default function FinancePage() {
  const tx = ORDERS.map((o) => ({ id: o.id, label: `${o.code} · ${o.customer}`, amount: -o.value }));
  return (
    <section>
      <PageHeader title="Finance" subtitle="Revenue, credit & transactions" />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile icon="ph-currency-dollar" label="Revenue today" value={money(KPIS.revenueToday)} tone="good" />
        <KpiTile icon="ph-chart-line-up" label="Revenue MTD" value={money(KPIS.revenueMtd)} tone="good" />
        <KpiTile icon="ph-receipt" label="Outstanding" value={money(420)} tone="warn" />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Recent transactions</p>
        <ul className="divide-y divide-border/60">
          {tx.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2 text-sm">
              <span>{t.label}</span>
              <span className={t.amount < 0 ? 'font-semibold text-foreground' : 'font-semibold text-emerald-500'}>{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
