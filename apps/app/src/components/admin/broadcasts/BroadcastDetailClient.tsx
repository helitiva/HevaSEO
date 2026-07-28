'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useBroadcasts, newBroadcastId, nowIso } from '@/data/broadcastStore';
import { KIND_META, AUDIENCE_META, isLive, isScheduled, type Broadcast } from '@/data/broadcasts';
import {
  recipientEvents, summarize, readTimeline, audienceBreakdown, hourOfDayHistogram, benchmarkReadRate,
  type RecEvent,
} from '@/lib/broadcastAnalytics';
import { ReadTimeline, Funnel, AudienceBars, HourHeatmap } from './analyticsCharts';
import { ago } from '@/lib/relativeTime';

type Filter = 'all' | 'read' | 'unread' | 'clicked' | 'acked';

const pct = (n: number) => `${Math.round(n * 100)}%`;
function fmtDur(ms: number | null): string {
  if (ms == null) return '—';
  const m = ms / 60000;
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function BroadcastDetailClient({ id, broadcast, realEvents }: { id: string; broadcast?: Broadcast; realEvents?: RecEvent[] }) {
  // Lane C inc-C5/C6: `broadcast` is the real DB record; `realEvents` is the real engagement built from
  // broadcast_events + the tenant roster (getBroadcastAnalytics). When present, analytics are fully real;
  // otherwise it falls back to the synthetic mock. saveBroadcast (the "remind unread" nudge) is mock.
  const { all, saveBroadcast, ready } = useBroadcasts();
  const b = broadcast ?? all.find((x) => x.id === id);

  // Recompute analytics when the store changes (e.g. a persona reads in another tab).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('heva:broadcasts-changed', bump); window.addEventListener('storage', bump);
    return () => { window.removeEventListener('heva:broadcasts-changed', bump); window.removeEventListener('storage', bump); };
  }, []);

  const events = useMemo(() => realEvents ?? (b ? recipientEvents(b) : []), [realEvents, b, tick]);
  const summary = useMemo(() => (b ? summarize(events, b) : null), [events, b]);
  const timeline = useMemo(() => (b ? readTimeline(events, b) : null), [events, b]);
  const audiences = useMemo(() => audienceBreakdown(events), [events]);
  const hist = useMemo(() => hourOfDayHistogram(events), [events]);
  const benchmark = useMemo(() => benchmarkReadRate(all), [all]);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [nudged, setNudged] = useState(false);

  if (!b || !summary || !timeline) {
    return (
      <section className="mx-auto max-w-md py-20 text-center">
        <i className={`ph-bold ${ready ? 'ph-tray' : 'ph-spinner-gap animate-spin'} mb-2 block text-3xl text-muted-foreground`} aria-hidden />
        <p className="text-sm text-muted-foreground">{ready ? 'Message not found.' : 'Loading…'}</p>
        {ready && <Link href="/admin/broadcasts" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"><i className="ph-bold ph-arrow-left" aria-hidden /> Back to broadcasts</Link>}
      </section>
    );
  }

  const m = KIND_META[b.kind];
  const status = !b.active ? 'Recalled' : isScheduled(b) ? 'Scheduled' : isLive(b) ? 'Live' : 'Expired';

  const matchesFilter = (e: RecEvent): boolean => {
    if (filter === 'read') return e.readAt != null;
    if (filter === 'unread') return e.readAt == null;
    if (filter === 'clicked') return e.clickedAt != null;
    if (filter === 'acked') return e.ackedAt != null;
    return true;
  };
  const q = query.trim().toLowerCase();
  const rows = events
    .filter(matchesFilter)
    .filter((e) => !q || `${e.name} ${e.sub}`.toLowerCase().includes(q))
    .sort((a, c) => (c.readAt ?? 0) - (a.readAt ?? 0));

  const exportCsv = () => {
    const head = ['Name', 'Audience', 'Delivered', 'Read at', 'Clicked CTA at', 'Acknowledged at', 'Dismissed at', 'Channel'];
    const iso = (t: number | null) => (t == null ? '' : new Date(t).toISOString());
    const lines = events.map((e) => [e.name, e.audience, iso(e.deliveredAt), iso(e.readAt), iso(e.clickedAt), iso(e.ackedAt), iso(e.dismissedAt), e.channel ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `broadcast-${b.id}-recipients.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const nudge = () => {
    saveBroadcast({
      id: newBroadcastId(),
      title: `Reminder: ${b.title}`,
      body: b.body,
      kind: b.kind, audiences: b.audiences, banner: true, pinned: false,
      requireAck: b.requireAck, article: b.article, cta: b.cta,
      createdAt: nowIso(), publishAt: null, expiresAt: null, active: true,
    }, 'Nudged');
    setNudged(true);
  };

  const unreadCount = summary.delivered - summary.read;
  const tabs: { k: Filter; label: string; n: number }[] = [
    { k: 'all', label: 'All', n: summary.delivered },
    { k: 'read', label: 'Read', n: summary.read },
    { k: 'unread', label: 'Unread', n: unreadCount },
    ...(summary.hasCta ? [{ k: 'clicked' as Filter, label: 'Clicked CTA', n: summary.clicks }] : []),
    ...(summary.requireAck ? [{ k: 'acked' as Filter, label: 'Acknowledged', n: summary.acked }] : []),
  ];

  return (
    <section className="space-y-5">
      {/* header */}
      <div>
        <Link href="/admin/broadcasts" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"><i className="ph-bold ph-arrow-left" aria-hidden /> Broadcasts</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}1f`, color: m.color }}><i className={`ph-fill ${m.icon} text-xl`} aria-hidden /></span>
            <div>
              <h1 className="display text-2xl font-bold tracking-tight">{b.title}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold" style={{ background: `${m.color}1a`, color: m.color }}><i className={`ph-fill ${m.icon}`} aria-hidden />{m.label}</span>
                <span className={`pill ${status === 'Live' ? 'pill-live' : status === 'Recalled' ? 'pill-warn' : ''}`}>{status}</span>
                <span>Sent {ago(b.createdAt)}</span>
                {b.requireAck && <span className="inline-flex items-center gap-1 text-amber-600"><i className="ph-bold ph-seal-check" aria-hidden />Ack required</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-accent"><i className="ph-bold ph-download-simple" aria-hidden /> Export CSV</button>
            <button onClick={nudge} disabled={nudged || unreadCount === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition enabled:hover:bg-primary/90 disabled:opacity-40">
              <i className={`ph-bold ${nudged ? 'ph-check' : 'ph-bell-ringing'}`} aria-hidden /> {nudged ? 'Reminder sent' : `Remind unread (${unreadCount})`}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon="ph-paper-plane-tilt" label="Delivered" value={String(summary.delivered)} />
        <Kpi icon="ph-eye" label="Read" value={pct(summary.readRate)} tone="good" sub={`${summary.read} · ${summary.readRate >= benchmark ? '▲' : '▼'} avg ${pct(benchmark)}`} />
        {summary.hasCta && <Kpi icon="ph-cursor-click" label="CTA clicks" value={String(summary.clicks)} sub={`CTR ${pct(summary.ctr)}`} />}
        {summary.requireAck && <Kpi icon="ph-seal-check" label="Acknowledged" value={pct(summary.ackRate)} tone="warn" sub={`${summary.acked}/${summary.delivered}`} />}
        <Kpi icon="ph-x-circle" label="Dismissed" value={String(summary.dismissed)} />
        <Kpi icon="ph-timer" label="Avg time to read" value={fmtDur(summary.avgTimeToReadMs)} />
      </div>

      <ReadTimeline hourly={timeline.hourly} daily={timeline.daily} total={timeline.total} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Funnel s={summary} />
        <AudienceBars stats={audiences} />
      </div>
      <HourHeatmap hist={hist} />

      {/* recipients */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => setFilter(t.k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${filter === t.k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>{t.label} <span className="opacity-70">{t.n}</span></button>
            ))}
          </div>
          <div className="relative">
            <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipients…" className="w-44 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary sm:w-56" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Recipient</th><th className="p-3">Audience</th><th className="p-3">Read</th><th className="p-3">CTA</th>{summary.requireAck && <th className="p-3">Ack</th>}<th className="p-3">Channel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => { const am = AUDIENCE_META[e.audience]; return (
                <tr key={e.id} className="border-b border-border/50 transition hover:bg-muted/40">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: `${am.color}1f`, color: am.color }}>{e.initials}</span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-semibold">{e.name}{e.isYou && <span className="rounded bg-primary/15 px-1 text-[9px] font-bold uppercase text-primary">you</span>}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{e.sub}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: am.color }}><i className={`ph-fill ${am.icon}`} aria-hidden />{am.label}</span></td>
                  <td className="p-3">{e.readAt != null
                    ? <span className="inline-flex items-center gap-1 text-emerald-600" title={new Date(e.readAt).toLocaleString()}><i className="ph-fill ph-check-circle" aria-hidden />{ago(new Date(e.readAt).toISOString())}</span>
                    : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{e.clickedAt != null ? <i className="ph-fill ph-cursor-click text-violet-500" title={`Clicked ${new Date(e.clickedAt).toLocaleString()}`} aria-hidden /> : <span className="text-muted-foreground">—</span>}</td>
                  {summary.requireAck && <td className="p-3">{e.ackedAt != null ? <i className="ph-fill ph-seal-check text-amber-500" title={`Acked ${new Date(e.ackedAt).toLocaleString()}`} aria-hidden /> : <span className="text-muted-foreground">—</span>}</td>}
                  <td className="p-3 text-muted-foreground">{e.channel ?? '—'}</td>
                </tr>
              ); })}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No recipients match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} aria-hidden /></div>
      <p className="display mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
