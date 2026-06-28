import { Donut } from './Donut';
import { MiniBars } from './MiniBars';
import { USER_KPIS, USER_STATS, DAU_SERIES, RETENTION, FUNNEL, type DauPoint, type UserKpi } from '@/data/adminMock';

export function AudienceAnalytics() {
  const u = USER_STATS;
  const nrSegs = [
    { label: 'New', value: u.newPct, color: '#2563eb' },
    { label: 'Returning', value: u.returningPct, color: '#10b981' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <i className="ph-bold ph-users text-primary" aria-hidden />
        <h2 className="display text-lg font-bold tracking-tight">Audience</h2>
        <span className="text-xs text-muted-foreground">user growth &amp; engagement</span>
      </div>

      {/* user KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {USER_KPIS.map((k) => <UserTile key={k.key} kpi={k} />)}
      </div>

      {/* active users chart + new/returning + engagement */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-pulse text-primary" aria-hidden /> Active users</p>
            <div className="flex gap-4 text-xs">
              <span><span className="text-muted-foreground">DAU</span> <b>{u.dau.toLocaleString('en-US')}</b></span>
              <span><span className="text-muted-foreground">WAU</span> <b>{u.wau.toLocaleString('en-US')}</b></span>
              <span><span className="text-muted-foreground">MAU</span> <b>{u.mau.toLocaleString('en-US')}</b></span>
              <span><span className="text-muted-foreground">Stickiness</span> <b>{u.stickiness}%</b></span>
            </div>
          </div>
          <ActiveUsersChart data={DAU_SERIES} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-user-switch text-primary" aria-hidden /> New vs returning</p>
          <div className="flex items-center gap-4">
            <Donut segs={nrSegs} centerValue={`${u.returningPct}%`} centerLabel="returning" size={116} />
            <div className="space-y-1.5 text-xs">
              {nrSegs.map((s) => (
                <p key={s.label} className="flex items-center gap-1.5"><span className="legend-dot" style={{ background: s.color }} />{s.label} <b className="ml-auto">{s.value}%</b></p>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <EngStat label="Avg session" value={`${u.avgSessionMin}m`} />
            <EngStat label="Sessions / user" value={String(u.sessionsPerUser)} />
            <EngStat label="Bounce rate" value={`${u.bounceRate}%`} />
            <EngStat label="Visitor→customer" value={`${u.visitorToCustomer}%`} />
          </div>
        </div>
      </div>

      {/* retention + funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-arrows-clockwise text-primary" aria-hidden /> Retention curve</p>
            <p className="text-xs text-muted-foreground">D30 <span className="font-semibold text-foreground">{u.retention30}%</span> · churn {u.churn30}%</p>
          </div>
          <div className="flex items-end justify-between gap-2" style={{ height: 150 }}>
            {RETENTION.map((r) => (
              <div key={r.day} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[11px] font-semibold">{r.pct}%</span>
                <div className="w-full max-w-[2.4rem] rounded-t bg-gradient-to-t from-primary/60 to-primary" style={{ height: `${r.pct}%` }} title={`${r.day}: ${r.pct}%`} />
                <span className="mt-1 text-[10px] text-muted-foreground">{r.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-funnel text-primary" aria-hidden /> Conversion funnel</p>
          <div className="space-y-2.5">
            {FUNNEL.map((f, i) => {
              const pct = Math.round((f.value / FUNNEL[0].value) * 100);
              const conv = i ? Math.round((f.value / FUNNEL[i - 1].value) * 100) : 100;
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{f.stage}</span>
                    <span className="text-muted-foreground">{f.value.toLocaleString('en-US')}{i > 0 && <> · <b className="text-foreground">{conv}%</b></>}</span>
                  </div>
                  <div className="mt-1 h-5 overflow-hidden rounded-md bg-muted">
                    <div className="flex h-full items-center rounded-md bg-gradient-to-r from-primary to-primary/70 px-2 text-[10px] font-semibold text-primary-foreground" style={{ width: `${Math.max(pct, 6)}%` }}>{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function UserTile({ kpi }: { kpi: UserKpi }) {
  return (
    <div className="kpi">
      <span className="kpi-glow" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{kpi.label}</p>
          <p className="display mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
        </div>
        <i className={`ph-bold ${kpi.icon} text-lg text-primary`} aria-hidden />
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <MiniBars data={kpi.trend} />
        <span className={`pill ${kpi.deltaGood ? 'pill-live' : 'pill-warn'}`}>{kpi.delta > 0 ? '+' : ''}{kpi.delta}%</span>
      </div>
    </div>
  );
}

function EngStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2.5">
      <p className="display text-base font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ActiveUsersChart({ data }: { data: DauPoint[] }) {
  const W = 720, H = 196, padL = 40, padR = 12, padT = 12, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.ceil(Math.max(...data.map((d) => d.dau)) / 500) * 500 || 500;
  const x = (i: number) => padL + (i / (data.length - 1)) * iw;
  const y = (v: number) => padT + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.dau).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padT + ih} L${x(0).toFixed(1)},${padT + ih} Z`;
  const grid = Array.from({ length: 4 }, (_, i) => (i * max) / 3);
  const xEvery = Math.max(1, Math.ceil(data.length / 6));
  const fmtK = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 1 : 0)}k` : `${g}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily active users">
      <defs>
        <linearGradient id="dau-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" />
          <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{fmtK(g)}</text>
        </g>
      ))}
      <path d={area} fill="url(#dau-fill)" />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (i % xEvery === 0 || i === data.length - 1
        ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{d.date}</text>
        : null))}
    </svg>
  );
}
