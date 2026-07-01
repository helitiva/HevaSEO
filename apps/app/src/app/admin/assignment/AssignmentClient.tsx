'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlideOver } from '@/components/shared/SlideOver';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { CustomerHoverCard } from '@/components/admin/CustomerHoverCard';
import { OrderDetailClient } from '@/app/admin/orders/[id]/OrderDetailClient';
import { buildOrderDetailProps } from '@/lib/orderDetail';
import { statusLabel, SKILL_META, type OrderStatus, type Priority, type Tier } from '@/data/adminMock';
import { useMoney, useShowMoney } from '@/lib/viewer';
import { assignOrderAction } from './assign.actions';

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
  const money = useMoney();
  const showMoney = useShowMoney();
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
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  // record = toast + append to the assignment history log
  const record = (msg: string, icon = 'ph-arrow-right') => { notify(msg); setHistory((h) => [{ id: `${Date.now()}.${h.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text: msg, icon }, ...h].slice(0, 40)); };
  const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

  const allItems = useMemo<CardItem[]>(() => [...queue, ...assigned], [queue, assigned]);
  const pending = useMemo(() => queue.filter((q) => place[q.id] === null), [queue, place]);
  const itemsAt = (name: string) => allItems.filter((it) => place[it.id] === name);
  const loadOf = (name: string) => itemsAt(name).length;
  // Deadline pressure for the staff panel — NON-overlapping buckets (overdue · today · in 1–3d ·
  // in 4–7d) so the windows don't double-count, plus revision rounds in progress. Counts the live
  // in-flight items currently placed on the staffer.
  const workloadOf = (name: string) => {
    const items = itemsAt(name);
    const win = (lo: number, hi: number) => items.filter((it) => it.daysToDue >= lo && it.daysToDue <= hi).length;
    return {
      overdue: items.filter((it) => it.daysToDue < 0).length,
      today: win(0, 0),
      soon: win(1, 3),
      week: win(4, 7),
      revision: items.filter((it) => it.status === 'changes_requested').length,
    };
  };
  // Stable "most available first" order (from the initial in-flight load, so rows don't reshuffle
  // while you assign). Ties broken by score.
  const staffByAvail = useMemo(
    () => [...staff].sort((a, b) => (b.capacity - b.openLoad) - (a.capacity - a.openLoad) || b.composite - a.composite),
    [staff],
  );
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
  // Lane A cleanup — persist an assignment to the DB (assign_order, admin-gated). name→profile id from
  // the real staff roster; optimistic UI already moved the card, so this just records it (toast on error).
  const idOfName = useMemo(() => { const m = new Map<string, string>(); for (const s of staff) m.set(s.name, s.id); return m; }, [staff]);
  const persist = (orderId: string, name: string | null) => {
    if (!name) return; const sid = idOfName.get(name); if (!sid) return;
    void assignOrderAction(orderId, sid).then((r) => { if (!r.ok) record(`⚠ ${r.error}`, 'ph-warning'); });
  };

  const bulkAuto = () => routeMany(selVisible, 'selected');
  const bulkAssign = (name: string) => {
    if (!name) return; const picks = Object.fromEntries(selVisible.map((q) => [q.id, name] as const));
    const n = selVisible.length; setPlace((p) => ({ ...p, ...picks })); setSel(new Set()); setBulkTo('');
    for (const id of Object.keys(picks)) persist(id, name);
    record(`Bulk-assigned ${n} order${n > 1 ? 's' : ''} → ${name}`, 'ph-users-three');
  };

  const moveTo = (id: string, target: string | null) => setPlace((p) => ({ ...p, [id]: target }));
  const doAssign = (id: string, name: string, code: string) => { moveTo(id, name); persist(id, name); record(loadOf(name) >= capOf(name) ? `⚠ ${name} over capacity — assigned ${code} anyway` : `Assigned ${code} → ${name}`, 'ph-user-plus'); };
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
    for (const [id, name] of Object.entries(picks)) persist(id, name);
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
      next[orders[0].id] = lo.name; persist(orders[0].id, lo.name); moved++;
    }
    setPlace(next);
    record(moved ? `Rebalanced ${moved} order${moved > 1 ? 's' : ''} across the team` : 'Load already balanced', 'ph-scales');
  };
  const panelItem = panelId ? allItems.find((x) => x.id === panelId) ?? null : null;
  // panel prev/next (through the full order list) + copy link + URL deep-link
  const panelIdx = panelId ? allItems.findIndex((x) => x.id === panelId) : -1;
  const prevItem = panelIdx > 0 ? allItems[panelIdx - 1] : null;
  const nextItem = panelIdx >= 0 && panelIdx < allItems.length - 1 ? allItems[panelIdx + 1] : null;
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
          <button onClick={rebalance} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent"><i className="ph-bold ph-scales mr-1" aria-hidden />Rebalance</button>
          <button onClick={autoAll} disabled={!pending.length} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"><i className="ph-bold ph-magic-wand mr-1" aria-hidden />Auto-assign all</button>
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
                <div className="relative"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code / customer" className="w-44 rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:border-primary" /></div>
                {(fService || fPriority || fTier || search) && <button onClick={() => { setFService(''); setFPriority(''); setFTier(''); setSearch(''); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
                <span className="ml-auto text-xs text-muted-foreground">{visible.length} of {pending.length}</span>
              </div>
              {sel.size > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-sm font-semibold">{selVisible.length} selected</span>
                  <span className="ml-auto" />
                  <button onClick={bulkAuto} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><i className="ph-bold ph-magic-wand mr-1" aria-hidden />Auto-assign</button>
                  <select value={bulkTo} onChange={(e) => bulkAssign(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"><option value="">Assign all to…</option>{staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                  <button onClick={() => setSel(new Set())} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
                </div>
              )}
              {pending.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground"><i className="ph-bold ph-check-circle mr-1 text-emerald-500" aria-hidden />All caught up — the queue is clear.</p>
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
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-fill ${tierMeta[q.tier].icon}`} style={{ color: tierMeta[q.tier].color }} aria-hidden />{q.customer}</span>
                        <Due d={q.daysToDue} />
                        <span className={`inline-flex items-center gap-1 text-xs ${q.ageDays >= 3 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`} title="Waiting in queue"><i className="ph-bold ph-hourglass-medium" aria-hidden />{q.ageDays}d wait</span>
                        <span className="ml-auto" />
                        {best && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" title={q.pinnedTo ? 'Pinned by routing rule' : 'Load-aware best match'}>
                            <i className={`ph-bold ${q.pinnedTo ? 'ph-push-pin' : 'ph-scales'}`} aria-hidden />{best}
                          </span>
                        )}
                        {best && <button onClick={(e) => { e.stopPropagation(); assignWithGuard(q.id, best, q.code); }} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Assign</button>}
                        <button onClick={(e) => { e.stopPropagation(); setExpanded((x) => (x === q.id ? null : q.id)); }} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent">Pick<i className={`ph-bold ph-caret-down ml-0.5 transition ${expanded === q.id ? 'rotate-180' : ''}`} aria-hidden /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                        {showMoney && <span className="inline-flex items-center gap-1" title="Order value"><i className="ph-bold ph-currency-dollar text-emerald-500" aria-hidden /><b className="text-foreground">{money(q.value)}</b></span>}
                        <span className="inline-flex items-center gap-1" title="Order status"><i className="ph-bold ph-circle-dashed" aria-hidden />{statusLabel[q.status]}</span>
                        <span className="inline-flex items-center gap-1" title="Source"><i className="ph-bold ph-path" aria-hidden />via {q.source}</span>
                        {q.deadline && <span className="inline-flex items-center gap-1" title="Deadline"><i className="ph-bold ph-calendar-blank" aria-hidden />{q.deadline}</span>}
                        {q.cust && (
                          <>
                            <span className="text-border">•</span>
                            <CustomerHoverCard customer={q.customer}><span className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"><i className="ph-fill ph-user-circle text-primary" aria-hidden />{q.cust.name}</span></CustomerHoverCard>
                            {showMoney && <span className="inline-flex items-center gap-1" title="Lifetime value"><i className="ph-bold ph-coins" aria-hidden />LTV {money(q.cust.spend)}</span>}
                            <span className="inline-flex items-center gap-1" title="Total orders"><i className="ph-bold ph-package" aria-hidden />{q.cust.orders} orders</span>
                            {showMoney && <span className="inline-flex items-center gap-1" title="Credit balance"><i className="ph-bold ph-wallet" aria-hidden />{money(q.cust.balance)} credit</span>}
                          </>
                        )}
                      </div>
                      {expanded === q.id && (
                        <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-1 border-t border-border pt-2">
                          {q.candidates.map((c) => { const load = loadOf(c.name); const over = load >= c.capacity;
                            return (
                              <div key={c.name} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-muted ${c.name === best ? 'bg-primary/5' : ''}`}>
                                <StaffHoverCard staff={c.name}><span className="font-medium underline-offset-2 hover:underline">{c.name}</span></StaffHoverCard>
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
            <Card icon="ph-users-three" title="Staff workload" right={<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><i className="ph-bold ph-sort-ascending" aria-hidden />most available first</span>}>
              <div className="space-y-2">
                {staffByAvail.map((s) => {
                  const load = loadOf(s.name);
                  const free = s.capacity - load;
                  const pct = Math.round((load / s.capacity) * 100);
                  const w = workloadOf(s.name);
                  const near = w.overdue + w.today + w.soon + w.week + w.revision;
                  const state = load > s.capacity ? 'over' : load === s.capacity ? 'full' : free >= 2 ? 'open' : 'tight';
                  const dot = state === 'over' ? 'bg-destructive' : state === 'full' ? 'bg-amber-500' : state === 'open' ? 'bg-emerald-500' : 'bg-primary';
                  const barBg = state === 'over' ? 'hsl(var(--destructive))' : state === 'full' || pct > 80 ? '#f59e0b' : 'hsl(var(--primary))';
                  const avail = state === 'over'
                    ? <span className="pill pill-bad">over +{load - s.capacity}</span>
                    : state === 'full'
                      ? <span className="pill pill-warn">full</span>
                      : <span className="pill pill-good">+{free} free</span>;
                  return (
                    <div key={s.id} className={`rounded-xl border p-2.5 transition ${state === 'over' ? 'border-destructive/40' : state === 'open' ? 'border-emerald-500/30' : 'border-border/70'}`}>
                      {/* identity + skills + availability */}
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                        <StaffHoverCard staff={s.id}><span className="text-sm font-semibold underline-offset-2 hover:underline">{s.name}</span></StaffHoverCard>
                        <span className="flex items-center gap-1">
                          {s.skills.map((k) => SKILL_META[k] && <i key={k} className={`ph-fill ${SKILL_META[k].icon} text-xs`} style={{ color: SKILL_META[k].color }} title={SKILL_META[k].label} aria-hidden />)}
                        </span>
                        <span className="ml-auto shrink-0">{avail}</span>
                      </div>
                      {/* capacity bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barBg }} /></div>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">{load}/{s.capacity}</span>
                      </div>
                      {/* deadline pressure (only what's > 0) + quality */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                        {w.overdue > 0 && <Urg tone="bad" icon="ph-warning-circle" n={w.overdue} label="overdue" />}
                        {w.today > 0 && <Urg tone="warn" n={w.today} label="today" />}
                        {w.soon > 0 && <Urg tone="soft" n={w.soon} label="in D1–D3" />}
                        {w.week > 0 && <Urg tone="mute" n={w.week} label="in D4–D7" />}
                        {w.revision > 0 && <Urg tone="rev" icon="ph-arrow-counter-clockwise" n={w.revision} label="revision" />}
                        {near === 0 && <span className="text-muted-foreground">No near-term deadlines</span>}
                        <span className="ml-auto shrink-0 text-muted-foreground">Q{s.quality} · {s.onTime}%</span>
                      </div>
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
      <Card icon="ph-git-fork" title="Routing rules" right={<button onClick={() => setRuleModal({ editing: null })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-plus mr-1" aria-hidden />New rule</button>}>
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
                      <button onClick={() => setRuleModal({ editing: r })} className="text-muted-foreground hover:text-foreground" title="Edit rule" aria-label="Edit rule"><i className="ph-bold ph-pencil-simple" aria-hidden /></button>
                      <button onClick={() => deleteRule(r.id)} className="text-muted-foreground hover:text-destructive" title="Remove rule" aria-label="Remove rule"><i className="ph-bold ph-trash" aria-hidden /></button>
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
            <p className="flex items-start gap-2 text-sm"><i className="ph-bold ph-warning-circle mt-0.5 text-amber-500" aria-hidden />{confirm.msg}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={confirm.onYes} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Assign anyway</button>
            </div>
          </div>
        </div>
      )}
      {ruleModal && <RuleModal editing={ruleModal.editing} staff={staff} onClose={() => setRuleModal(null)} onSave={saveRule} />}
      {panelItem && (
        <SlideOver open onClose={() => setPanelId(null)} title={panelItem.code} widthClass="max-w-5xl">
          {(() => {
            const detail = buildOrderDetailProps(panelItem.id);
            return detail ? <OrderDetailClient key={detail.order.id} {...detail} /> : null;
          })()}
        </SlideOver>
      )}
      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

function Due({ d }: { d: number }) {
  if (!Number.isFinite(d) || d >= 9999) return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><i className="ph-bold ph-clock" aria-hidden />no deadline</span>;
  const tone = d < 0 ? 'text-destructive' : d <= 1 ? 'text-amber-600' : 'text-muted-foreground';
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}><i className="ph-bold ph-clock" aria-hidden />{d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : `${d}d left`}</span>;
}
function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div><p className="display mt-1 text-xl font-bold tracking-tight">{value}</p></div>;
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
// A deadline-pressure chip (only rendered when its bucket is > 0).
const URG_TONE: Record<string, string> = {
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  soft: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  mute: 'bg-primary/10 text-primary',
  rev: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};
function Urg({ tone, icon, n, label }: { tone: 'bad' | 'warn' | 'soft' | 'mute' | 'rev'; icon?: string; n: number; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${URG_TONE[tone]}`}>{icon && <i className={`ph-bold ${icon}`} aria-hidden />}<span className="tabular-nums">{n}</span> {label}</span>;
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
