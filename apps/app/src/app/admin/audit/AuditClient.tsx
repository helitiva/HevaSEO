'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SlideOver } from '@/components/shared/SlideOver';
import type { AuditEntry, AuditCategory, AuditEntity } from '@/data/adminMock';
import { MOCK_TODAY, mockTodayAt } from '@/lib/today';

type CatMeta = Record<AuditCategory, { label: string; icon: string; color: string }>;
type EntMeta = Record<AuditEntity, { label: string; icon: string; href: string | null }>;
interface Kpis { total: number; today: number; actors: number; destructive: number; topEntity: string }
interface Props { events: AuditEntry[]; categoryMeta: CatMeta; entityMeta: EntMeta; kpis: Kpis }

const TODAY = MOCK_TODAY;
const NOW = mockTodayAt('09:30:00');
const dayLabel = (d: string) => (d === TODAY ? 'Today' : d === '2026-06-23' ? 'Yesterday' : new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const rel = (at: string) => {
  const mins = Math.round((NOW.getTime() - new Date(at.replace(' ', 'T')).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const isOffHours = (at: string) => { const hh = +at.slice(11, 13); return hh < 8 || hh >= 20; };
// NOTE: there was a "tamper-evident hash chain" here. It was deleted, not ported, because it could not
// ever fail: a djb2 (non-cryptographic, 32-bit) hash was folded client-side, at render, over the very
// rows on screen. Tamper with a row and the chain is simply recomputed over the tampered row — still
// "intact". audit_log stores no hash, so there was nothing to verify against. A green "verified" badge
// that is true by construction is worse than no badge: it is a false assurance on the one surface whose
// entire job is assurance.
//
// Doing this for real needs storage, not UI: a hash column on audit_log written by a trigger that folds
// in the previous row's hash, and a server-side verifier that re-walks the chain. Until that exists,
// the page says only what it can back up.

export function AuditClient({ events, categoryMeta, entityMeta, kpis }: Props) {
  const [fEntity, setFEntity] = useState(''); const [fActor, setFActor] = useState(''); const [fCat, setFCat] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [search, setSearch] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);

  const flagged = (e: AuditEntry) => e.category === 'destructive' || e.action === 'impersonate' || (e.category === 'auth' && isOffHours(e.at));

  const entities = useMemo(() => [...new Set(events.map((e) => e.entity))], [events]);
  const actors = useMemo(() => [...new Set(events.map((e) => e.actor))], [events]);
  const cats = useMemo(() => [...new Set(events.map((e) => e.category))], [events]);

  const filtered = useMemo(() => events.filter((e) =>
    (!fEntity || e.entity === fEntity) && (!fActor || e.actor === fActor) && (!fCat || e.category === fCat)
    && (!onlyDiff || (e.diff && e.diff.length > 0)) && (!onlyFlagged || flagged(e))
    && (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to)
    && (!search.trim() || `${e.change} ${e.entityCode ?? ''} ${e.actor} ${e.action}`.toLowerCase().includes(search.toLowerCase()))
  ), [events, fEntity, fActor, fCat, onlyDiff, onlyFlagged, from, to, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const catCounts = useMemo(() => (Object.keys(categoryMeta) as AuditCategory[]).map((c) => ({ c, n: filtered.filter((e) => e.category === c).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n), [filtered, categoryMeta]);
  const actorCounts = useMemo(() => [...new Set(filtered.map((e) => e.actor))].map((a) => ({ a, n: filtered.filter((e) => e.actor === a).length })).sort((x, y) => y.n - x.n).slice(0, 6), [filtered]);
  const maxCat = Math.max(...catCounts.map((x) => x.n), 1);
  const maxActor = Math.max(...actorCounts.map((x) => x.n), 1);

  const groups = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    for (const e of filtered) { const d = e.at.slice(0, 10); (m.get(d) ?? m.set(d, []).get(d)!).push(e); }
    return [...m.entries()];
  }, [filtered]);

  const selected = selId ? events.find((e) => e.id === selId) ?? null : null;
  const hasFilter = fEntity || fActor || fCat || onlyDiff || onlyFlagged || from || to || search;
  const clear = () => { setFEntity(''); setFActor(''); setFCat(''); setOnlyDiff(false); setOnlyFlagged(false); setFrom(''); setTo(''); setSearch(''); };
  // one-click quick views (presets)
  const preset = !hasFilter ? 'all' : onlyFlagged ? 'flagged' : onlyDiff ? 'edits' : fCat === 'destructive' && !fEntity && !fActor ? 'destructive' : fCat === 'auth' && !fEntity && !fActor ? 'auth' : from === TODAY && to === TODAY && !fCat ? 'today' : fActor === 'Admin' && !fCat && !fEntity ? 'admin' : '';
  const applyPreset = (k: string) => { clear(); if (k === 'destructive') setFCat('destructive'); else if (k === 'auth') setFCat('auth'); else if (k === 'today') { setFrom(TODAY); setTo(TODAY); } else if (k === 'edits') setOnlyDiff(true); else if (k === 'flagged') setOnlyFlagged(true); else if (k === 'admin') setFActor('Admin'); };
  const drillEntity = (code: string) => { setSelId(null); setSearch(code); };

  // URL deep-link: open event + every filter is shareable / survives refresh
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('entity')) setFEntity(q.get('entity') as string);
    if (q.get('actor')) setFActor(q.get('actor') as string);
    if (q.get('cat')) setFCat(q.get('cat') as string);
    if (q.get('from')) setFrom(q.get('from') as string);
    if (q.get('to')) setTo(q.get('to') as string);
    if (q.get('q')) setSearch(q.get('q') as string);
    if (q.get('diff')) setOnlyDiff(true);
    if (q.get('flagged')) setOnlyFlagged(true);
    const ev = q.get('event'); if (ev && events.some((e) => e.id === ev)) setSelId(ev);
  }, [events]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string) => { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); };
    set('entity', fEntity); set('actor', fActor); set('cat', fCat); set('from', from); set('to', to); set('q', search.trim()); set('diff', onlyDiff ? '1' : ''); set('flagged', onlyFlagged ? '1' : ''); set('event', selId ?? '');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [fEntity, fActor, fCat, from, to, search, onlyDiff, onlyFlagged, selId]);

  // j/k to move through the filtered log while a detail panel is open
  useEffect(() => {
    if (!selId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = filtered.findIndex((x) => x.id === selId);
      if (e.key === 'j' && idx >= 0 && idx < filtered.length - 1) setSelId(filtered[idx + 1].id);
      else if (e.key === 'k' && idx > 0) setSelId(filtered[idx - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, filtered]);

  const exportCsv = () => {
    const head = ['time', 'actor', 'entity', 'entity_id', 'action', 'category', 'change'];
    const rows = filtered.map((e) => [e.at, e.actor, e.entity, e.entityCode ?? '', e.action, e.category, e.change].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `audit-log-${TODAY}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `audit-log-${TODAY}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  const entityHref = (e: AuditEntry) => { const h = entityMeta[e.entity].href; return h && e.entityId ? `${h}/${e.entityId}` : null; };

  const sel = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">Every state-changing action, who did it and when.
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><i className="ph-bold ph-lock-key" aria-hidden />append-only</span>
            <span className="text-[11px]">· times UTC+0</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-download-simple mr-1" aria-hidden />CSV</button>
          <button onClick={exportJson} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-brackets-curly mr-1" aria-hidden />JSON</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-calendar-check" label="Events today" value={String(kpis.today)} />
        <Kpi icon="ph-stack" label="Total events" value={String(kpis.total)} />
        <Kpi icon="ph-users" label="Active actors" value={String(kpis.actors)} />
        <Kpi icon="ph-warning-octagon" label="Destructive" value={String(kpis.destructive)} tone={kpis.destructive ? 'warn' : undefined} />
        <Kpi icon="ph-trophy" label="Most-changed" value={kpis.topEntity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {([['all', 'All', 'ph-tray'], ['today', 'Today', 'ph-calendar-dot'], ['flagged', 'Flagged', 'ph-flag'], ['edits', 'Field edits', 'ph-git-diff'], ['destructive', 'Destructive', 'ph-warning-octagon'], ['auth', 'Auth', 'ph-shield-check'], ['admin', 'Admin actions', 'ph-user-gear']] as const).map(([k, label, icon]) => (
            <button key={k} onClick={() => applyPreset(k)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${preset === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}><i className={`ph-bold ${icon}`} />{label}</button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"><i className="ph-bold ph-magnifying-glass text-muted-foreground" aria-hidden /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search change, entity, actor…" className="w-full bg-transparent outline-none" /></div>
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
                    <div key={e.id} role="button" tabIndex={0} onClick={() => setSelId(e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter') setSelId(e.id); }} className={`flex w-full cursor-pointer items-center gap-3 py-2 text-left transition hover:bg-muted/40 ${dest ? 'border-l-2 border-destructive pl-2' : e.category === 'auth' ? 'border-l-2 border-amber-500 pl-2' : ''}`}>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground" title={e.at}>{rel(e.at)}</span>
                      <button onClick={(ev) => { ev.stopPropagation(); setFActor(e.actor); }} title={`Filter by ${e.actor}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground transition hover:ring-2 hover:ring-primary/40">{initials(e.actor)}</button>
                      <button onClick={(ev) => { ev.stopPropagation(); setFEntity(e.entity); }} title={`Filter to ${entityMeta[e.entity].label}`} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition hover:ring-2 hover:ring-primary/30" style={{ background: `${cm.color}1f`, color: cm.color }}><i className={`ph-bold ${entityMeta[e.entity].icon}`} />{entityMeta[e.entity].label}</button>
                      <span className="min-w-0 flex-1 truncate text-sm"><b className="font-medium">{e.actor}</b> <span className="text-muted-foreground">{e.change}</span></span>
                      {flagged(e) && <i className="ph-fill ph-flag shrink-0 text-xs text-amber-500" title="Flagged — unusual action (destructive / off-hours / impersonation)" aria-hidden />}
                      {e.diff && <i className="ph-bold ph-git-diff shrink-0 text-xs text-muted-foreground" title="Has field changes" aria-hidden />}
                      {href && <i className="ph-bold ph-arrow-up-right shrink-0 text-xs text-muted-foreground" aria-hidden />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chart-bar text-primary" aria-hidden /> Activity breakdown</p>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By category</p>
          <div className="space-y-1.5">
            {catCounts.map(({ c, n }) => { const cm = categoryMeta[c]; return (
              <button key={c} onClick={() => setFCat(fCat === c ? '' : c)} className="block w-full text-left" title={`Filter ${cm.label}`}>
                <div className="flex items-center justify-between text-xs"><span className="inline-flex items-center gap-1 font-medium" style={{ color: cm.color }}><i className={`ph-bold ${cm.icon}`} />{cm.label}</span><span className="text-muted-foreground">{n}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(n / maxCat) * 100}%`, background: cm.color }} /></div>
              </button>
            ); })}
            {catCounts.length === 0 && <p className="text-xs text-muted-foreground">No events.</p>}
          </div>
          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top actors</p>
          <div className="space-y-1.5">
            {actorCounts.map(({ a, n }) => (
              <button key={a} onClick={() => setFActor(fActor === a ? '' : a)} className="block w-full text-left" title={`Filter by ${a}`}>
                <div className="flex items-center justify-between text-xs"><span className="font-medium">{a}</span><span className="text-muted-foreground">{n}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / maxActor) * 100}%` }} /></div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {selected && (
        <SlideOver open onClose={() => setSelId(null)} title={selected.entityCode ?? selected.action}>
          <EventDetail e={selected} categoryMeta={categoryMeta} entityMeta={entityMeta} related={events.filter((x) => x.entityId && x.entityId === selected.entityId && x.id !== selected.id)} onSelect={setSelId} entityHref={entityHref}
            onActor={() => { setSelId(null); setFActor(selected.actor); }} onDrill={() => selected.entityCode && drillEntity(selected.entityCode)}
            isFlagged={flagged(selected)} />
        </SlideOver>
      )}
    </section>
  );
}

function EventDetail({ e, categoryMeta, entityMeta, related, onSelect, entityHref, onActor, onDrill, isFlagged }: {
  e: AuditEntry; categoryMeta: CatMeta; entityMeta: EntMeta; related: AuditEntry[]; onSelect: (id: string) => void; entityHref: (e: AuditEntry) => string | null; onActor: () => void; onDrill: () => void;
  isFlagged: boolean;
}) {
  const cm = categoryMeta[e.category]; const em = entityMeta[e.entity]; const href = entityHref(e);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${cm.color}1f`, color: cm.color }}><i className={`ph-bold ${cm.icon}`} />{cm.label}</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-bold ${em.icon}`} />{em.label}</span>
        {href && <Link href={href} className="ml-auto text-xs font-semibold text-primary hover:underline">Open {em.label.toLowerCase()} →</Link>}
      </div>

      {isFlagged && <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-amber-700"><i className="ph-fill ph-flag mr-1" aria-hidden />Flagged — unusual action (destructive, off-hours, or impersonation). Worth a second look.</div>}

      <p className="text-sm">{e.change}</p>

      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actor</span><button onClick={onActor} title="Filter log by this actor" className="text-left font-medium text-primary hover:underline">{e.actor}</button></div>
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
                <div className="flex items-center gap-2"><span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive line-through">{d.from}</span><i className="ph-bold ph-arrow-right text-xs text-muted-foreground" aria-hidden /><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">{d.to}</span></div>
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Other events on this {em.label.toLowerCase()}{e.entityCode ? ` · ${e.entityCode}` : ''}</p>
          {e.entityCode && <button onClick={onDrill} className="shrink-0 text-[11px] font-semibold text-primary hover:underline">View all in log →</button>}
        </div>
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
