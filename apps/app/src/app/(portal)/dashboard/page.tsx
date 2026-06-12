import { OrdersBoard } from '@/components/OrdersBoard';
import { ACTIVITY } from '@/data/mock';

export const metadata = { title: 'Overview' };

export default function DashboardPage() {
  return (
    <>
      {/* page head */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl font-semibold tracking-tight md:text-3xl">Overview</h1>
            <span className="pill pill-live"><span /> Live</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Hi Huy 👋 · 4 active projects · updated 2 minutes ago</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent">
            <i className="ph-bold ph-calendar-blank" /> 90 days <i className="ph-bold ph-caret-down text-muted-foreground" />
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-500/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[.98]">
            <i className="ph-bold ph-plus" /> New order
          </button>
        </div>
      </div>

      {/* KPI ROW */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400/20 text-amber-500"><i className="ph-fill ph-crown" /></span>
            <span className="pill" style={{ background: '#f59e0b1f', color: '#d97706' }}>VIP</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Membership tier</p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <div>
              <p className="display text-2xl font-semibold leading-none tracking-tight">VIP</p>
              <p className="mt-1 text-[11px] text-muted-foreground">15%* off every order</p>
            </div>
            <div className="tier" title="Tier progress">
              <i className="on" style={{ height: '40%' }} /><i className="on" style={{ height: '58%' }} /><i className="on" style={{ height: '76%' }} /><i className="on" style={{ height: '90%' }} /><i style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><i className="ph-bold ph-package" /></span>
            <span className="pill pill-good">All</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Services ordered</p>
          <p className="display mt-0.5 text-2xl font-semibold leading-none tracking-tight">32 <span className="text-sm text-muted-foreground">services</span></p>
          <div className="seg mt-2">
            <i style={{ width: '32%', background: '#3b82f6' }} /><i style={{ width: '30%', background: '#10b981' }} /><i style={{ width: '24%', background: '#f59e0b' }} /><i style={{ width: '14%', background: '#a78bfa' }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="legend-dot" style={{ background: '#3b82f6' }} />Backlink 4</span>
            <span className="inline-flex items-center gap-1"><span className="legend-dot" style={{ background: '#10b981' }} />Content 150</span>
            <span className="inline-flex items-center gap-1"><span className="legend-dot" style={{ background: '#f59e0b' }} />Index 32k</span>
            <span className="inline-flex items-center gap-1"><span className="legend-dot" style={{ background: '#a78bfa' }} />Other 5</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600"><i className="ph-bold ph-check-circle" /></span>
            <span className="pill pill-good">+6 today</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Services completed</p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <div className="flex items-end gap-4">
              <div><p className="display text-2xl font-semibold leading-none tracking-tight">6</p><p className="mt-1 text-[11px] text-muted-foreground">Today</p></div>
              <div><p className="display text-2xl font-semibold leading-none tracking-tight">18</p><p className="mt-1 text-[11px] text-muted-foreground">This week</p></div>
            </div>
            <div className="mini-bars" title="Last 7 days">
              <i style={{ height: '45%' }} /><i style={{ height: '60%' }} /><i style={{ height: '40%' }} /><i style={{ height: '80%' }} /><i style={{ height: '55%' }} /><i style={{ height: '70%' }} /><i className="on" style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-glow" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><i className="ph-bold ph-timer" /></span>
            <span className="pill pill-good">On time</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">On-time completion rate</p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <div className="flex items-end gap-4">
              <div><p className="display text-2xl font-semibold leading-none tracking-tight">96%</p><p className="mt-1 text-[11px] text-muted-foreground">All time</p></div>
              <div><p className="display text-2xl font-semibold leading-none tracking-tight text-emerald-600">100%</p><p className="mt-1 text-[11px] text-muted-foreground">This week</p></div>
            </div>
            <div className="ring" style={{ ['--p' as string]: 96 }}><b>96%</b></div>
          </div>
        </div>
      </section>

      {/* ORDERS */}
      <section className="mt-5">
        <OrdersBoard />
      </section>

      {/* ACTIVITY + SPECIALIST */}
      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="display text-lg font-semibold tracking-tight">Recent activity</h3>
            <button className="text-xs font-semibold text-primary hover:underline">All</button>
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><i className={`ph-bold ${a.icon}`} /></span>
                <div>
                  <p className="text-sm" dangerouslySetInnerHTML={{ __html: a.html }} />
                  <p className="text-[11px] text-muted-foreground">{a.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="display text-lg font-semibold tracking-tight">Your specialist</h3>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">OC</span>
            <div>
              <p className="font-semibold">Olivia Chen</p>
              <p className="text-xs text-muted-foreground">SEO Lead · replies &lt; 2h</p>
            </div>
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
            <i className="ph-bold ph-chat-circle-dots" /> Message specialist
          </button>
          <div className="mt-3 grid gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border py-2 pl-3 text-sm font-medium transition hover:bg-accent"><i className="ph-bold ph-plus text-primary" /> Create new order</button>
            <button className="flex items-center gap-2 rounded-lg border border-border py-2 pl-3 text-sm font-medium transition hover:bg-accent"><i className="ph-bold ph-wallet text-primary" /> Top up credits</button>
          </div>
        </div>
      </section>
    </>
  );
}
