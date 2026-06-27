import Link from 'next/link';
import { RingStat } from '@/components/admin/RingStat';
import { ORDERS, DELIVERABLES } from '@/data/adminMock';
import { managerScope, ordersForPod, customersForPod, ticketsForPod, MANAGER_PERSONA } from '@/lib/managerScope';

const TODAY = '2026-06-24';
const ACTIVE = new Set(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);

// Manager Command Center — an ops-only snapshot of the manager's pod. No money:
// no revenue, no payroll, no customer spend. Just workload, QA and SLA signals.
export default function ManagerOverview() {
  const scope = managerScope(MANAGER_PERSONA);
  const orders = ordersForPod(scope);
  const customers = customersForPod(scope);
  const tickets = ticketsForPod(scope);

  const active = orders.filter((o) => ACTIVE.has(o.status));
  const overdue = active.filter((o) => o.deadline && o.deadline < TODAY).length;
  const awaitingReview = orders.filter((o) => {
    const v = DELIVERABLES.filter((d) => d.orderId === o.id).sort((a, b) => b.version - a.version)[0];
    return v?.status === 'submitted';
  }).length;
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'pending').length;
  const totalCap = scope.staff.reduce((n, s) => n + s.capacity, 0);
  const load = active.length;
  const util = totalCap ? Math.round((load / totalCap) * 100) : 0;
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Per-member workload, sorted by who is most loaded.
  const roster = scope.staff.map((s) => {
    const mine = active.filter((o) => o.staff === s.name);
    const od = mine.filter((o) => o.deadline && o.deadline < TODAY).length;
    return { ...s, load: mine.length, overdue: od, util: s.capacity ? Math.round((mine.length / s.capacity) * 100) : 0 };
  }).sort((a, b) => b.util - a.util);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">{scope.manager?.name}’s pod</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel} · {scope.staff.length} people · {customers.length} customers</p>
        </div>
        <span className="pill pill-live"><span /> Live</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="ph-stack" label="Active orders" value={String(load)} href="/manager/orders" />
        <Stat icon="ph-warning-circle" label="Overdue" value={String(overdue)} tone={overdue ? 'warn' : 'good'} href="/manager/orders" />
        <Stat icon="ph-seal-check" label="Awaiting review" value={String(awaitingReview)} href="/manager/review" />
        <Stat icon="ph-lifebuoy" label="Open tickets" value={String(openTickets)} tone={openTickets ? 'warn' : 'good'} href="/manager/tickets" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Team workload</h2>
            <Link href="/manager/staff" className="text-xs font-semibold text-primary hover:underline">My staff →</Link>
          </div>
          <div className="space-y-2">
            {roster.map((s) => (
              <Link key={s.id} href={`/manager/staff/${s.id}`} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 transition hover:border-primary/50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">{s.name}{!s.active && <span className="pill pill-warn">paused</span>}{s.overdue > 0 && <span className="pill pill-warn"><i className="ph-bold ph-warning" aria-hidden />{s.overdue} overdue</span>}</span>
                  <span className="text-[11px] text-muted-foreground">{s.role}</span>
                </span>
                <span className="w-32 shrink-0">
                  <span className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{s.load}/{s.capacity}</span><span className={s.util >= 90 ? 'font-semibold text-amber-600' : ''}>{s.util}%</span></span>
                  <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.min(s.util, 100)}%`, background: s.util >= 90 ? '#f59e0b' : 'hsl(var(--primary))' }} /></span>
                </span>
              </Link>
            ))}
            {roster.length === 0 && <p className="text-sm text-muted-foreground">No staff in this pod yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Pod utilization</h2>
          <div className="flex flex-col items-center gap-2 py-2">
            <RingStat pct={util} />
            <p className="text-center text-xs text-muted-foreground">{load} of {totalCap} slots in use across {scope.staff.length} people</p>
          </div>
          <Link href="/manager/assignment" className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-flow-arrow" aria-hidden />Route work</Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, tone, href }: { icon: string; label: string; value: string; tone?: 'good' | 'warn'; href: string }) {
  const toneCls = tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-foreground';
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><i className={`ph-bold ${icon}`} aria-hidden />{label}</div>
      <p className={`mt-1.5 display text-3xl font-bold ${toneCls}`}>{value}</p>
    </Link>
  );
}
