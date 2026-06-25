import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KpiTile } from '@/components/admin/KpiTile';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { ORDERS, STAFF, SKILL_META, SERVICE_SKILL, money, statusLabel } from '@/data/adminMock';

const TODAY = new Date('2026-06-24T00:00:00');
const ACTIVE = new Set(['assigned', 'in_progress', 'internal_review', 'changes_requested', 'delivered']);
const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const hueOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const dueIn = (d: string | null) => (d ? Math.round((new Date(d).getTime() - TODAY.getTime()) / 86400000) : null);

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = STAFF.find((x) => x.id === id);
  if (!s) notFound();

  const mine = ORDERS.filter((o) => o.staff === s.name);
  const active = mine.filter((o) => ACTIVE.has(o.status)).sort((a, b) => (dueIn(a.deadline) ?? 9999) - (dueIn(b.deadline) ?? 9999));
  const recent = mine.filter((o) => o.status === 'completed' || o.status === 'approved').slice(0, 6);
  const load = active.length;
  const pct = Math.round((load / s.capacity) * 100);
  const valueInFlight = active.reduce((n, o) => n + o.value, 0);
  const overdue = active.filter((o) => (dueIn(o.deadline) ?? 9) < 0).length;
  const h = hueOf(s.name);
  const max = Math.max(...s.trend), min = Math.min(...s.trend), range = max - min || 1;
  const sx = (i: number) => (i / (s.trend.length - 1)) * 196 + 2;
  const sy = (v: number) => 44 - ((v - min) / range) * 40;

  // which services this person's skills cover
  const coveredServices = Object.entries(SERVICE_SKILL).filter(([, skill]) => s.skills.includes(skill)).map(([svc]) => svc);

  return (
    <section className="space-y-4">
      <Link href="/admin/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><i className="ph-bold ph-arrow-left" />Back to staff</Link>

      {/* header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold" style={{ background: `hsl(${h} 65% 50% / 0.16)`, color: `hsl(${h} 55% 42%)` }}>{initials(s.name)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h1 className="display text-2xl font-bold tracking-tight">{s.name}</h1>{s.active ? <span className="pill pill-good"><i className="ph-bold ph-check-circle" />Active</span> : <span className="pill pill-warn"><i className="ph-bold ph-pause" />Paused</span>}</div>
          <p className="text-sm text-muted-foreground">{s.role}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.email} · since {s.since} · {s.tz}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {s.skills.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"><i className={`ph-fill ${SKILL_META[k].icon}`} style={{ color: SKILL_META[k].color }} />{SKILL_META[k].label}</span>)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon="ph-medal" label="Composite" value={String(s.composite)} tone="good" />
        <KpiTile icon="ph-seal-check" label="Quality" value={`${s.quality}%`} />
        <KpiTile icon="ph-clock" label="On-time" value={`${s.onTime}%`} />
        <KpiTile icon="ph-lightning" label="Throughput" value={String(s.throughput)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* workload */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-stack text-primary" /> Active workload</p>
            <span className="text-xs text-muted-foreground">{load} of {s.capacity} slots{overdue ? ` · ${overdue} overdue` : ''}</span>
          </div>
          <div className="mb-3"><div className="bar"><i style={{ width: `${Math.min(pct, 100)}%`, background: load > s.capacity ? 'hsl(var(--destructive))' : undefined }} /></div><p className="mt-1 text-xs text-muted-foreground">{pct}% utilization · {money(valueInFlight)} in flight</p></div>
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">No orders in flight.</p>
          ) : (
            <div className="space-y-1.5">
              {active.map((o) => { const d = dueIn(o.deadline);
                return (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-primary/50">
                    <PriorityBadge priority={o.priority} />
                    <span className="font-medium">{o.code}</span>
                    <span className="text-xs text-muted-foreground">{o.service} · {o.pkg}</span>
                    <span className="text-xs text-muted-foreground">· {o.customer}</span>
                    <span className="ml-auto" /><StatusBadge status={o.status} />
                    <span className="text-xs font-medium text-foreground">{money(o.value)}</span>
                    <span className={`text-xs font-medium ${d === null ? 'text-muted-foreground' : d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>{d === null ? 'no due' : d < 0 ? `${-d}d over` : d === 0 ? 'today' : `${d}d`}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {recent.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recently shipped</p>
              <div className="space-y-1.5">
                {recent.map((o) => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted/50">
                    <i className="ph-fill ph-check-circle text-emerald-500" />
                    <span className="font-medium">{o.code}</span>
                    <span className="text-xs text-muted-foreground">{o.service} · {o.customer}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{statusLabel[o.status]}</span>
                    <span className="text-xs font-medium">{money(o.value)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* side: performance + trend + coverage */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-line-up text-primary" /> Throughput trend</p>
            <svg viewBox="0 0 200 48" className="w-full" preserveAspectRatio="none" height={48}>
              <polyline points={s.trend.map((v, i) => `${sx(i)},${sy(v)}`).join(' ')} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={sx(s.trend.length - 1)} cy={sy(s.trend[s.trend.length - 1])} r={3} fill="hsl(var(--primary))" />
            </svg>
            <p className="mt-1 text-xs text-muted-foreground">8-week completed orders · {s.trend[s.trend.length - 1]} this week</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-gauge text-primary" /> Performance</p>
            <Bar label="Quality" pct={s.quality} />
            <Bar label="On-time delivery" pct={s.onTime} warn={s.onTime < 85} />
            <Bar label="Utilization" pct={pct} hint={`${load}/${s.capacity}`} warn={pct > 80} over={load > s.capacity} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-puzzle-piece text-primary" /> Services covered</p>
            {coveredServices.length ? (
              <div className="flex flex-wrap gap-1.5">{coveredServices.map((svc) => <span key={svc} className="rounded-md border border-border px-2 py-0.5 text-xs">{svc}</span>)}</div>
            ) : <p className="text-xs text-muted-foreground">No skills assigned yet.</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">Auto-routing can send these services to {s.name.split(' ')[0]}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bar({ label, pct, hint, warn, over }: { label: string; pct: number; hint?: string; warn?: boolean; over?: boolean }) {
  const bg = over ? 'hsl(var(--destructive))' : warn ? '#f59e0b' : 'hsl(var(--primary))';
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{hint ?? `${pct}%`}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: bg }} /></div>
    </div>
  );
}
