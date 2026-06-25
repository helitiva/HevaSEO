'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { type OrderStatus, type Priority, type Tier } from '@/data/adminMock';

interface Cand { name: string; composite: number; quality: number; onTime: number; openLoad: number; capacity: number; skillMatch: boolean }
interface QueueItem {
  id: string; seq: number; code: string; customer: string; tier: Tier; service: string; pkg: string;
  priority: Priority; status: OrderStatus; value: number; deadline: string | null; daysToDue: number;
  created: string; ageDays: number; suggested: string | null; pinnedTo: string | null; candidates: Cand[];
}
interface AssignedItem { id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; customer: string; tier: Tier; deadline: string | null; daysToDue: number; home: string }
interface CardItem { id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; customer: string; tier: Tier; daysToDue: number; pinnedTo?: string | null }
interface StaffLite { id: string; name: string; skills: string[]; capacity: number; openLoad: number; composite: number; quality: number; onTime: number; throughput: number }
interface RuleLite { id: string; service: string; pkg: string | null; mode: 'pin' | 'auto'; target: string | null; priority: number; active: boolean }
interface Kpis { unassigned: number; overdueRisk: number; autoRoutablePct: number; utilizationPct: number; throughput: number }
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;

interface Props { queue: QueueItem[]; assigned: AssignedItem[]; staff: StaffLite[]; rules: RuleLite[]; kpis: Kpis; tierMeta: TierMeta }

const SKILL_OF: Record<string, string> = { Keyword: 'keyword', Backlink: 'backlink', Content: 'content', Optimization: 'optimize', Audit: 'optimize' };

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
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
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
  const bulkAuto = () => {
    const extra: Record<string, number> = {}; const picks: Record<string, string> = {};
    for (const q of selVisible) { const name = bestFor(q, extra); if (name) { picks[q.id] = name; extra[name] = (extra[name] ?? 0) + 1; } }
    const n = Object.keys(picks).length; setPlace((p) => ({ ...p, ...picks })); setSel(new Set());
    notify(n ? `Auto-routed ${n} selected — balanced by load` : 'Nothing routed');
  };
  const bulkAssign = (name: string) => {
    if (!name) return; const picks = Object.fromEntries(selVisible.map((q) => [q.id, name] as const));
    const n = selVisible.length; setPlace((p) => ({ ...p, ...picks })); setSel(new Set()); setBulkTo('');
    notify(`Assigned ${n} order${n > 1 ? 's' : ''} → ${name}`);
  };

  const moveTo = (id: string, target: string | null) => setPlace((p) => ({ ...p, [id]: target }));
  const doAssign = (id: string, name: string, code: string) => { moveTo(id, name); notify(loadOf(name) >= capOf(name) ? `⚠ ${name} is at capacity — assigned ${code} anyway` : `Assigned ${code} → ${name}`); };
  const autoAll = () => {
    const extra: Record<string, number> = {}; const picks: Record<string, string> = {};
    for (const q of pending) { const name = bestFor(q, extra); if (name) { picks[q.id] = name; extra[name] = (extra[name] ?? 0) + 1; } }
    const n = Object.keys(picks).length;
    setPlace((p) => ({ ...p, ...picks }));
    notify(n ? `Auto-routed ${n} order${n > 1 ? 's' : ''} — balanced by load` : 'Nothing to route');
  };
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
    notify(moved ? `Rebalanced ${moved} order${moved > 1 ? 's' : ''} across the team` : 'Load already balanced');
  };
  const toggleRule = (id: string) => setRuleState((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  const drop = (target: string | null) => { if (dragId && place[dragId] !== target) { const it = allItems.find((x) => x.id === dragId); moveTo(dragId, target); notify(target ? `Moved ${it?.code} → ${target}` : `${it?.code} returned to queue`); } setDragId(null); };

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
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground"><input type="checkbox" checked={visible.length > 0 && selVisible.length === visible.length} onChange={selAll} className="accent-primary" />Select all ({visible.length})</label>
                  {visible.map((q) => { const best = bestFor(q); return (
                    <div key={q.id} className={`rounded-xl border bg-background/40 p-3 ${sel.has(q.id) ? 'border-primary/50' : 'border-border'}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <input type="checkbox" checked={sel.has(q.id)} onChange={() => toggleSel(q.id)} className="accent-primary" />
                        <PriorityBadge priority={q.priority} />
                        <span className="font-semibold">{q.code}</span>
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
                        {best && <button onClick={() => doAssign(q.id, best, q.code)} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Assign</button>}
                        <button onClick={() => setExpanded((e) => (e === q.id ? null : q.id))} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-accent">Pick<i className={`ph-bold ph-caret-down ml-0.5 transition ${expanded === q.id ? 'rotate-180' : ''}`} /></button>
                      </div>
                      {expanded === q.id && (
                        <div className="mt-2 space-y-1 border-t border-border pt-2">
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
              {pending.map((q) => <OrderCard key={q.id} q={q} best={bestFor(q)} tierMeta={tierMeta} onDragStart={() => setDragId(q.id)} />)}
              {pending.length === 0 && <Empty>Queue clear</Empty>}
            </Column>
            {staff.map((s) => { const load = loadOf(s.name); const full = load >= s.capacity; const items = itemsAt(s.name);
              return (
                <Column key={s.id} title={s.name} sub={`${load}/${s.capacity}`} accent={full ? 'danger' : load / s.capacity > 0.8 ? 'warn' : 'ok'} onDrop={() => drop(s.name)} dragId={dragId} skills={s.skills}>
                  {items.map((it) => <OrderCard key={it.id} q={it} placed tierMeta={tierMeta} onDragStart={() => setDragId(it.id)} />)}
                  {items.length === 0 && <Empty>Drop orders here</Empty>}
                </Column>
              );
            })}
          </div>
        </div>
      )}

      {/* routing rules */}
      <Card icon="ph-git-fork" title="Routing rules" right={<button onClick={() => notify('New rule — pick service & target')} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent">New rule</button>}>
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
                  <td className="p-2 text-right">
                    <button onClick={() => toggleRule(r.id)} role="switch" aria-checked={r.active} className={`relative h-5 w-9 rounded-full transition ${r.active ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${r.active ? 'left-[18px]' : 'left-0.5'}`} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground"><b className="text-foreground">Pinned</b> forces one person; <b className="text-foreground">skill pool</b> auto-routes to the best-scoring available staff with the matching skill.</p>
      </Card>

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
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function OrderCard({ q, tierMeta, placed, best, onDragStart }: { q: CardItem; tierMeta: TierMeta; placed?: boolean; best?: string | null; onDragStart: () => void }) {
  return (
    <div draggable onDragStart={onDragStart} className="cursor-grab rounded-xl border border-border bg-background/50 p-2.5 active:cursor-grabbing">
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
