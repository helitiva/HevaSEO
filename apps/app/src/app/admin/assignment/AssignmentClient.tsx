'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlideOver } from '@/components/shared/SlideOver';
import { money, statusLabel, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';

interface CustSummary { id: string; name: string; company: string; email: string; tier: Tier; spend: number; orders: number; balance: number }
interface Cand { name: string; composite: number; quality: number; onTime: number; openLoad: number; capacity: number; skillMatch: boolean }
interface QueueItem {
  id: string; seq: number; code: string; customer: string; tier: Tier; service: string; pkg: string;
  priority: Priority; status: OrderStatus; value: number; deadline: string | null; daysToDue: number;
  created: string; ageDays: number; source: 'quick' | 'dashboard'; cust: CustSummary | null; suggested: string | null; pinnedTo: string | null; candidates: Cand[];
}
interface AssignedItem { id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; customer: string; tier: Tier; value: number; deadline: string | null; daysToDue: number; cust: CustSummary | null; home: string }
interface CardItem { id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; customer: string; tier: Tier; value: number; deadline?: string | null; daysToDue: number; cust: CustSummary | null; pinnedTo?: string | null; source?: 'quick' | 'dashboard'; site?: string; targetUrl?: string; project?: string; folder?: string }
interface StaffLite { id: string; name: string; skills: string[]; capacity: number; openLoad: number; composite: number; quality: number; onTime: number; throughput: number }
interface RuleLite { id: string; service: string; pkg: string | null; mode: 'pin' | 'auto'; target: string | null; priority: number; active: boolean }
interface Kpis { unassigned: number; overdueRisk: number; autoRoutablePct: number; utilizationPct: number; throughput: number }
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;

interface Props { queue: QueueItem[]; assigned: AssignedItem[]; staff: StaffLite[]; rules: RuleLite[]; kpis: Kpis; tierMeta: TierMeta }

const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize', Audit: 'optimize' };
const SERVICES = ['Keyword', 'Backlink', 'Content', 'Audit', 'Optimization', 'Web Design', 'Indexer'];

export function AssignmentClient({ queue, assigned, staff, rules, kpis, tierMeta }: Props) {
  // Unified placement: queue orders start unassigned (null); in-flight orders start on their home staff.
  const [place, setPlace] = useState<Record<string, string | null>>(() => ({
    ...Object.fromEntries(queue.map((q) => [q.id, null])),
    ...Object.fromEntries(assigned.map((a) => [a.id, a.home])),
  }));
  const [view, setView] = useState<'list' | 'board'>('list');
  const [ruleState, setRuleState] = useState(rules);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fService, setFService] = useState(''); const [fPriority, setFPriority] = useState(''); const [fTier, setFTier] = useState('');
  const [search, setSearch] = useState(''); const [sortBy, setSortBy] = useState<'priority' | 'due' | 'age'>('priority');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; onYes: () => void } | null>(null);
  const [ruleModal, setRuleModal] = useState<{ editing: RuleLite | null } | null>(null);
  const [history, setHistory] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  // record = toast + append to the assignment history log
  const record = (msg: string, icon = 'ph-arrow-right') => { notify(msg); setHistory((h) => [{ id: `${Date.now()}.${h.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text: msg, icon }, ...h].slice(0, 40)); };
  const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

  const allItems = useMemo<CardItem[]>(() => [...queue, ...assigned], [queue, assigned]);
  const pending = useMemo(() => queue.filter((q) => place[q.id] === null), [queue, place]);
  const itemsAt = (name: string) => allItems.filter((it) => place[it.id] === name);
  const loadOf = (name: string) => itemsAt(name).length;
  const capOf = (name: string) => staff.find((s) => s.name === name)?.capacity ?? 99;

  const bestFor = (q: QueueItem, extra: Record<string, number> = {}): string | null => {
    if (q.pinnedTo) return q.pinnedTo;
    if (!q.candidates.length) return null;
    const scored = q.candidates.map((c) => {
      const load = loadOf(c.name) + (extra[c.name] ?? 0); const cap = capOf(c.name);
      return { name: c.name, full: load >= cap, score: c.composite - 120 * (load / cap) };
    });
    const free = scored.filter((s) => !s.full);
    return (free.length ? free : scored).sort((a, b) => b.score - a.score)[0].name;
  };
  // Ranked staff list for the side panel (any order, not just queue items).
  const rankStaff = (service: string) => {
    const skill = SKILL_OF[service];
    const pool = skill ? staff.filter((s) => s.skills.includes(skill)) : staff;
    const scored = (pool.length ? pool : staff).map((s) => ({ name: s.name, skillMatch: skill ? s.skills.includes(skill) : false, load: loadOf(s.name), cap: s.capacity, quality: s.quality, onTime: s.onTime, score: s.composite - 120 * (loadOf(s.name) / s.capacity) }));
    const free = scored.filter((s) => s.load < s.cap);
    return (free.length ? free : scored).sort((a, b) => b.score - a.score);
  };

  const services = useMemo(() => [...new Set(queue.map((q) => q.service))], [queue]);
  const tiers = useMemo(() => [...new Set(queue.map((q) => q.tier))], [queue]);
  const visible = useMemo(() => pending
    .filter((q) => (!fService || q.service === fService) && (!fPriority || q.priority === fPriority) && (!fTier || q.tier === fTier)
      && (!search.trim() || `${q.code} ${q.customer}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => sortBy === 'due' ? a.daysToDue - b.daysToDue : sortBy === 'age' ? b.ageDays - a.ageDays : (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || a.daysToDue - b.daysToDue),
    [pending, fService, fPriority, fTier, search, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const selVisible = visible.filter((q) => sel.has(q.id));
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selAll = () => setSel((s) => (s.size === visible.length && visible.length ? new Set<string>() : new Set(visible.map((q) => q.id))));
  const bulkAuto = () => routeMany(selVisible, 'selected');
  const bulkAssign = (name: string) => {
    if (!name) return; const picks = Object.fromEntries(selVisible.map((q) => [q.id, name] as const));
    const n = selVisible.length; setPlace((p) => ({ ...p, ...picks })); setSel(new Set()); setBulkTo('');
    record(`Bulk-assigned ${n} order${n > 1 ? 's' : ''} → ${name}`, 'ph-users-three');
  };

  const moveTo = (id: string, target: string | null) => setPlace((p) => ({ ...p, [id]: target }));
  const doAssign = (id: string, name: string, code: string) => { moveTo(id, name); record(loadOf(name) >= capOf(name) ? `⚠ ${name} over capacity — assigned ${code} anyway` : `Assigned ${code} → ${name}`, 'ph-user-plus'); };
  // Guardrail: confirm before manually pushing an order onto a staff who is already full.
  const assignWithGuard = (id: string, name: string, code: string) => {
    if (loadOf(name) >= capOf(name)) setConfirm({ msg: `${name} is already at capacity (${loadOf(name)}/${capOf(name)}). Assign ${code} anyway?`, onYes: () => { doAssign(id, name, code); setConfirm(null); } });
    else doAssign(id, name, code);
  };
  // Auto-routing respects capacity: never push a staff past their limit; hold the rest.
  const routeMany = (items: QueueItem[], label: string) => {
    const extra: Record<string, number> = {}; const picks: Record<string, string> = {}; let held = 0;
    for (const q of items) {
      const name = bestFor(q, extra);
      if (name && loadOf(name) + (extra[name] ?? 0) < capOf(name)) { picks[q.id] = name; extra[name] = (extra[name] ?? 0) + 1; } else held++;
    }
    const n = Object.keys(picks).length;
    setPlace((p) => ({ ...p, ...picks })); setSel(new Set());
    record(n ? `Auto-routed ${n} ${label}${held ? ` · held ${held} (no free capacity)` : ''} — balanced by load` : held ? `Held ${held} — no free capacity` : 'Nothing to route', 'ph-magic-wand');
  };
  const autoAll = () => routeMany(pending, pending.length === 1 ? 'order' : 'orders');
  const rebalance = () => {
    const next = { ...place };
    const loadIn = (n: string) => allItems.filter((it) => next[it.id] === n).length;
    const util = (s: StaffLite) => loadIn(s.name) / s.capacity;
    let moved = 0;
    for (let i = 0; i < 30; i++) {
      const hi = staff.filter((s) => allItems.some((it) => next[it.id] === s.name)).sort((a, b) => util(b) - util(a))[0];
      const lo = staff.filter((s) => loadIn(s.name) < s.capacity).sort((a, b) => util(a) - util(b))[0];
      if (!hi || !lo || hi.name === lo.name || util(hi) - util(lo) <= 0.16) break;
      const orders = allItems.filter((it) => next[it.id] === hi.name)
        .sort((a, b) => (lo.skills.includes(SKILL_OF[b.service]) ? 1 : 0) - (lo.skills.includes(SKILL_OF[a.service]) ? 1 : 0));
      if (!orders[0]) break;
      next[orders[0].id] = lo.name; moved++;
    }
    setPlace(next);
    record(moved ? `Rebalanced ${moved} order${moved > 1 ? 's' : ''} across the team` : 'Load already balanced', 'ph-scales');
  };
  const panelItem = panelId ? allItems.find((x) => x.id === panelId) ?? null : null;
  // panel prev/next (through the full order list) + copy link + URL deep-link
  const panelIdx = panelId ? allItems.findIndex((x) => x.id === panelId) : -1;
  const prevItem = panelIdx > 0 ? allItems[panelIdx - 1] : null;
  const nextItem = panelIdx >= 0 && panelIdx < allItems.length - 1 ? allItems[panelIdx + 1] : null;
  const copyOrderLink = (id: string) => { try { void navigator.clipboard?.writeText(`${window.location.origin}/admin/assignment?order=${id}`); } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order');
    if (id && allItems.some((x) => x.id === id)) setPanelId(id);
  }, [allItems]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (panelId) url.searchParams.set('order', panelId); else url.searchParams.delete('order');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [panelId]);
  useEffect(() => {
    if (!panelItem) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' && nextItem) setPanelId(nextItem.id);
      else if (e.key === 'k' && prevItem) setPanelId(prevItem.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelItem, nextItem, prevItem]);
  const toggleRule = (id: string) => setRuleState((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  const saveRule = (r: RuleLite) => { setRuleState((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [...rs, r])); setRuleModal(null); record(`Rule saved · ${r.service} → ${r.mode === 'pin' ? r.target : 'skill pool'}`, 'ph-git-fork'); };
  const deleteRule = (id: string) => { setRuleState((rs) => rs.filter((x) => x.id !== id)); record('Routing rule removed', 'ph-trash'); };
  const drop = (target: string | null) => { if (dragId && place[dragId] !== target) { const it = allItems.find((x) => x.id === dragId); moveTo(dragId, target); record(target ? `Moved ${it?.code} → ${target}` : `${it?.code} returned to queue`, 'ph-arrows-left-right'); } setDragId(null); };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Assignment</h1>
          <p className="text-sm text-muted-foreground">Route the queue to the right staff and balance load.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-sm font-semibold">
            {(['list', 'board'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 capitalize transition ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><i className={`ph-bold ${v === 'list' ? 'ph-list-bullets' : 'ph-kanban'} mr-1`} />{v}</button>
            ))}
          </div>
          <button onClick={rebalance} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-scales mr-1" />Rebalance</button>
          <button onClick={autoAll} disabled={!pending.length} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"><i className="ph-bold ph-magic-wand mr-1" />Auto-assign all</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-tray" label="Unassigned" value={String(pending.length)} tone={pending.length ? 'warn' : 'good'} />
        <Kpi icon="ph-timer" label="Due ≤ 1 day" value={String(pending.filter((q) => q.daysToDue <= 1).length)} tone={pending.some((q) => q.daysToDue <= 1) ? 'warn' : undefined} />
        <Kpi icon="ph-magic-wand" label="Auto-routable" value={`${kpis.autoRoutablePct}%`} />
        <Kpi icon="ph-gauge" label="Team utilization" value={`${Math.round((staff.reduce((s, x) => s + loadOf(x.name), 0) / staff.reduce((s, x) => s + x.capacity, 0)) * 100)}%`} />
        <Kpi icon="ph-lightning" label="Throughput / day" value={String(kpis.throughput)} />
      </div>

      {view === 'list' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Card icon="ph-tray-arrow-down" title="Assignment queue" right={
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'priority' | 'due' | 'age')} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary">
                <option value="priority">Sort: Priority</option><option value="due">Sort: Due soon</option><option value="age">Sort: Longest waiting</option>
              </select>
            }>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Sel value={fService} onChange={setFService} all="All services" opts={services} />
                <Sel value={fPriority} onChange={setFPriority} all="All priority" opts={['high', 'med', 'low']} />
                <Sel value={fTier} onChange={setFTier} all="All tiers" opts={tiers} />
                <div className="relative"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code / customer" className="w-44 rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:border-primary" /></div>
                {(fService || fPriority || fTier || search) && <button onClick={() => { setFService(''); setFPriority(''); setFTier(''); setSearch(''); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
                <span className="ml-auto text-xs text-muted-foreground">{visible.length} of {pending.length}</span>
              </div>
              {sel.size > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-semibold">{selVisible.length} selected</span>
                  <span className="ml-auto" />
                  <button onClick={bulkAuto} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-magic-wand mr-1" />Auto-assign</button>
                  <select value={bulkTo} onChange={(e) => bulkAssign(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"><option value="">Assign all to…</option>{staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                  <button onClick={() => setSel(new Set())} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
                </div>
              )}
              {pending.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground"><i className="ph-bold ph-check-circle mr-1 text-emerald-500" />All caught up — the queue is clear.</p>
              ) : visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No orders match these filters.</p>
              ) : (
                <div className="scrollbar-thin max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                  <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={visible.length > 0 && selVisible.length === visible.length} onChange={selAll} className="accent-primary" />Select all ({visible.length})</label>
                  {visible.map((q) => { const best = bestFor(q); return (
                    <div key={q.id} onClick={() => setPanelId(q.id)} title="Open order details" className={`cursor-pointer rounded-xl border bg-background/40 p-3 transition hover:border-primary/40 ${sel.has(q.id) ? 'border-primary/50' : 'border-border'}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <input type="checkbox" checked={sel.has(q.id)} onChange={() => toggleSel(q.id)} onClick={(e) => e.stopPropagation()} className="accent-primary" />
                        <PriorityBadge priority={q.priority} />
                        <button onClick={() => setPanelId(q.id)} className="font-semibold hover:text-primary hover:underline" title="Open order">{q.code}</button>
                        <span className="text-sm text-muted-foreground">{q.service} · {q.pkg}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-fill ${tierMeta[q.tier].icon}`} style={{ color: tierMeta[q.tier].color }} />{q.customer}</span>
                        <Due d={q.daysToDue} />
                        <span className={`inline-flex items-center gap-1 text-xs ${q.ageDays >= 3 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`} title="Waiting in queue"><i className="ph-bold ph-hourglass-medium" />{q.ageDays}d wait</span>
                        <span className="ml-auto" />
                        {best && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" title={q.pinnedTo ? 'Pinned by routing rule' : 'Load-aware best match'}>
                            <i className={`ph-bold ${q.pinnedTo ? 'ph-push-pin' : 'ph-scales'}`} />{best}
                          </span>
                        )}
                        {best && <button onClick={(e) => { e.stopPropagation(); assignWithGuard(q.id, best, q.code); }} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Assign</button>}
                        <button onClick={(e) => { e.stopPropagation(); setExpanded((x) => (x === q.id ? null : q.id)); }} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent">Pick<i className={`ph-bold ph-caret-down ml-0.5 transition ${expanded === q.id ? 'rotate-180' : ''}`} /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title="Order value"><i className="ph-bold ph-currency-dollar text-emerald-500" /><b className="text-foreground">{money(q.value)}</b></span>
                        <span className="inline-flex items-center gap-1" title="Order status"><i className="ph-bold ph-circle-dashed" />{statusLabel[q.status]}</span>
                        <span className="inline-flex items-center gap-1" title="Source"><i className="ph-bold ph-path" />via {q.source}</span>
                        {q.deadline && <span className="inline-flex items-center gap-1" title="Deadline"><i className="ph-bold ph-calendar-blank" />{q.deadline}</span>}
                        {q.cust && (
                          <>
                            <span className="text-border">•</span>
                            <span className="inline-flex items-center gap-1 font-medium text-foreground"><i className="ph-fill ph-user-circle text-primary" />{q.cust.name}</span>
                            <span className="inline-flex items-center gap-1" title="Lifetime value"><i className="ph-bold ph-coins" />LTV {money(q.cust.spend)}</span>
                            <span className="inline-flex items-center gap-1" title="Total orders"><i className="ph-bold ph-package" />{q.cust.orders} orders</span>
                            <span className="inline-flex items-center gap-1" title="Credit balance"><i className="ph-bold ph-wallet" />{money(q.cust.balance)} credit</span>
                          </>
                        )}
                      </div>
                      {expanded === q.id && (
                        <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-1 border-t border-border pt-2">
                          {q.candidates.map((c) => { const load = loadOf(c.name); const over = load >= c.capacity;
                            return (
                              <div key={c.name} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-muted ${c.name === best ? 'bg-primary/5' : ''}`}>
                                <span className="font-medium">{c.name}</span>
                                {c.name === best && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">recommended</span>}
                                {c.skillMatch && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">skill match</span>}
                                {q.pinnedTo === c.name && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">pinned</span>}
                                <span className="text-muted-foreground">score {c.composite} · Q{c.quality} · {c.onTime}% on-time</span>
                                <span className={`ml-auto ${over ? 'text-destructive' : 'text-muted-foreground'}`}>load {load}/{c.capacity}</span>
                                <button onClick={() => doAssign(q.id, c.name, q.code)} className="rounded-md border border-border px-2 py-0.5 font-semibold hover:bg-accent">Assign</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ); })}
                </div>
              )}
            </Card>
          </div>

          <div className="min-w-0 space-y-4">
            <Card icon="ph-users-three" title="Staff workload">
              <div className="space-y-3">
                {staff.map((s) => { const load = loadOf(s.name); const pct = Math.round((load / s.capacity) * 100); const full = load >= s.capacity;
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between text-sm"><span className="font-medium">{s.name}</span><span className={`text-xs font-semibold ${full ? 'text-destructive' : 'text-muted-foreground'}`}>{load}/{s.capacity}{full ? ' · full' : ''}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: full ? 'hsl(var(--destructive))' : pct > 80 ? '#f59e0b' : 'hsl(var(--primary))' }} /></div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.skills.join(' · ')} · Q{s.quality} · {s.onTime}% on-time</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: `${(staff.length + 1) * 16}rem` }}>
            <Column title="Unassigned" sub={`${pending.length}`} accent="muted" onDrop={() => drop(null)} dragId={dragId}>
              {pending.map((q) => <OrderCard key={q.id} q={q} best={bestFor(q)} tierMeta={tierMeta} onDragStart={() => setDragId(q.id)} onOpen={() => setPanelId(q.id)} />)}
              {pending.length === 0 && <Empty>Queue clear</Empty>}
            </Column>
            {staff.map((s) => { const load = loadOf(s.name); const full = load >= s.capacity; const items = itemsAt(s.name);
              return (
                <Column key={s.id} title={s.name} sub={`${load}/${s.capacity}`} accent={full ? 'danger' : load / s.capacity > 0.8 ? 'warn' : 'ok'} onDrop={() => drop(s.name)} dragId={dragId} skills={s.skills}>
                  {items.map((it) => <OrderCard key={it.id} q={it} placed tierMeta={tierMeta} onDragStart={() => setDragId(it.id)} onOpen={() => setPanelId(it.id)} />)}
                  {items.length === 0 && <Empty>Drop orders here</Empty>}
                </Column>
              );
            })}
          </div>
        </div>
      )}

      {/* assignment history */}
      <Card icon="ph-clock-counter-clockwise" title="Assignment history" right={<span className="text-xs text-muted-foreground">{history.length} event{history.length === 1 ? '' : 's'}</span>}>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No actions yet — assign, auto-route or rebalance and it shows up here.</p>
        ) : (
          <ul className="scrollbar-thin max-h-72 space-y-2 overflow-y-auto pr-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} /></span>
                <span className="min-w-0 flex-1 truncate">{h.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.at}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* routing rules */}
      <Card icon="ph-git-fork" title="Routing rules" right={<button onClick={() => setRuleModal({ editing: null })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-plus mr-1" />New rule</button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="p-2">Service</th><th className="p-2">Mode</th><th className="p-2">Target</th><th className="p-2 text-right">Priority</th><th className="p-2 text-right">Active</th></tr></thead>
            <tbody>
              {ruleState.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-2 font-medium">{r.service}{r.pkg ? ` · ${r.pkg}` : ''}</td>
                  <td className="p-2"><span className={`pill ${r.mode === 'pin' ? 'pill-warn' : 'pill-good'}`}><i className={`ph-bold ${r.mode === 'pin' ? 'ph-push-pin' : 'ph-magic-wand'} mr-0.5`} />{r.mode === 'pin' ? 'pinned' : 'skill pool'}</span></td>
                  <td className="p-2">{r.target ?? <span className="text-muted-foreground">auto · best match</span>}</td>
                  <td className="p-2 text-right text-muted-foreground">{r.priority}</td>
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-2.5">
                      <button onClick={() => setRuleModal({ editing: r })} className="text-muted-foreground hover:text-foreground" title="Edit rule"><i className="ph-bold ph-pencil-simple" /></button>
                      <button onClick={() => deleteRule(r.id)} className="text-muted-foreground hover:text-destructive" title="Remove rule"><i className="ph-bold ph-trash" /></button>
                      <button onClick={() => toggleRule(r.id)} role="switch" aria-checked={r.active} className={`relative h-5 w-9 rounded-full transition ${r.active ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${r.active ? 'left-[18px]' : 'left-0.5'}`} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground"><b className="text-foreground">Pinned</b> forces one person; <b className="text-foreground">skill pool</b> auto-routes to the best-scoring available staff with the matching skill.</p>
      </Card>

      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="modal-in relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="flex items-start gap-2 text-sm"><i className="ph-bold ph-warning-circle mt-0.5 text-amber-500" />{confirm.msg}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={confirm.onYes} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Assign anyway</button>
            </div>
          </div>
        </div>
      )}
      {ruleModal && <RuleModal editing={ruleModal.editing} staff={staff} onClose={() => setRuleModal(null)} onSave={saveRule} />}
      {panelItem && (
        <SlideOver open onClose={() => setPanelId(null)} title={panelItem.code}>
          <OrderPanelBody item={panelItem} current={place[panelItem.id] ?? null} ranked={rankStaff(panelItem.service)} tierMeta={tierMeta}
            prev={prevItem} next={nextItem} onNav={setPanelId} onCopy={() => copyOrderLink(panelItem.id)} copied={copied}
            onAssign={(name) => assignWithGuard(panelItem.id, name, panelItem.code)}
            onUnassign={() => { moveTo(panelItem.id, null); record(`${panelItem.code} returned to queue`, 'ph-arrow-u-up-left'); }} />
        </SlideOver>
      )}
      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

function Due({ d }: { d: number }) {
  if (!Number.isFinite(d) || d >= 9999) return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><i className="ph-bold ph-clock" />no deadline</span>;
  const tone = d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}><i className="ph-bold ph-clock" />{d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : `${d}d left`}</span>;
}
function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div><p className="display mt-1 text-xl font-bold tracking-tight">{value}</p></div>;
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">{children}</p>;
}
function Sel({ value, onChange, all, opts }: { value: string; onChange: (v: string) => void; all: string; opts: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs capitalize outline-none focus:border-primary"><option value="">{all}</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}
function RuleModal({ editing, staff, onClose, onSave }: { editing: RuleLite | null; staff: StaffLite[]; onClose: () => void; onSave: (r: RuleLite) => void }) {
  const [service, setService] = useState(editing?.service ?? SERVICES[0]);
  const [pkg, setPkg] = useState(editing?.pkg ?? '');
  const [mode, setMode] = useState<'pin' | 'auto'>(editing?.mode ?? 'auto');
  const [target, setTarget] = useState(editing?.target ?? staff[0]?.name ?? '');
  const [priority, setPriority] = useState(String(editing?.priority ?? 50));
  const inp = 'rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary';
  const submit = () => onSave({ id: editing?.id ?? `r${Date.now()}`, service, pkg: pkg.trim() || null, mode, target: mode === 'pin' ? target : null, priority: Number(priority) || 50, active: editing?.active ?? true });
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="display mb-4 text-base font-bold">{editing ? 'Edit routing rule' : 'New routing rule'}</p>
        <div className="space-y-3">
          <Row2 label="Service"><select value={service} onChange={(e) => setService(e.target.value)} className={inp}>{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Row2>
          <Row2 label="Package"><input value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="All packages" className={inp} /></Row2>
          <Row2 label="Mode">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-sm font-semibold">
              {(['auto', 'pin'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 transition ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{m === 'auto' ? 'Skill pool' : 'Pinned'}</button>)}
            </div>
          </Row2>
          {mode === 'pin' && <Row2 label="Assign to"><select value={target} onChange={(e) => setTarget(e.target.value)} className={inp}>{staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></Row2>}
          <Row2 label="Priority"><input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className={`${inp} w-24`} /></Row2>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Save rule</button>
        </div>
      </div>
    </div>
  );
}
function Row2({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">{label}</span><div>{children}</div></label>;
}
function OrderPanelBody({ item, current, ranked, tierMeta, prev, next, onNav, onCopy, copied, onAssign, onUnassign }: {
  item: CardItem; current: string | null; ranked: { name: string; skillMatch: boolean; load: number; cap: number }[]; tierMeta: TierMeta;
  prev: CardItem | null; next: CardItem | null; onNav: (id: string) => void; onCopy: () => void; copied: boolean;
  onAssign: (name: string) => void; onUnassign: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => prev && onNav(prev.id)} disabled={!prev} title="Previous (k)" aria-label="Previous order" className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"><i className="ph-bold ph-caret-left" /></button>
          <button onClick={() => next && onNav(next.id)} disabled={!next} title="Next (j)" aria-label="Next order" className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-accent disabled:opacity-30"><i className="ph-bold ph-caret-right" /></button>
        </div>
        <PriorityBadge priority={item.priority} /><StatusBadge status={item.status} /><Due d={item.daysToDue} />
        <button onClick={onCopy} title="Copy shareable link" className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"><i className={`ph-bold ${copied ? 'ph-check text-emerald-500' : 'ph-link-simple'}`} />{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <PanelSection title="Order">
        <KV label="Service" value={`${item.service} · ${item.pkg}`} />
        <KV label="Order value" value={money(item.value)} />
        <KV label="Deadline" value={item.deadline ?? '—'} />
        {item.source && <KV label="Source" value={`via ${item.source}`} />}
        {item.site && <KV label="Site" value={item.site} />}
        {item.targetUrl && <KVRow label="Target URL"><a href={item.targetUrl} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-primary hover:underline">{item.targetUrl}</a></KVRow>}
        {item.project && <KVRow label="Filed under"><span className="inline-flex items-center gap-1 text-sm font-medium"><i className="ph-bold ph-folders text-muted-foreground" />{item.project}<i className="ph-bold ph-caret-right text-muted-foreground" />{item.folder}</span></KVRow>}
      </PanelSection>

      <PanelSection title="Assignment">
        <p className="mb-2 text-sm">Currently: {current ? <b>{current}</b> : <span className="font-semibold text-amber-600">Unassigned</span>}{current && <button onClick={onUnassign} className="ml-2 text-xs text-muted-foreground hover:underline">return to queue</button>}</p>
        <div className="space-y-1.5">
          {ranked.map((c, i) => (
            <div key={c.name} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${current === c.name ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <span className="font-medium">{c.name}</span>
              {i === 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">recommended</span>}
              {c.skillMatch && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">skill</span>}
              <span className={`ml-auto text-xs ${c.load >= c.cap ? 'text-destructive' : 'text-muted-foreground'}`}>{c.load}/{c.cap}</span>
              <button onClick={() => onAssign(c.name)} disabled={current === c.name} className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">{current === c.name ? 'Assigned' : 'Assign'}</button>
            </div>
          ))}
        </div>
      </PanelSection>

      {item.cust && (
        <PanelSection title="Customer">
          <div className="flex items-center gap-2"><span className="font-semibold">{item.cust.name}</span><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tierMeta[item.cust.tier].color }}><i className={`ph-fill ${tierMeta[item.cust.tier].icon}`} />{tierMeta[item.cust.tier].label}</span></div>
          <p className="text-xs text-muted-foreground">{item.cust.company} · {item.cust.email}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Mini label="LTV" value={money(item.cust.spend)} />
            <Mini label="Orders" value={String(item.cust.orders)} />
            <Mini label="Credit" value={money(item.cust.balance)} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Link href={`/admin/customers/${item.cust.id}`} className="font-semibold text-primary hover:underline">Customer profile →</Link>
            <a href={`/admin/customers/${item.cust.id}`} target="_blank" rel="noopener noreferrer" title="Open profile in a new tab" className="text-muted-foreground hover:text-primary"><i className="ph-bold ph-arrow-square-out" /></a>
          </div>
        </PanelSection>
      )}

      <div className="flex items-stretch gap-2">
        <Link href={`/admin/orders/${item.id}`} className="flex-1 rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open full order →</Link>
        <a href={`/admin/orders/${item.id}`} target="_blank" rel="noopener noreferrer" title="Open order in a new tab" aria-label="Open order in a new tab" className="grid shrink-0 place-items-center rounded-lg border border-border px-3 hover:bg-accent"><i className="ph-bold ph-arrow-square-out" /></a>
      </div>
    </div>
  );
}
function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{children}</div>;
}
function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function KVRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 text-sm last:border-0"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right">{children}</span></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function Column({ title, sub, accent, skills, children, onDrop, dragId }: { title: string; sub: string; accent: 'muted' | 'ok' | 'warn' | 'danger'; skills?: string[]; children: ReactNode; onDrop: () => void; dragId: string | null }) {
  const [over, setOver] = useState(false);
  const dot = accent === 'danger' ? 'bg-destructive' : accent === 'warn' ? 'bg-amber-500' : accent === 'ok' ? 'bg-emerald-500' : 'bg-muted-foreground';
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={() => { setOver(false); onDrop(); }}
      className={`w-64 shrink-0 rounded-2xl border bg-card p-3 transition ${over && dragId ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><span className={`h-2 w-2 rounded-full ${dot}`} />{title}</span>
        <span className="text-xs font-semibold text-muted-foreground">{sub}</span>
      </div>
      {skills && <p className="mb-2 px-1 text-[10px] text-muted-foreground">{skills.join(' · ')}</p>}
      <div className="scrollbar-thin max-h-[62vh] space-y-2 overflow-y-auto pr-0.5">{children}</div>
    </div>
  );
}
function OrderCard({ q, tierMeta, placed, best, onDragStart, onOpen }: { q: CardItem; tierMeta: TierMeta; placed?: boolean; best?: string | null; onDragStart: () => void; onOpen?: () => void }) {
  return (
    <div draggable onDragStart={onDragStart} onClick={onOpen} className="cursor-pointer rounded-xl border border-border bg-background/50 p-2.5 transition hover:border-primary/50 active:cursor-grabbing">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{q.code}</span><PriorityBadge priority={q.priority} /></div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{q.service} · {q.pkg}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><i className={`ph-fill ${tierMeta[q.tier].icon}`} style={{ color: tierMeta[q.tier].color }} />{q.customer}</span>
        <Due d={q.daysToDue} />
      </div>
      {placed ? <div className="mt-1.5"><StatusBadge status={q.status} /></div>
        : best && <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-primary"><i className={`ph-bold ${q.pinnedTo ? 'ph-push-pin' : 'ph-scales'}`} />{q.pinnedTo ? 'pinned' : 'best'}: {best}</p>}
    </div>
  );
}
