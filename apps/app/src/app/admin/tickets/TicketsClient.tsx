'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PriorityBadge, StatusBadge } from '@/components/admin/StatBadge';
import { SlideOver } from '@/components/admin/SlideOver';
import {
  TICKET_CHANNEL, TICKET_TYPE, TICKET_MACROS, money,
  type TicketMessage, type TicketStatus, type TicketChannel, type TicketType, type Priority, type Tier, type OrderStatus,
} from '@/data/adminMock';

interface CustSummary {
  id: string; name: string; company: string; email: string; tier: Tier;
  spend: number; orders: number; balance: number; memberSince: string | null;
}
interface CustFull {
  id: string; name: string; company: string; email: string; status: 'shadow' | 'claimed'; tier: Tier;
  phone: string; timezone: string; memberSince: string; tags: string[];
  spend: number; orders: number; balance: number; aov: number; activeOrders: number;
  lastActive: string; churnDays: number;
  recentOrders: { id: string; code: string; service: string; pkg: string; status: OrderStatus; value: number; created: string }[];
  ledger: { at: string; delta: number; reason: string }[];
}
interface OrderSummary { id: string; code: string; service: string; pkg: string; value: number }
interface TicketRow {
  id: string; code: string; subject: string; customer: string; customerId: string | null;
  type: TicketType; channel: TicketChannel; status: TicketStatus; priority: Priority;
  assignee: string | null; slaTier: 'urgent' | 'standard'; age: string;
  thread: TicketMessage[]; cust: CustSummary | null; custFull: CustFull | null; order: OrderSummary | null;
  waitingOnUs: boolean; breached: boolean; slaLeftLabel: string;
}
interface Stats { open: number; pending: number; resolvedToday: number; avgFirstResponseH: number; breaches: number; unassigned: number }
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;
interface Props { rows: TicketRow[]; stats: Stats; tierMeta: TierMeta; agent: string }

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'pill-warn' },
  pending: { label: 'Pending', cls: 'pill' },
  resolved: { label: 'Resolved', cls: 'pill-live' },
  closed: { label: 'Closed', cls: 'pill' },
};
const initials = (name: string) => name.split(' ').map((x) => x[0]).join('').slice(0, 2);

export function TicketsClient({ rows, stats, tierMeta, agent }: Props) {
  const [statusOf, setStatusOf] = useState<Record<string, TicketStatus>>({});
  const [assignOf, setAssignOf] = useState<Record<string, string | null>>({});
  const [extra, setExtra] = useState<Record<string, TicketMessage[]>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [reply, setReply] = useState('');
  const [macroOpen, setMacroOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fStatus, setFStatus] = useState<'all' | 'live' | TicketStatus>('all');
  const [fChannel, setFChannel] = useState<'all' | TicketChannel>('all');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const stOf = (t: TicketRow) => statusOf[t.id] ?? t.status;
  const asgOf = (t: TicketRow) => (t.id in assignOf ? assignOf[t.id] : t.assignee);
  const threadOf = (t: TicketRow) => [...t.thread, ...(extra[t.id] ?? [])];
  const isLive = (t: TicketRow) => { const s = stOf(t); return s === 'open' || s === 'pending'; };
  const awaitingUs = (t: TicketRow) => t.waitingOnUs && !answered[t.id] && isLive(t);
  const isBreaching = (t: TicketRow) => t.breached && !answered[t.id] && isLive(t);

  const record = (text: string, icon: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2400);
    setHistory((h) => [{ id: `${Date.now()}.${h.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text, icon }, ...h].slice(0, 40));
  };

  const visible = useMemo(() => rows.filter((t) => {
    const s = stOf(t);
    if (fStatus === 'live' && !(s === 'open' || s === 'pending')) return false;
    if (fStatus !== 'all' && fStatus !== 'live' && s !== fStatus) return false;
    if (fChannel !== 'all' && t.channel !== fChannel) return false;
    if (unassignedOnly && asgOf(t)) return false;
    if (search.trim() && !`${t.code} ${t.subject} ${t.customer} ${asgOf(t) ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, statusOf, assignOf, fStatus, fChannel, unassignedOnly, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = visible.find((t) => t.id === selectedId) ?? visible[0] ?? null;

  const kpis = useMemo(() => ({
    open: rows.filter((t) => stOf(t) === 'open').length,
    awaiting: rows.filter(awaitingUs).length,
    breaches: rows.filter(isBreaching).length,
    resolved: rows.filter((t) => stOf(t) === 'resolved').length + stats.resolvedToday - rows.filter((t) => t.status === 'resolved' && stOf(t) !== 'resolved').length,
  }), [rows, statusOf, answered]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignToMe = (t: TicketRow) => { setAssignOf((a) => ({ ...a, [t.id]: agent })); record(`Assigned ${t.code} → ${agent}`, 'ph-user-plus'); };
  const reassign = (t: TicketRow, who: string) => { setAssignOf((a) => ({ ...a, [t.id]: who || null })); if (who) record(`Reassigned ${t.code} → ${who}`, 'ph-arrows-left-right'); };
  const setStatus = (t: TicketRow, s: TicketStatus, icon: string) => { setStatusOf((m) => ({ ...m, [t.id]: s })); record(`${STATUS_META[s].label} — ${t.code}`, icon); };
  const sendReply = (t: TicketRow) => {
    if (!reply.trim()) return;
    const msg: TicketMessage = { from: 'staff', author: asgOf(t) ?? agent, text: reply.trim(), at: 'Just now' };
    setExtra((e) => ({ ...e, [t.id]: [...(e[t.id] ?? []), msg] }));
    setAnswered((a) => ({ ...a, [t.id]: true }));
    if (stOf(t) === 'open') setStatusOf((m) => ({ ...m, [t.id]: 'pending' }));
    setReply(''); setMacroOpen(false);
    record(`Replied to ${t.code}`, 'ph-paper-plane-tilt');
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">Reply, assign, and resolve support tickets against their SLA.</p>
        </div>
        {kpis.breaches > 0 && <span className="pill pill-warn"><i className="ph-bold ph-warning" /> {kpis.breaches} breaching SLA</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-tray" label="Open" value={String(kpis.open)} tone={kpis.open ? 'warn' : 'good'} />
        <Kpi icon="ph-chat-dots" label="Awaiting reply" value={String(kpis.awaiting)} tone={kpis.awaiting ? 'warn' : 'good'} />
        <Kpi icon="ph-timer" label="Breaching SLA" value={String(kpis.breaches)} tone={kpis.breaches ? 'warn' : 'good'} />
        <Kpi icon="ph-check-circle" label="Resolved today" value={String(kpis.resolved)} tone="good" />
        <Kpi icon="ph-clock" label="Avg first response" value={`${stats.avgFirstResponseH}h`} />
      </div>

      {/* master ↔ detail */}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* inbox queue */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-3 lg:flex lg:h-[44rem] lg:flex-col">
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary">
              <option value="all">All</option><option value="live">Live (open+pending)</option>
              <option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
            </select>
            <select value={fChannel} onChange={(e) => setFChannel(e.target.value as typeof fChannel)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary">
              <option value="all">All channels</option>
              {Object.entries(TICKET_CHANNEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => setUnassignedOnly((v) => !v)} className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${unassignedOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>Unassigned</button>
            <div className="relative flex-1 min-w-[8rem]"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:border-primary" /></div>
          </div>
          <div className="scrollbar-thin max-h-[42rem] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
            {visible.map((t) => {
              const ch = TICKET_CHANNEL[t.channel]; const ty = TICKET_TYPE[t.type]; const breach = isBreaching(t);
              return (
                <button key={t.id} onClick={() => { setSelectedId(t.id); setReply(''); setMacroOpen(false); }} className={`w-full rounded-lg border p-2 text-left transition ${selected?.id === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === 'high' ? 'bg-destructive' : t.priority === 'med' ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                    <span className="text-sm font-semibold">#{t.code}</span>
                    <i className={`ph-fill ${ch.icon} text-xs`} style={{ color: ch.color }} title={ch.label} />
                    {awaitingUs(t) && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Awaiting your reply" />}
                    <span className={`ml-auto text-[11px] ${breach ? 'font-semibold text-destructive' : awaitingUs(t) ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>{awaitingUs(t) ? t.slaLeftLabel : STATUS_META[stOf(t)].label}</span>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium">{t.subject}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5" style={{ color: ty.color }}><i className={`ph-bold ${ty.icon}`} />{ty.label}</span>
                    <span className="truncate">· {t.customer}</span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-0.5">{asgOf(t) ? <><i className="ph-bold ph-user-circle text-primary" />{asgOf(t)}</> : <span className="text-amber-600">Unassigned</span>}</span>
                  </div>
                </button>
              );
            })}
            {visible.length === 0 && <p className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground"><i className="ph-bold ph-check-circle mb-1 block text-lg text-emerald-500" />No tickets match these filters.</p>}
          </div>
        </div>

        {/* conversation pane */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 lg:h-[44rem]">
          {!selected ? (
            <div className="grid h-full min-h-[20rem] place-items-center text-center text-sm text-muted-foreground"><div><i className="ph-bold ph-coffee mb-2 block text-3xl text-emerald-500" />Inbox zero. Nice work.</div></div>
          ) : (
            <div className="grid gap-5 lg:h-full lg:grid-cols-[1fr_17rem] lg:overflow-hidden">
              {/* left: header + thread + reply */}
              <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
                <div className="shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="display text-lg font-bold">#{selected.code}</span>
                    <span className={`pill ${STATUS_META[stOf(selected)].cls}`}>{STATUS_META[stOf(selected)].label}</span>
                    <PriorityBadge priority={selected.priority} />
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: TICKET_TYPE[selected.type].color }}><i className={`ph-bold ${TICKET_TYPE[selected.type].icon}`} />{TICKET_TYPE[selected.type].label}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><i className={`ph-bold ${TICKET_CHANNEL[selected.channel].icon}`} />{TICKET_CHANNEL[selected.channel].label}</span>
                  </div>
                  <p className="mt-1 text-[15px] font-semibold">{selected.subject}</p>
                </div>

                {/* action bar */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-background/40 p-2">
                  {asgOf(selected) === agent ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"><i className="ph-bold ph-user-check" />Assigned to you</span>
                  ) : (
                    <button onClick={() => assignToMe(selected)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"><i className="ph-bold ph-user-plus mr-1" />Assign to me</button>
                  )}
                  <select value={asgOf(selected) ?? ''} onChange={(e) => reassign(selected, e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
                    <option value="">Unassigned</option>
                    {[agent, 'Linh P.', 'Huy N.', 'Aria K.', 'Diego R.', 'Tom B.'].filter((v, i, a) => a.indexOf(v) === i).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setStatus(selected, 'resolved', 'ph-check-circle')} disabled={stOf(selected) === 'resolved' || stOf(selected) === 'closed'} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-40"><i className="ph-bold ph-check-circle mr-1" />Resolve</button>
                    <button onClick={() => setStatus(selected, 'closed', 'ph-x-circle')} disabled={stOf(selected) === 'closed'} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:opacity-40">Close</button>
                  </div>
                </div>

                {/* thread */}
                <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto pr-1 lg:min-h-0">
                  {threadOf(selected).map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.from === 'staff' ? 'items-end' : 'items-start'}`}>
                      <span className="px-1 text-[10px] font-medium text-muted-foreground">{m.author} · {m.at}</span>
                      <div className={`mt-0.5 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.from === 'staff' ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted text-foreground'}`}>{m.text}</div>
                    </div>
                  ))}
                </div>

                {/* reply / closed notice */}
                {isLive(selected) ? (
                  <div className="shrink-0 border-t border-border pt-3">
                    <div className="relative mb-2">
                      <button onClick={() => setMacroOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-accent"><i className="ph-bold ph-lightning" />Canned reply<i className="ph-bold ph-caret-down" /></button>
                      {macroOpen && (
                        <div className="absolute z-20 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                          {TICKET_MACROS.map((mc) => (
                            <button key={mc.label} onClick={() => { setReply(mc.text); setMacroOpen(false); }} className="block w-full border-b border-border px-3 py-2 text-left last:border-0 hover:bg-accent">
                              <span className="block text-xs font-semibold">{mc.label}</span><span className="block truncate text-[11px] text-muted-foreground">{mc.text}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={`Reply to ${selected.cust?.name ?? selected.customer}…`} className="scrollbar-thin max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      <button onClick={() => sendReply(selected)} disabled={!reply.trim()} aria-label="Send reply" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"><i className="ph-bold ph-paper-plane-tilt" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center justify-between rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                    <span><i className={`ph-bold ${stOf(selected) === 'resolved' ? 'ph-check-circle text-emerald-500' : 'ph-lock-simple'} mr-1`} />This ticket is {STATUS_META[stOf(selected)].label.toLowerCase()}.</span>
                    <button onClick={() => setStatus(selected, 'open', 'ph-arrow-counter-clockwise')} className="font-semibold text-primary hover:underline">Reopen</button>
                  </div>
                )}
              </div>

              {/* right rail: customer + order + SLA */}
              <div className="scrollbar-thin space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                {selected.cust ? (
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    disabled={!selected.custFull}
                    className="group w-full rounded-xl border border-border bg-background/40 p-3 text-left transition hover:border-primary/50 hover:bg-accent disabled:cursor-default"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{initials(selected.cust.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{selected.cust.name}</span>
                          <i className={`ph-fill ${tierMeta[selected.cust.tier].icon} shrink-0`} style={{ color: tierMeta[selected.cust.tier].color }} title={tierMeta[selected.cust.tier].label} />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{selected.cust.email}</p>
                      </div>
                      <i className="ph-bold ph-caret-right shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      <Mini label="LTV" value={money(selected.cust.spend)} />
                      <Mini label="Orders" value={String(selected.cust.orders)} />
                      <Mini label="Credit" value={money(selected.cust.balance)} />
                    </div>
                    <span className="mt-2 block text-center text-xs font-semibold text-primary group-hover:underline">View full info →</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground"><i className="ph-bold ph-user-circle-dashed mb-1 block text-lg" />Guest / unlinked sender</div>
                )}

                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Linked order</p>
                  {selected.order ? (
                    <Link href={`/admin/orders/${selected.order.id}`} className="block rounded-lg border border-border p-2 transition hover:border-primary/50 hover:bg-accent">
                      <div className="flex items-center justify-between text-sm font-semibold">{selected.order.code}<i className="ph-bold ph-arrow-up-right text-muted-foreground" /></div>
                      <p className="text-[11px] text-muted-foreground">{selected.order.service} · {selected.order.pkg} · {money(selected.order.value)}</p>
                    </Link>
                  ) : <p className="text-xs text-muted-foreground">No order linked to this ticket.</p>}
                </div>

                <div className={`rounded-xl border p-3 ${isBreaching(selected) ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-background/40'}`}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SLA</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{selected.slaTier}</span>
                    {answered[selected.id] || !isLive(selected) ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><i className="ph-bold ph-check" />Answered</span>
                    ) : awaitingUs(selected) ? (
                      <span className={`text-xs font-semibold ${isBreaching(selected) ? 'text-destructive' : 'text-amber-600'}`}>{selected.slaLeftLabel}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Waiting on customer</span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Target: reply within {selected.slaTier === 'urgent' ? '2h' : '24h'}.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* activity log */}
      <Card icon="ph-clock-counter-clockwise" title="Activity log" right={<span className="text-xs text-muted-foreground">{history.length}</span>}>
        {history.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">No actions yet this session.</p> : (
          <ul className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto pr-1">{history.map((h) => (
            <li key={h.id} className="flex items-center gap-3 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} /></span><span className="min-w-0 flex-1 truncate">{h.text}</span><span className="shrink-0 text-xs text-muted-foreground">{h.at}</span></li>
          ))}</ul>
        )}
      </Card>

      <SlideOver open={profileOpen && !!selected?.custFull} onClose={() => setProfileOpen(false)} title="Customer">
        {selected?.custFull && <CustomerPanel c={selected.custFull} tierMeta={tierMeta} />}
      </SlideOver>

      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

function CustomerPanel({ c, tierMeta }: { c: CustFull; tierMeta: TierMeta }) {
  const tier = tierMeta[c.tier];
  return (
    <div className="space-y-5">
      {/* identity */}
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-base font-bold text-primary">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{c.name}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tier.color }}><i className={`ph-fill ${tier.icon}`} />{tier.label}</span>
            <span className={`pill ${c.status === 'claimed' ? 'pill-live' : 'pill'}`}>{c.status}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.company}</p>
          <a href={`mailto:${c.email}`} className="truncate text-xs text-primary hover:underline">{c.email}</a>
        </div>
      </div>

      {/* contact */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <KV label="Phone" value={c.phone} />
        <KV label="Timezone" value={c.timezone} />
        <KV label="Member since" value={c.memberSince} />
        <KV label="Last active" value={`${c.churnDays}d ago`} />
      </div>
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {c.tags.map((t) => <span key={t} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t}</span>)}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Lifetime value" value={money(c.spend)} />
        <Mini label="Total orders" value={String(c.orders)} />
        <Mini label="Credit" value={money(c.balance)} />
        <Mini label="Avg order" value={money(c.aov)} />
        <Mini label="Active now" value={String(c.activeOrders)} />
        <Mini label="Tier" value={tier.label} />
      </div>

      {/* recent orders */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent orders</p>
        {c.recentOrders.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p> : (
          <div className="space-y-1.5">
            {c.recentOrders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-2 rounded-lg border border-border p-2 transition hover:border-primary/50 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{o.code}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{o.service} · {o.pkg} · {money(o.value)}</p>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* credit ledger */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credit ledger</p>
        <ul className="space-y-1.5">
          {c.ledger.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.reason}</span>
              <span className={`shrink-0 font-semibold ${l.delta >= 0 ? 'text-emerald-600' : 'text-foreground'}`}>{l.delta >= 0 ? '+' : ''}{money(l.delta)}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{l.at}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link href={`/admin/customers/${c.id}`} className="block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Open full profile page →</Link>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-sm font-medium">{value}</span></div>;
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div><p className="display mt-1 text-xl font-bold tracking-tight">{value}</p></div>;
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-1.5 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
