'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge } from '@/components/admin/StatBadge';
import { money, statusLabel, type OrderStatus, type Priority, type Tier, type AdminDeliverable } from '@/data/adminMock';

interface CustSummary { id: string; name: string; company: string; email: string; tier: Tier; spend: number; orders: number; balance: number }
interface QueueItem {
  id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; value: number;
  deadline: string | null; customer: string; tier: Tier; cust: CustSummary | null; staff: string | null;
  versions: AdminDeliverable[]; latest: AdminDeliverable; isResubmission: boolean; ageDays: number; criteria: string[];
  brief: { label: string; value: string }[]; customerNote: string | null; project: string; folder: string;
  source: 'quick' | 'dashboard'; created: string; memberSince: string | null;
}
interface SentBack { id: string; code: string; service: string; staff: string | null; reviewNote: string | null; ageDays: number }
interface StaffQ { name: string; reviewed: number; changeRate: number }
interface Stats { awaiting: number; resubmissions: number; overdue: number; firstPassPct: number; avgTurnaround: number }
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;
interface Props { queue: QueueItem[]; sentBack: SentBack[]; staffQuality: StaffQ[]; stats: Stats; tierMeta: TierMeta }

export function ReviewClient({ queue, sentBack, staffQuality, stats, tierMeta }: Props) {
  const [decided, setDecided] = useState<Record<string, 'approved' | 'changes_requested'>>({});
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const [history, setHistory] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);
  const [crModal, setCrModal] = useState<QueueItem | null>(null);
  const [crNote, setCrNote] = useState('');
  const [fService, setFService] = useState(''); const [reSubOnly, setReSubOnly] = useState(false); const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const record = (text: string, icon: string) => { setToast(text); setTimeout(() => setToast(null), 2400); setHistory((h) => [{ id: `${Date.now()}.${h.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text, icon }, ...h].slice(0, 40)); };

  const services = useMemo(() => [...new Set(queue.map((q) => q.service))], [queue]);
  const visible = useMemo(() => queue.filter((q) => !decided[q.id]
    && (!fService || q.service === fService) && (!reSubOnly || q.isResubmission)
    && (!search.trim() || `${q.code} ${q.customer} ${q.staff ?? ''}`.toLowerCase().includes(search.toLowerCase()))), [queue, decided, fService, reSubOnly, search]);
  const selected = visible.find((q) => q.id === selectedId) ?? visible[0] ?? null;

  const checksOf = (q: QueueItem) => checks[q.id] ?? q.criteria.map(() => false);
  const allChecked = (q: QueueItem) => checksOf(q).every(Boolean);
  const toggleCheck = (q: QueueItem, i: number) => setChecks((c) => { const cur = (c[q.id] ?? q.criteria.map(() => false)).slice(); cur[i] = !cur[i]; return { ...c, [q.id]: cur }; });

  const nextAfter = (id: string) => { const rest = visible.filter((q) => q.id !== id); return rest[0]?.id ?? null; };
  const approve = (q: QueueItem) => { if (!allChecked(q)) return; setSelectedId(nextAfter(q.id)); setDecided((d) => ({ ...d, [q.id]: 'approved' })); record(`Approved ${q.code} → ${q.staff}`, 'ph-check-circle'); };
  const submitChanges = () => { const q = crModal!; if (!crNote.trim()) return; setSelectedId(nextAfter(q.id)); setDecided((d) => ({ ...d, [q.id]: 'changes_requested' })); record(`Requested changes on ${q.code} → ${q.staff}`, 'ph-arrow-u-up-left'); setCrModal(null); setCrNote(''); };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Review</h1>
          <p className="text-sm text-muted-foreground">Approve deliverables against the acceptance checklist, or send them back.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-tray" label="Awaiting review" value={String(visible.length)} tone={visible.length ? 'warn' : 'good'} />
        <Kpi icon="ph-arrow-u-up-left" label="Re-submissions" value={String(visible.filter((q) => q.isResubmission).length)} />
        <Kpi icon="ph-timer" label="Overdue (SLA)" value={String(visible.filter((q) => q.ageDays >= 2).length)} tone={visible.some((q) => q.ageDays >= 2) ? 'warn' : undefined} />
        <Kpi icon="ph-seal-check" label="First-pass approval" value={`${stats.firstPassPct}%`} tone="good" />
        <Kpi icon="ph-clock" label="Avg turnaround" value={`${stats.avgTurnaround}d`} />
      </div>

      {/* master ↔ detail */}
      <div className="grid gap-4 lg:grid-cols-[21rem_1fr]">
        {/* queue */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={fService} onChange={(e) => setFService(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"><option value="">All services</option>{services.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <button onClick={() => setReSubOnly((v) => !v)} className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${reSubOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>Re-subs</button>
            <div className="relative flex-1"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:border-primary" /></div>
          </div>
          <div className="scrollbar-thin max-h-[40rem] space-y-1 overflow-y-auto pr-1">
            {visible.map((q) => (
              <button key={q.id} onClick={() => setSelectedId(q.id)} className={`w-full rounded-lg border p-2 text-left transition ${selected?.id === q.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${q.priority === 'high' ? 'bg-destructive' : q.priority === 'med' ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                  <span className="text-sm font-semibold">{q.code}</span>
                  {q.isResubmission && <span className="rounded bg-amber-500/10 px-1 text-[10px] font-semibold text-amber-600">v{q.latest.version}</span>}
                  <span className={`ml-auto text-[11px] ${q.ageDays >= 4 ? 'font-semibold text-destructive' : q.ageDays >= 2 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>{q.ageDays}d</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="truncate text-muted-foreground">{q.service} · {q.pkg}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-semibold text-foreground"><i className="ph-bold ph-user-circle text-primary" />{q.staff}</span>
                    <i className={`ph-fill ${tierMeta[q.tier].icon}`} style={{ color: tierMeta[q.tier].color }} title={q.customer} />
                  </span>
                </div>
              </button>
            ))}
            {visible.length === 0 && <p className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground"><i className="ph-bold ph-check-circle mb-1 block text-lg text-emerald-500" />Inbox zero — nothing to review.</p>}
          </div>
        </div>

        {/* review pane */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
          {!selected ? (
            <div className="grid h-full min-h-[20rem] place-items-center text-center text-sm text-muted-foreground"><div><i className="ph-bold ph-coffee mb-2 block text-3xl text-emerald-500" />All caught up. Nice work.</div></div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold">{selected.code}</span>
                <PriorityBadge priority={selected.priority} /><StatusBadge status={selected.status} />
                {selected.isResubmission && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">re-submission · v{selected.latest.version}</span>}
                <Link href={`/admin/orders/${selected.id}`} className="ml-auto text-xs font-semibold text-primary hover:underline">Open full order →</Link>
              </div>

              {/* customer card */}
              {selected.cust && (
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{selected.cust.name.split(' ').map((x) => x[0]).join('')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{selected.cust.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tierMeta[selected.cust.tier].color }}><i className={`ph-fill ${tierMeta[selected.cust.tier].icon}`} />{tierMeta[selected.cust.tier].label}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{selected.cust.company} · {selected.cust.email}{selected.memberSince ? ` · since ${selected.memberSince}` : ''}</p>
                    </div>
                    <Link href={`/admin/customers/${selected.cust.id}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">Profile →</Link>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <Mini label="Lifetime value" value={money(selected.cust.spend)} />
                    <Mini label="Total orders" value={String(selected.cust.orders)} />
                    <Mini label="Credit" value={money(selected.cust.balance)} />
                  </div>
                </div>
              )}

              {/* order scope */}
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <KV label="Service" value={`${selected.service} · ${selected.pkg}`} />
                <KV label="Order value" value={money(selected.value)} />
                <KV label="Deadline" value={selected.deadline ?? '—'} />
                <KV label="Submitted by" value={selected.staff ?? '—'} />
                <KVNode label="Filed under"><span className="inline-flex items-center gap-1 text-sm font-medium"><i className="ph-bold ph-folders text-muted-foreground" />{selected.project}<i className="ph-bold ph-caret-right text-muted-foreground" />{selected.folder}</span></KVNode>
                <KV label="Source" value={`via ${selected.source}`} />
              </div>

              {/* customer brief & note */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer brief</p>
                <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {selected.brief.map((f) => <KV key={f.label} label={f.label} value={f.value} />)}
                </div>
                {selected.customerNote
                  ? <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary"><i className="ph-bold ph-chat-circle-text" />Note from customer</p>{selected.customerNote}</div>
                  : <p className="mt-2 text-xs text-muted-foreground">No note from the customer.</p>}
              </div>

              {/* versions */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deliverable versions</p>
                <div className="space-y-2">
                  {selected.versions.map((v) => (
                    <div key={v.id} className="rounded-xl border border-border bg-background/40 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">v{v.version}</span>
                        {v.kind === 'file'
                          ? <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><i className="ph-bold ph-file-arrow-down" />{v.fileName}</a>
                          : <a href={v.url ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><i className="ph-bold ph-link" />Open link</a>}
                        <span className="ml-auto text-xs text-muted-foreground">{v.submittedAt}</span>
                        <StatusChip status={v.status} />
                      </div>
                      {v.note && <p className="mt-1.5 text-sm text-muted-foreground"><i className="ph-bold ph-chat-text mr-1" />{v.note}</p>}
                      {v.reviewNote && <p className="mt-1.5 rounded-lg bg-amber-500/5 px-2 py-1.5 text-xs text-amber-700"><i className="ph-bold ph-warning mr-1" />Sent back: {v.reviewNote}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* QA rubric */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acceptance checklist · {selected.service}</p>
                  <span className={`text-xs font-semibold ${allChecked(selected) ? 'text-emerald-600' : 'text-muted-foreground'}`}>{checksOf(selected).filter(Boolean).length}/{selected.criteria.length} checks</span>
                </div>
                <div className="space-y-1">
                  {selected.criteria.map((c, i) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <input type="checkbox" checked={checksOf(selected)[i] ?? false} onChange={() => toggleCheck(selected, i)} className="accent-primary" />
                      <span className={checksOf(selected)[i] ? 'text-muted-foreground line-through' : ''}>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* decision bar */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <button onClick={() => approve(selected)} disabled={!allChecked(selected)} title={allChecked(selected) ? 'Approve & complete' : 'Tick all acceptance criteria first'} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><i className="ph-bold ph-check-circle mr-1" />Approve</button>
                <button onClick={() => { setCrModal(selected); setCrNote(''); }} className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10"><i className="ph-bold ph-arrow-u-up-left mr-1" />Request changes</button>
                {!allChecked(selected) && <span className="text-xs text-muted-foreground">Tick all {selected.criteria.length} criteria to enable approval.</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom: history + quality + sent back */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon="ph-clock-counter-clockwise" title="Review history" right={<span className="text-xs text-muted-foreground">{history.length}</span>}>
          {history.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">No reviews yet this session.</p> : (
            <ul className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto pr-1">{history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} /></span><span className="min-w-0 flex-1 truncate">{h.text}</span><span className="shrink-0 text-xs text-muted-foreground">{h.at}</span></li>
            ))}</ul>
          )}
        </Card>
        <Card icon="ph-gauge" title="Staff quality" right={<span className="text-xs text-muted-foreground">change-request rate</span>}>
          <div className="space-y-2.5">
            {staffQuality.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{s.name}</span><span className={`text-xs font-semibold ${s.changeRate >= 50 ? 'text-destructive' : s.changeRate > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.changeRate}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${s.changeRate}%`, background: s.changeRate >= 50 ? 'hsl(var(--destructive))' : '#f59e0b' }} /></div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.reviewed} reviewed</p>
              </div>
            ))}
          </div>
        </Card>
        <Card icon="ph-arrow-u-up-left" title="Sent back" right={<span className="text-xs text-muted-foreground">awaiting re-submit</span>}>
          {sentBack.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">None.</p> : (
            <ul className="space-y-2">{sentBack.map((s) => (
              <li key={s.id} className="text-sm"><Link href={`/admin/orders/${s.id}`} className="font-medium hover:underline">{s.code}</Link> <span className="text-muted-foreground">· {s.staff} · {s.ageDays}d</span>{s.reviewNote && <p className="text-[11px] text-muted-foreground">{s.reviewNote}</p>}</li>
            ))}</ul>
          )}
        </Card>
      </div>

      {crModal && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <div className="order-backdrop absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setCrModal(null)} />
          <div className="modal-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <p className="display mb-1 text-base font-bold">Request changes — {crModal.code}</p>
            <p className="mb-3 text-xs text-muted-foreground">{crModal.staff} will resubmit a new version. The note is required and counts toward their quality score.</p>
            <textarea value={crNote} onChange={(e) => setCrNote(e.target.value)} rows={4} placeholder="What needs to change? Be specific and actionable…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setCrModal(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent">Cancel</button>
              <button onClick={submitChanges} disabled={!crNote.trim()} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40">Send back</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast-in fixed bottom-4 right-4 z-[80] rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-xl">{toast}</div>}
    </section>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'good' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-primary';
  return <div className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><i className={`ph-bold ${icon} ${col}`} /></div><p className="display mt-1 text-xl font-bold tracking-tight">{value}</p></div>;
}
function Card({ icon, title, right, children }: { icon: string; title: string; right?: ReactNode; children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold"><i className={`ph-bold ${icon} text-primary`} /> {title}</p>{right}</div>{children}</div>;
}
function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className="text-sm font-medium">{value}</span></div>;
}
function KVNode({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2 text-center"><p className="display text-sm font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>;
}
function StatusChip({ status }: { status: AdminDeliverable['status'] }) {
  const map = { submitted: { c: 'bg-sky-500/10 text-sky-600', t: 'submitted' }, approved: { c: 'bg-emerald-500/10 text-emerald-600', t: 'approved' }, changes_requested: { c: 'bg-amber-500/10 text-amber-600', t: 'changes requested' } }[status];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${map.c}`}>{map.t}</span>;
}
