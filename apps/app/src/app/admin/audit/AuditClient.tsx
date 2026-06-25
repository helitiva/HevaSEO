'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/admin/SlideOver';
import type { AuditEntry, AuditCategory, AuditEntity } from '@/data/adminMock';

type CatMeta = Record<AuditCategory, { label: string; icon: string; color: string }>;
type EntMeta = Record<AuditEntity, { label: string; icon: string; href: string | null }>;
interface Kpis { total: number; today: number; actors: number; destructive: number; topEntity: string }
interface Props { events: AuditEntry[]; categoryMeta: CatMeta; entityMeta: EntMeta; kpis: Kpis }

const TODAY = '2026-06-24';
const dayLabel = (d: string) => (d === TODAY ? 'Today' : d === '2026-06-23' ? 'Yesterday' : new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export function AuditClient({ events, categoryMeta, entityMeta, kpis }: Props) {
  const [fEntity, setFEntity] = useState(''); const [fActor, setFActor] = useState(''); const [fCat, setFCat] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const entities = useMemo(() => [...new Set(events.map((e) => e.entity))], [events]);
  const actors = useMemo(() => [...new Set(events.map((e) => e.actor))], [events]);
  const cats = useMemo(() => [...new Set(events.map((e) => e.category))], [events]);

  const filtered = useMemo(() => events.filter((e) =>
    (!fEntity || e.entity === fEntity) && (!fActor || e.actor === fActor) && (!fCat || e.category === fCat)
    && (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to)
    && (!search.trim() || `${e.change} ${e.entityCode ?? ''} ${e.actor} ${e.action}`.toLowerCase().includes(search.toLowerCase()))
  ), [events, fEntity, fActor, fCat, from, to, search]);

  const groups = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    for (const e of filtered) { const d = e.at.slice(0, 10); (m.get(d) ?? m.set(d, []).get(d)!).push(e); }
    return [...m.entries()];
  }, [filtered]);

  const selected = selId ? events.find((e) => e.id === selId) ?? null : null;
  const hasFilter = fEntity || fActor || fCat || from || to || search;
  const clear = () => { setFEntity(''); setFActor(''); setFCat(''); setFrom(''); setTo(''); setSearch(''); };

  // URL deep-link to a single event
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('event'); if (id && events.some((e) => e.id === id)) setSelId(id); }, [events]);
  useEffect(() => { const url = new URL(window.location.href); if (selId) url.searchParams.set('event', selId); else url.searchParams.delete('event'); window.history.replaceState(null, '', `${url.pathname}${url.search}`); }, [selId]);

  const exportCsv = () => {
    const head = ['time', 'actor', 'entity', 'entity_id', 'action', 'category', 'change'];
    const rows = filtered.map((e) => [e.at, e.actor, e.entity, e.entityCode ?? '', e.action, e.category, e.change].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `audit-log-${TODAY}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const entityHref = (e: AuditEntry) => { const h = entityMeta[e.entity].href; return h && e.entityId ? `${h}/${e.entityId}` : null; };

  const sel = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Every state-changing action, who did it and when. <span className="inline-flex items-center gap-1 align-middle text-xs font-semibold text-emerald-600"><i className="ph-bold ph-lock-key" />append-only</span></p>
        </div>
        <button onClick={exportCsv} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple mr-1" />Export CSV</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-calendar-check" label="Events today" value={String(kpis.today)} />
        <Kpi icon="ph-stack" label="Total events" value={String(kpis.total)} />
        <Kpi icon="ph-users" label="Active actors" value={String(kpis.actors)} />
        <Kpi icon="ph-warning-octagon" label="Destructive" value={String(kpis.destructive)} tone={kpis.destructive ? 'warn' : undefined} />
        <Kpi icon="ph-trophy" label="Most-changed" value={kpis.topEntity} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"><i className="ph-bold ph-magnifying-glass text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search change, entity, actor…" className="w-full bg-transparent outline-none" /></div>
          <select value={fEntity} onChange={(e) => setFEntity(e.target.value)} className={`${sel} capitalize`}><option value="">All entities</option>{entities.map((x) => <option key={x} value={x}>{entityMeta[x].label}</option>)}</select>
          <select value={fActor} onChange={(e) => setFActor(e.target.value)} className={sel}><option value="">All actors</option>{actors.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={`${sel} capitalize`}><option value="">All categories</option>{cats.map((x) => <option key={x} value={x}>{categoryMeta[x].label}</option>)}</select>
          <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" /></label>
          <label className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs"><span className="text-muted-foreground">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" /></label>
          {hasFilter && <button onClick={clear} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {events.length}</span>
        </div>

        <div className="scrollbar-thin max-h-[34rem] overflow-y-auto">
          {groups.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No events match these filters.</p> : groups.map(([day, list]) => (
            <div key={day}>
              <div className="sticky top-0 z-10 -mx-4 mb-1 mt-2 bg-card/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur first:mt-0">{dayLabel(day)} <span className="font-normal lowercase">· {list.length} events</span></div>
              <div className="divide-y divide-border/50">
                {list.map((e) => { const cm = categoryMeta[e.category]; const dest = e.category === 'destructive'; const href = entityHref(e);
                  return (
                    <button key={e.id} onClick={() => setSelId(e.id)} className={`flex w-full items-center gap-3 py-2 text-left transition hover:bg-muted/40 ${dest ? 'border-l-2 border-destructive pl-2' : e.category === 'auth' ? 'border-l-2 border-amber-500 pl-2' : ''}`}>
                      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{e.at.slice(11)}</span>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground" title={e.actor}>{initials(e.actor)}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${cm.color}1f`, color: cm.color }} title={`${entityMeta[e.entity].label} · ${cm.label}`}><i className={`ph-bold ${entityMeta[e.entity].icon}`} />{entityMeta[e.entity].label}</span>
                      <span className="min-w-0 flex-1 truncate text-sm"><b className="font-medium">{e.actor}</b> <span className="text-muted-foreground">{e.change}</span></span>
                      {e.diff && <i className="ph-bold ph-git-diff shrink-0 text-xs text-muted-foreground" title="Has field changes" />}
                      {href && <i className="ph-bold ph-arrow-up-right shrink-0 text-xs text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <SlideOver open onClose={() => setSelId(null)} title={selected.entityCode ?? selected.action}>
          <EventDetail e={selected} categoryMeta={categoryMeta} entityMeta={entityMeta} related={events.filter((x) => x.entityId && x.entityId === selected.entityId && x.id !== selected.id)} onSelect={setSelId} entityHref={entityHref} />
        </SlideOver>
      )}
    </section>
  );
}

function EventDetail({ e, categoryMeta, entityMeta, related, onSelect, entityHref }: {
  e: AuditEntry; categoryMeta: CatMeta; entityMeta: EntMeta; related: AuditEntry[]; onSelect: (id: string) => void; entityHref: (e: AuditEntry) => string | null;
}) {
  const cm = categoryMeta[e.category]; const em = entityMeta[e.entity]; const href = entityHref(e);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${cm.color}1f`, color: cm.color }}><i className={`ph-bold ${cm.icon}`} />{cm.label}</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-bold ${em.icon}`} />{em.label}</span>
        {href && <Link href={href} className="ml-auto text-xs font-semibold text-primary hover:underline">Open {em.label.toLowerCase()} →</Link>}
      </div>

      <p className="text-sm">{e.change}</p>

      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <KV label="Actor" value={e.actor} />
        <KV label="When" value={e.at} />
        <KV label="Action" value={e.action} />
        <KV label="Entity" value={e.entityCode ? `${em.label} · ${e.entityCode}` : em.label} />
        {e.from && <KV label="From" value={e.from} />}
        {e.to && <KV label="To" value={e.to} />}
      </div>

      {e.diff && e.diff.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Field changes</p>
          <div className="space-y-1.5">
            {e.diff.map((d) => (
              <div key={d.field} className="rounded-lg border border-border p-2 text-sm">
                <p className="text-[11px] font-semibold text-muted-foreground">{d.field}</p>
                <div className="flex items-center gap-2"><span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive line-through">{d.from}</span><i className="ph-bold ph-arrow-right text-xs text-muted-foreground" /><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">{d.to}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {e.meta && Object.keys(e.meta).length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metadata</p>
          <div className="rounded-lg border border-border bg-background/40 p-2 font-mono text-xs">{Object.entries(e.meta).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="truncate">{String(v)}</span></div>)}</div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Other events on this {em.label.toLowerCase()}{e.entityCode ? ` · ${e.entityCode}` : ''}</p>
        {related.length === 0 ? <p className="text-xs text-muted-foreground">No other events recorded.</p> : (
          <ul className="space-y-1.5">
            {related.map((r) => (
              <li key={r.id}><button onClick={() => onSelect(r.id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-muted"><span className="w-24 shrink-0 tabular-nums text-muted-foreground">{r.at.slice(5)}</span><span className="truncate">{r.change}</span></button></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'warn' }) {
  const col = tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div><p className="display mt-1 truncate text-xl font-bold tracking-tight">{value}</p></div>;
}
function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="font-medium capitalize">{value}</span></div>;
}
