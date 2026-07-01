'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { reviewDeliverableAction } from '@/app/admin/review/review.actions';
import { advanceOrderAction } from '@/app/admin/orders/actions';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { StaffHoverCard } from '@/components/admin/StaffHoverCard';
import { SnippetPicker } from '@/components/staff/SnippetPicker';
import { type OrderStatus, type Priority, type Tier, type AdminDeliverable } from '@/data/adminMock';
import { useMoney, useShowMoney } from '@/lib/viewer';

interface CustSummary { id: string; name: string; company: string; email: string; tier: Tier; spend: number; orders: number; balance: number }
interface CheckItem { group: string; text: string }
interface QueueItem {
  id: string; code: string; service: string; pkg: string; priority: Priority; status: OrderStatus; value: number;
  deadline: string | null; customer: string; tier: Tier; cust: CustSummary | null; staff: string | null;
  versions: AdminDeliverable[]; latest: AdminDeliverable; isResubmission: boolean; ageDays: number; overdue: boolean;
  included: string[]; checklist: CheckItem[]; priorNote: string | null;
  brief: { label: string; value: string }[]; customerNote: string | null; project: string; folder: string;
  source: 'quick' | 'dashboard'; created: string; memberSince: string | null;
}
interface SentBack { id: string; code: string; service: string; staff: string | null; reviewNote: string | null; ageDays: number }
interface StaffQ { name: string; reviewed: number; changeRate: number }
interface Stats { slaDays: number; awaiting: number; resubmissions: number; overdue: number; firstPassPct: number; avgTurnaround: number }
type TierMeta = Record<Tier, { label: string; icon: string; color: string }>;
interface Props { queue: QueueItem[]; sentBack: SentBack[]; staffQuality: StaffQ[]; stats: Stats; tierMeta: TierMeta }

const PRI_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

// Saved replies for the reviewer notes — kept separate per audience so an internal QA
// note never gets dropped into the customer-facing field by accident. Seeds for the
// SnippetPicker (same "tap to insert / save current text" UX as the staff resubmit composer).
const REVIEW_STAFF_SNIPPETS: string[] = [
  'Looks great — clean first pass. Nice work on this one.',
  'Add 2–3 internal links to relevant money/cluster pages before resubmitting.',
  'Please add a meta title (≤ 60 chars) and meta description (≤ 155 chars).',
  'Good draft — tighten the intro and cut the repetition in the middle section.',
  'Heads up: this is close to its deadline — please prioritise the resubmit.',
];
const REVIEW_CUSTOMER_SNIPPETS: string[] = [
  "Your deliverable is ready and attached — let us know if you'd like any tweaks.",
  'Quick update: your order is on track and will be delivered on schedule.',
  "We're giving this a final quality check and will deliver it shortly.",
  'Could you review and approve so we can proceed to the next step?',
  'We need a little more time to get the quality right — thanks for your patience.',
];
// Append a saved reply onto whatever is already in the field (on its own line).
const insertSnippet = (cur: string, s: string) => (cur.trim() ? `${cur.trim()}\n${s}` : s);
// Grow a textarea to fit its content as the reviewer types (min height held by CSS).
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ReviewClient({ queue, sentBack, staffQuality, stats, tierMeta }: Props) {
  const router = useRouter();
  const money = useMoney();
  const showMoney = useShowMoney();
  const [decided, setDecided] = useState<Record<string, 'approved' | 'changes_requested'>>({});
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const [history, setHistory] = useState<{ id: string; at: string; text: string; icon: string }[]>([]);
  const [crModal, setCrModal] = useState<QueueItem | null>(null);
  const [crNote, setCrNote] = useState('');
  // Reviewer notes the QA can leave on the selected task — one to the staffer, one to the
  // customer. Cleared when the selection changes so a note never carries to the wrong order.
  const [noteStaff, setNoteStaff] = useState('');
  const [noteCustomer, setNoteCustomer] = useState('');
  const [staffSnips, setStaffSnips] = useState(REVIEW_STAFF_SNIPPETS);
  const [customerSnips, setCustomerSnips] = useState(REVIEW_CUSTOMER_SNIPPETS);
  const noteStaffRef = useRef<HTMLTextAreaElement>(null);
  const noteCustomerRef = useRef<HTMLTextAreaElement>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [fService, setFService] = useState(''); const [fStaff, setFStaff] = useState('');
  const [reSubOnly, setReSubOnly] = useState(false); const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'priority' | 'oldest' | 'value'>('priority');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const record = (text: string, icon: string) => { setToast(text); setTimeout(() => setToast(null), 2400); setHistory((h) => [{ id: `${Date.now()}.${h.length}`, at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), text, icon }, ...h].slice(0, 40)); };

  const services = useMemo(() => [...new Set(queue.map((q) => q.service))], [queue]);
  const staffList = useMemo(() => [...new Set(queue.map((q) => q.staff).filter(Boolean) as string[])], [queue]);
  const visible = useMemo(() => queue.filter((q) => !decided[q.id]
    && (!fService || q.service === fService) && (!fStaff || q.staff === fStaff)
    && (!reSubOnly || q.isResubmission) && (!overdueOnly || q.overdue)
    && (!search.trim() || `${q.code} ${q.customer} ${q.staff ?? ''}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => sortBy === 'oldest' ? b.ageDays - a.ageDays : sortBy === 'value' ? b.value - a.value : (PRI_RANK[a.priority] - PRI_RANK[b.priority]) || b.ageDays - a.ageDays),
    [queue, decided, fService, fStaff, reSubOnly, overdueOnly, search, sortBy]);
  const selected = visible.find((q) => q.id === selectedId) ?? visible[0] ?? null;

  const checksOf = (q: QueueItem) => checks[q.id] ?? q.checklist.map(() => false);
  const allChecked = (q: QueueItem) => checksOf(q).every(Boolean);
  const toggleCheck = (q: QueueItem, i: number) => setChecks((c) => { const cur = (c[q.id] ?? q.checklist.map(() => false)).slice(); cur[i] = !cur[i]; return { ...c, [q.id]: cur }; });

  const nextAfter = (id: string) => visible.filter((q) => q.id !== id)[0]?.id ?? null;
  // inc-E28 — persist the verdict for real (deliverable review + order move) when the queue is real data
  // (q.latest.id is a real deliverable uuid). The optimistic setDecided keeps the board snappy.
  const persistReview = (q: QueueItem, action: 'approve' | 'request_changes', note?: string) => {
    if (!UUID_RE.test(q.latest.id)) return;
    void reviewDeliverableAction(q.latest.id, action, note).then((r) => {
      if (!r.ok) { record(r.error, 'ph-warning-circle'); return; }
      void advanceOrderAction(q.id, action === 'approve' ? 'approved' : 'changes_requested').then((a) => {
        if (!a.ok) record(a.error, 'ph-warning-circle');
        router.refresh();
      });
    });
  };
  const approve = (q: QueueItem) => { if (!allChecked(q)) return; setSelectedId(nextAfter(q.id)); setDecided((d) => ({ ...d, [q.id]: 'approved' })); record(`Approved ${q.code} → ${q.staff}`, 'ph-check-circle'); persistReview(q, 'approve'); };
  const submitChanges = () => { const q = crModal!; if (!crNote.trim()) return; setSelectedId(nextAfter(q.id)); setDecided((d) => ({ ...d, [q.id]: 'changes_requested' })); record(`Requested changes on ${q.code} → ${q.staff}`, 'ph-arrow-u-up-left'); persistReview(q, 'request_changes', crNote); setCrModal(null); setCrNote(''); };
  // Leave a note for the staffer and/or the customer on the selected task (Phase-0: records it).
  const sendNotes = (q: QueueItem) => {
    const to: string[] = [];
    if (noteStaff.trim()) to.push(`${q.staff ?? 'staff'}`);
    if (noteCustomer.trim()) to.push(`${q.customer}`);
    if (!to.length) return;
    record(`Noted ${q.code} → ${to.join(' & ')}`, 'ph-chat-circle-text');
    setNoteStaff(''); setNoteCustomer('');
  };
  const move = (delta: number) => { if (!visible.length) return; const idx = Math.max(0, visible.findIndex((q) => q.id === selected?.id)); setSelectedId(visible[Math.min(visible.length - 1, Math.max(0, idx + delta))].id); };

  // Reset the note drafts whenever a different task is selected.
  useEffect(() => { setNoteStaff(''); setNoteCustomer(''); }, [selected?.id]);
  // Auto-grow the note fields as the reviewer types (or inserts a saved reply).
  useEffect(() => { autoGrow(noteStaffRef.current); }, [noteStaff]);
  useEffect(() => { autoGrow(noteCustomerRef.current); }, [noteCustomer]);

  // keyboard: j/k move · a approve · r request-changes · 1-9 toggle criterion · / search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (crModal) { if (e.key === 'Escape') setCrModal(null); return; }
      if (typing || !selected) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'a') { if (allChecked(selected)) approve(selected); }
      else if (e.key === 'r') { setCrModal(selected); setCrNote(''); }
      else if (/^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (i < selected.checklist.length) toggleCheck(selected, i); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, crModal, visible, checks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold tracking-tight">Review</h1>
          <p className="text-sm text-muted-foreground">Approve deliverables against the acceptance checklist, or send them back.</p>
        </div>
        <p className="hidden text-[11px] text-muted-foreground sm:block">Keys: <Kbd>j</Kbd>/<Kbd>k</Kbd> move · <Kbd>a</Kbd> approve · <Kbd>r</Kbd> changes · <Kbd>1-9</Kbd> tick · <Kbd>/</Kbd> search</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon="ph-tray" label="Awaiting review" value={String(visible.length)} tone={visible.length ? 'warn' : 'good'} />
        <Kpi icon="ph-arrow-u-up-left" label="Re-submissions" value={String(visible.filter((q) => q.isResubmission).length)} />
        <Kpi icon="ph-timer" label={`Overdue (>${stats.slaDays}d SLA)`} value={String(visible.filter((q) => q.overdue).length)} tone={visible.some((q) => q.overdue) ? 'warn' : undefined} />
        <Kpi icon="ph-seal-check" label="First-pass approval" value={`${stats.firstPassPct}%`} tone="good" />
        <Kpi icon="ph-clock" label="Avg turnaround" value={`${stats.avgTurnaround}d`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[21rem_1fr]">
        {/* queue */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
            <select value={fService} onChange={(e) => setFService(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 outline-none focus:border-primary"><option value="">All services</option>{services.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={fStaff} onChange={(e) => setFStaff(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 outline-none focus:border-primary"><option value="">All staff</option>{staffList.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'priority' | 'oldest' | 'value')} className="rounded-lg border border-border bg-background px-2 py-1 outline-none focus:border-primary"><option value="priority">Priority</option><option value="oldest">Oldest</option><option value="value">Value</option></select>
          </div>
          <div className="mb-2 flex items-center gap-1.5">
            <button onClick={() => setReSubOnly((v) => !v)} className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${reSubOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>Re-subs</button>
            <button onClick={() => setOverdueOnly((v) => !v)} className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${overdueOnly ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-border text-muted-foreground hover:bg-accent'}`}>Overdue</button>
            <div className="relative flex-1"><i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden /><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search  /" className="w-full rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:border-primary" /></div>
          </div>
          <div className="mb-1 flex items-center justify-between px-0.5 text-[11px] text-muted-foreground"><span>{visible.length} to review</span><span>SLA {stats.slaDays}d</span></div>
          <div className="scrollbar-thin max-h-[38rem] space-y-1 overflow-y-auto pr-1">
            {visible.map((q) => (
              <button key={q.id} onClick={() => setSelectedId(q.id)} className={`w-full rounded-lg border p-2 text-left transition ${selected?.id === q.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${q.priority === 'high' ? 'bg-destructive' : q.priority === 'med' ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                  <span className="text-sm font-semibold">{q.code}</span>
                  {q.isResubmission && <span className="rounded bg-amber-500/10 px-1 text-[10px] font-semibold text-amber-600">v{q.latest.version}</span>}
                  <span className={`ml-auto text-[11px] ${q.ageDays >= 4 ? 'font-semibold text-destructive' : q.overdue ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>{q.ageDays}d</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="truncate text-muted-foreground">{q.service} · {q.pkg}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <StaffHoverCard staff={q.staff ?? ''}><span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-semibold text-foreground"><i className="ph-bold ph-user-circle text-primary" aria-hidden />{q.staff}</span></StaffHoverCard>
                    <i className={`ph-fill ${tierMeta[q.tier].icon}`} style={{ color: tierMeta[q.tier].color }} title={q.customer} aria-hidden />
                  </span>
                </div>
              </button>
            ))}
            {visible.length === 0 && <p className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground"><i className="ph-bold ph-check-circle mb-1 block text-lg text-emerald-500" aria-hidden />Inbox zero — nothing to review.</p>}
          </div>
        </div>

        {/* review pane */}
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
          {!selected ? (
            <div className="grid h-full min-h-[20rem] place-items-center text-center text-sm text-muted-foreground"><div><i className="ph-bold ph-coffee mb-2 block text-3xl text-emerald-500" aria-hidden />All caught up. Nice work.</div></div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold">{selected.code}</span>
                <PriorityBadge priority={selected.priority} /><StatusBadge status={selected.status} />
                {selected.isResubmission && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">re-submission · v{selected.latest.version}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <Link href={`/admin/orders/${selected.id}`} className="text-xs font-semibold text-primary hover:underline">Open full order →</Link>
                  <a href={`/admin/orders/${selected.id}`} target="_blank" rel="noopener noreferrer" title="Open order in a new tab" aria-label="Open order in a new tab" className="text-muted-foreground hover:text-primary"><i className="ph-bold ph-arrow-square-out" aria-hidden /></a>
                </div>
              </div>

              {selected.isResubmission && selected.priorNote && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700"><i className="ph-bold ph-arrow-u-up-left" aria-hidden />Previously sent back — verify it's addressed</p>
                  “{selected.priorNote}”
                </div>
              )}

              {/* customer card */}
              {selected.cust && (
                <div className="rounded-xl border border-border bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{selected.cust.name.split(' ').map((x) => x[0]).join('')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{selected.cust.name}</span><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tierMeta[selected.cust.tier].color }}><i className={`ph-fill ${tierMeta[selected.cust.tier].icon}`} />{tierMeta[selected.cust.tier].label}</span></div>
                      <p className="truncate text-xs text-muted-foreground">{selected.cust.company} · {selected.cust.email}{selected.memberSince ? ` · since ${selected.memberSince}` : ''}</p>
                    </div>
                    <Link href={`/admin/customers/${selected.cust.id}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">Profile →</Link>
                  </div>
                  <div className={`mt-2.5 grid gap-2 ${showMoney ? 'grid-cols-3' : 'grid-cols-1'}`}>{showMoney && <Mini label="Lifetime value" value={money(selected.cust.spend)} />}<Mini label="Total orders" value={String(selected.cust.orders)} />{showMoney && <Mini label="Credit" value={money(selected.cust.balance)} />}</div>
                </div>
              )}

              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <KV label="Service" value={`${selected.service} · ${selected.pkg}`} />
                {showMoney && <KV label="Order value" value={money(selected.value)} />}
                <KV label="Deadline" value={selected.deadline ?? '—'} />
                <KV label="Submitted by" value={selected.staff ?? '—'} />
                <KVNode label="Filed under"><span className="inline-flex items-center gap-1 text-sm font-medium"><i className="ph-bold ph-folders text-muted-foreground" aria-hidden />{selected.project}<i className="ph-bold ph-caret-right text-muted-foreground" aria-hidden />{selected.folder}</span></KVNode>
                <KV label="Source" value={`via ${selected.source}`} />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer brief</p>
                <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">{selected.brief.map((f) => <KV key={f.label} label={f.label} value={f.value} />)}</div>
                {selected.customerNote
                  ? <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary"><i className="ph-bold ph-chat-circle-text" aria-hidden />Note from customer</p>{selected.customerNote}</div>
                  : <p className="mt-2 text-xs text-muted-foreground">No note from the customer.</p>}
              </div>

              {/* versions + inline preview */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deliverable versions</p>
                <div className="space-y-2">
                  {selected.versions.map((v) => (
                    <div key={v.id} className="rounded-xl border border-border bg-background/40 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">v{v.version}</span>
                        {v.kind === 'file'
                          ? <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><i className="ph-bold ph-file-arrow-down" aria-hidden />{v.fileName}</a>
                          : <a href={v.url ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><i className="ph-bold ph-link" aria-hidden />Open link</a>}
                        <button onClick={() => setPreviewId((p) => (p === v.id ? null : v.id))} className="rounded-md border border-border px-2 py-0.5 text-xs font-semibold hover:bg-accent"><i className="ph-bold ph-eye mr-1" aria-hidden />{previewId === v.id ? 'Hide' : 'Preview'}</button>
                        <span className="ml-auto text-xs text-muted-foreground">{v.submittedAt}</span>
                        <StatusChip status={v.status} />
                      </div>
                      {v.note && <p className="mt-1.5 text-sm text-muted-foreground"><i className="ph-bold ph-chat-text mr-1" aria-hidden />{v.note}</p>}
                      {v.reviewNote && <p className="mt-1.5 rounded-lg bg-amber-500/5 px-2 py-1.5 text-xs text-amber-700"><i className="ph-bold ph-warning mr-1" aria-hidden />Sent back: {v.reviewNote}</p>}
                      {previewId === v.id && <PreviewBox v={v} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* QA checklist — completeness + quality */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acceptance checklist · {selected.service}</p>
                  <span className={`text-xs font-semibold ${allChecked(selected) ? 'text-emerald-600' : 'text-muted-foreground'}`}>{checksOf(selected).filter(Boolean).length}/{selected.checklist.length} checks</span>
                </div>
                {['Completeness', 'Quality'].map((grp) => {
                  const items = selected.checklist.map((c, i) => ({ ...c, i })).filter((c) => c.group === grp);
                  if (!items.length) return null;
                  return (
                    <div key={grp} className="mb-2">
                      <p className="mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{grp === 'Completeness' ? 'Package completeness' : 'Quality criteria'}</p>
                      {items.map((c) => (
                        <label key={c.text} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                          <input type="checkbox" checked={checksOf(selected)[c.i] ?? false} onChange={() => toggleCheck(selected, c.i)} className="accent-primary" />
                          {c.i < 9 && <Kbd>{c.i + 1}</Kbd>}
                          <span className={checksOf(selected)[c.i] ? 'text-muted-foreground line-through' : ''}>{c.text}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Reviewer notes — two clearly separate channels: an internal note to the staffer,
                  and a customer-facing message. Distinct accent colours + audience badges so the
                  two are never confused. Each has its own quick-fill presets. */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><i className="ph-bold ph-chats-circle text-primary" aria-hidden />Leave a note</p>
                <div className="grid items-start gap-3 sm:grid-cols-2">
                  {/* —— To staff (internal) —— */}
                  <div className="overflow-hidden rounded-xl border border-indigo-400/40 bg-indigo-500/5">
                    <div className="flex items-center gap-1.5 border-b border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      <i className="ph-bold ph-user-circle" aria-hidden />To {selected.staff ?? 'staff'}
                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"><i className="ph-fill ph-lock-simple" aria-hidden />Internal</span>
                      <span className="ml-auto"><SnippetPicker snippets={staffSnips} current={noteStaff} onPick={(s) => setNoteStaff((p) => insertSnippet(p, s))} onAdd={(s) => setStaffSnips((l) => [s, ...l])} onRemove={(s) => setStaffSnips((l) => l.filter((x) => x !== s))} /></span>
                    </div>
                    <div className="p-2.5">
                      <textarea ref={noteStaffRef} value={noteStaff} onChange={(e) => setNoteStaff(e.target.value)} placeholder="Feedback or praise for the staffer — they see this, the customer doesn't…" className="min-h-[10rem] w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-indigo-400" />
                    </div>
                  </div>

                  {/* —— To customer (visible) —— */}
                  <div className="overflow-hidden rounded-xl border border-sky-400/40 bg-sky-500/5">
                    <div className="flex items-center gap-1.5 border-b border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                      <i className="ph-bold ph-chat-circle-text" aria-hidden />To {selected.customer}
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"><i className="ph-fill ph-eye" aria-hidden />Customer sees</span>
                      <span className="ml-auto"><SnippetPicker snippets={customerSnips} current={noteCustomer} onPick={(s) => setNoteCustomer((p) => insertSnippet(p, s))} onAdd={(s) => setCustomerSnips((l) => [s, ...l])} onRemove={(s) => setCustomerSnips((l) => l.filter((x) => x !== s))} /></span>
                    </div>
                    <div className="p-2.5">
                      <textarea ref={noteCustomerRef} value={noteCustomer} onChange={(e) => setNoteCustomer(e.target.value)} placeholder="A customer-facing message — this is sent to the client…" className="min-h-[10rem] w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-sky-400" />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  {(noteStaff.trim() || noteCustomer.trim()) && <button onClick={() => { setNoteStaff(''); setNoteCustomer(''); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear both</button>}
                  <button onClick={() => sendNotes(selected)} disabled={!noteStaff.trim() && !noteCustomer.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"><i className="ph-bold ph-paper-plane-tilt mr-1" aria-hidden />Send notes</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <button onClick={() => approve(selected)} disabled={!allChecked(selected)} title={allChecked(selected) ? 'Approve & complete (a)' : 'Tick all criteria first'} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><i className="ph-bold ph-check-circle mr-1" aria-hidden />Approve</button>
                <button onClick={() => { setCrModal(selected); setCrNote(''); }} className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10"><i className="ph-bold ph-arrow-u-up-left mr-1" aria-hidden />Request changes</button>
                {!allChecked(selected) && <span className="text-xs text-muted-foreground">Tick all {selected.checklist.length} criteria to enable approval.</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon="ph-clock-counter-clockwise" title="Review history" right={<span className="text-xs text-muted-foreground">{history.length}</span>}>
          {history.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">No reviews yet this session.</p> : (
            <ul className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto pr-1">{history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted"><i className={`ph-bold ${h.icon} text-primary`} /></span><span className="min-w-0 flex-1 truncate">{h.text}</span><span className="shrink-0 text-xs text-muted-foreground">{h.at}</span></li>
            ))}</ul>
          )}
        </Card>
        <Card icon="ph-gauge" title="Staff quality" right={<span className="text-xs text-muted-foreground">change-request rate</span>}>
          <div className="space-y-2.5">{staffQuality.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-sm"><span className="font-medium">{s.name}</span><span className={`text-xs font-semibold ${s.changeRate >= 50 ? 'text-destructive' : s.changeRate > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.changeRate}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${s.changeRate}%`, background: s.changeRate >= 50 ? 'hsl(var(--destructive))' : '#f59e0b' }} /></div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.reviewed} reviewed</p>
            </div>
          ))}</div>
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
            <textarea value={crNote} onChange={(e) => setCrNote(e.target.value)} rows={4} autoFocus placeholder="What needs to change? Be specific and actionable…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
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

function PreviewBox({ v }: { v: AdminDeliverable }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
        <span className="inline-flex items-center gap-1 font-medium"><i className={`ph-bold ${v.kind === 'file' ? 'ph-file-text' : 'ph-globe'}`} />{v.fileName ?? v.url}</span>
        <span className="text-muted-foreground">inline preview</span>
      </div>
      {v.kind === 'link'
        ? <iframe src={v.url ?? ''} title={`preview-${v.id}`} className="h-80 w-full bg-white" sandbox="" referrerPolicy="no-referrer" />
        : (
          <div className="space-y-2 bg-white p-4 dark:bg-zinc-900">
            <div className="h-3 w-2/5 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted/70" /><div className="h-2 w-11/12 rounded bg-muted/70" /><div className="h-2 w-10/12 rounded bg-muted/70" />
            <div className="h-2 w-full rounded bg-muted/70" /><div className="h-2 w-9/12 rounded bg-muted/70" />
            <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted/70" /><div className="h-2 w-10/12 rounded bg-muted/70" />
            <p className="pt-1 text-[10px] text-muted-foreground">Sample render · open the file to review the full document.</p>
          </div>
        )}
    </div>
  );
}
function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-muted px-1 text-[10px] font-semibold leading-tight text-muted-foreground">{children}</kbd>;
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
