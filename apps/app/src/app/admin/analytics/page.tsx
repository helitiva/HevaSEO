import { PageHeader } from '@/components/admin/PageHeader';
import { ORDERS, money } from '@/data/adminMock';

export default function AnalyticsPage() {
  const byService = Object.entries(ORDERS.reduce<Record<string, number>>((a, o) => ({ ...a, [o.service]: (a[o.service] ?? 0) + o.value }), {}));
  const max = Math.max(...byService.map(([, v]) => v), 1);
  const revWeek = [820, 1240, 980, 1510, 1320, 1740, 1610];
  const maxWeek = Math.max(...revWeek);
  return (
    <section>
      <PageHeader title="Analytics" subtitle="Revenue & service performance" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Revenue (last 7 days)</p>
          <div className="flex h-40 items-end gap-2">
            {revWeek.map((v, i) => <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${(v / maxWeek) * 100}%` }} title={money(v)} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Revenue by service</p>
          <div className="space-y-2">
            {byService.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-xs"><span>{name}</span><span className="font-semibold">{money(v)}</span></div>
                <div className="bar mt-1"><i style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
