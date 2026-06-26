'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { DeliverableSubmit } from '@/components/staff/DeliverableSubmit';
import { MessageThread } from '@/components/shared/MessageThread';
import { nextStaffActions } from '@/lib/staff';
import { SKILL_META, feedbackFor } from '@/data/staffMock';
import type { OrderStatus, StaffTask, StaffDeliverable, StaffMessage, ClientSummary, ManagerInfo } from '@/data/staffMock';

interface Props {
  task: StaffTask; deliverables: StaffDeliverable[]; messages: StaffMessage[];
  days: number | null; prevId: string | null; nextId: string | null;
  client: ClientSummary; manager: ManagerInfo; managerMessages: StaffMessage[];
}

interface Activity { icon: string; color: string; title: string; detail?: string; at: string }

export function TaskDetailClient({ task, deliverables, messages, days, prevId, nextId, client, manager, managerMessages }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(task.status);
  const [toast, setToast] = useState<string | null>(null);
  const actions = nextStaffActions(status);

  // The latest review that bounced the work back — drives the prominent banner.
  const changeRequest = deliverables.filter((d) => d.status === 'changes_requested').sort((a, b) => b.version - a.version)[0] ?? null;

  // Interactive self-QA. Seed checked once the work has already passed into review.
  const reviewed = ['internal_review', 'delivered', 'approved', 'completed'].includes(task.status);
  const [qaChecked, setQaChecked] = useState<boolean[]>(() => task.qa.map(() => reviewed));
  const qaDone = qaChecked.filter(Boolean).length;
  const toggleQa = (i: number) => setQaChecked((arr) => arr.map((v, j) => (j === i ? !v : v)));

  // This session's actions, appended live to the revision conversation as system lines.
  const [log, setLog] = useState<Activity[]>([]);

  // Deliverable submit is only open while there's work to do; otherwise show why it's locked.
  const lockReason =
    status === 'assigned' ? 'Start the task to upload your work.' :
    status === 'internal_review' ? 'Submitted — waiting on review. You’ll be notified if changes are needed.' :
    status === 'approved' ? 'Approved — no new version needed. Nice work. 🎉' :
    status === 'delivered' ? 'Delivered to the customer.' :
    status === 'completed' ? 'Task completed.' : null;

  // Keyboard: j/k move through the queue; s jumps to the deliverable note.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'k' || e.key === '[') && prevId) router.push(`/staff/tasks/${prevId}`);
      if ((e.key === 'j' || e.key === ']') && nextId) router.push(`/staff/tasks/${nextId}`);
      if (e.key === 's') { const el = document.getElementById('deliverable-note'); if (el) { e.preventDefault(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); (el as HTMLTextAreaElement).focus(); } }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevId, nextId, router]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }
  function transition(to: OrderStatus, label: string) {
    setStatus(to);
    setLog((l) => [{ icon: 'ph-arrow-right', color: 'text-primary', title: `Moved to ${label}`, at: 'just now' }, ...l]);
    flash(`${task.code} → ${label}`);
  }
  function submit(note: string) {
    setStatus('internal_review');
    setLog((l) => [{ icon: 'ph-paper-plane-tilt', color: 'text-primary', title: 'Submitted for review', detail: note, at: 'just now' }, ...l]);
    flash(`Submitted for review — ${note.slice(0, 40)}${note.length > 40 ? '…' : ''}`);
  }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/staff/tasks/${task.id}`);
    flash('Link copied');
  }

  return (
    <section className="mx-auto max-w-5xl">
      <Link href="/staff/tasks" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <i className="ph-bold ph-arrow-left" /> Back to tasks
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <NavBtn href={prevId ? `/staff/tasks/${prevId}` : null} icon="ph-caret-left" label="Previous task" />
        <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
        <h1 className="display text-xl font-bold">{task.service} · {task.pkg}</h1>
        <StatusBadge status={status} />
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto flex items-center gap-2">
          {task.deadline && <span className={`hidden items-center gap-1 text-xs sm:flex ${days !== null && days < 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}><i className="ph-bold ph-calendar-blank" />due {task.deadline}</span>}
          <SlaChip daysToDue={days} />
          <button onClick={copyLink} aria-label="Copy share link" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-link" /></button>
          <NavBtn href={nextId ? `/staff/tasks/${nextId}` : null} icon="ph-caret-right" label="Next task" />
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{task.customer} · <i className="ph-bold ph-eye-slash align-middle" /> pricing hidden from staff</p>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <ClientCard c={client} />
        <ManagerPanel m={manager} seed={managerMessages} />
      </div>

      {actions.length > 0 && (
        <div className="kcard mb-4 flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <button key={a.to} onClick={() => transition(a.to, a.label)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:opacity-90 ${a.primary ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
              <i className={`ph-bold ${a.icon}`} /> {a.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground"><kbd className="rounded border border-border bg-muted px-1">j</kbd>/<kbd className="rounded border border-border bg-muted px-1">k</kbd> move · <kbd className="rounded border border-border bg-muted px-1">s</kbd> submit</span>
        </div>
      )}

      {status === 'changes_requested' && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <i className="ph-bold ph-arrow-counter-clockwise" /> Changes requested{changeRequest ? ` · v${changeRequest.version}` : ''}
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">{changeRequest?.reviewNote ?? task.note ?? 'The reviewer asked for changes before this can be approved.'}</p>
          <p className="mt-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/70">— {manager.name}{changeRequest?.reviewedAt ? ` · ${changeRequest.reviewedAt}` : ''}. Address the notes, then Resume and resubmit a new version.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="kcard">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-clipboard-text text-primary" /> Customer brief <span className="ml-auto text-[11px] font-normal text-muted-foreground">{task.brief.length} fields · submitted at checkout</span></p>
            {task.brief.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No brief was submitted with this order.</p>
            ) : (
              <dl className="divide-y divide-border/60">
                {task.brief.map((f) => (
                  <div key={f.label} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2">
                    <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                    <dd className="min-w-0 text-sm"><BriefValue label={f.label} value={f.value} /></dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mb-1.5 mt-4 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Acceptance checklist <span className="font-normal">· self-check before you submit</span></p>
              <span className={`text-[11px] font-semibold ${qaDone === task.qa.length ? 'text-emerald-500' : 'text-muted-foreground'}`}>{qaDone}/{task.qa.length}</span>
            </div>
            <ul className="space-y-0.5 text-sm">
              {task.qa.map((c, i) => (
                <li key={c}>
                  <button onClick={() => toggleQa(i)} aria-pressed={qaChecked[i]} className="flex w-full items-center gap-2 rounded-md py-0.5 text-left transition hover:bg-muted/50">
                    <i className={`ph-bold shrink-0 ${qaChecked[i] ? 'ph-check-square text-emerald-500' : 'ph-square text-muted-foreground'}`} />
                    <span className={qaChecked[i] ? 'text-muted-foreground line-through' : ''}>{c}</span>
                  </button>
                </li>
              ))}
            </ul>
            {task.note && <p className="mt-3 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400"><i className="ph-bold ph-note" /> {task.note}</p>}
          </div>

          <DeliverableSubmit history={deliverables} onSubmit={submit} qaDone={qaDone} qaTotal={task.qa.length} lockReason={lockReason} status={status} />
        </div>

        <div className="flex flex-col gap-4">
          <MessageThread initial={messages} className="flex-1" />
          <RevisionThread deliverables={deliverables} sessionLog={log} fallbackReviewer={manager.name} created={task.created} />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>
      )}
    </section>
  );
}

const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

interface RevEvent { side: 'you' | 'them'; who: string; role?: 'manager' | 'customer'; v?: number; at: string; status?: string; rating?: number; body?: string; attachment?: { kind: string; fileName: string | null; url: string | null } }

// Fiverr-style revision conversation: each delivered version + the manager review and/or
// customer feedback it drew, interleaved chronologically into a thread.
function RevisionThread({ deliverables, sessionLog, fallbackReviewer, created }: { deliverables: StaffDeliverable[]; sessionLog: Activity[]; fallbackReviewer: string; created: string }) {
  const events: RevEvent[] = [];
  [...deliverables].sort((a, b) => a.version - b.version).forEach((d) => {
    events.push({ side: 'you', who: 'You', v: d.version, at: d.submittedAt, body: d.note || undefined, attachment: { kind: d.kind, fileName: d.fileName, url: d.url }, });
    const fb = feedbackFor(d.id);
    if (d.reviewedAt) events.push({ side: 'them', who: fb.reviewer ?? fallbackReviewer, role: 'manager', v: d.version, at: d.reviewedAt, status: d.status, rating: fb.managerRating, body: fb.managerNote ?? d.reviewNote ?? undefined });
    if (fb.customerRating || fb.customerNote) events.push({ side: 'them', who: 'Customer', role: 'customer', v: d.version, at: fb.customerRatedAt ?? d.reviewedAt ?? d.submittedAt, status: 'customer', rating: fb.customerRating, body: fb.customerNote });
  });
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => (a.e.at === b.e.at ? a.i - b.i : a.e.at < b.e.at ? -1 : 1)).map((x) => x.e);

  return (
    <div className="kcard flex flex-col">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chats-circle text-primary" /> Revisions & feedback
        {deliverables.length > 0 && <span className="ml-auto text-[11px] font-normal text-muted-foreground">{deliverables.length} version{deliverables.length === 1 ? '' : 's'}</span>}
      </p>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><i className="ph-bold ph-flag-pennant" /> Order created · {created}</p>
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">No revisions yet — submit your first version to start the thread.</p>
      ) : (
        <div className="space-y-3">{ordered.map((e, i) => <RevBubble key={i} e={e} />)}</div>
      )}
      {sessionLog.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-2">
          {sessionLog.map((l, i) => <p key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><i className={`ph-bold ${l.icon}`} />{l.title} · {l.at}</p>)}
        </div>
      )}
    </div>
  );
}

function RevBubble({ e }: { e: RevEvent }) {
  const mine = e.side === 'you';
  const isCustomer = e.role === 'customer';
  const changes = e.status === 'changes_requested';
  const approved = e.status === 'approved';
  return (
    <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-bold ${mine ? 'bg-primary/15 text-primary' : isCustomer ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>{mine ? 'You' : isCustomer ? 'C' : ini(e.who)}</span>
      <div className={`min-w-0 max-w-[85%] ${mine ? 'text-right' : ''}`}>
        <p className="text-[11px] text-muted-foreground">{e.who} <span className="font-semibold">· v{e.v}</span> · {e.at}</p>
        <div className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-left text-sm ${mine ? 'bg-primary/10' : changes ? 'bg-amber-500/10' : approved ? 'bg-emerald-500/10' : 'bg-muted'}`}>
          {mine && <p className="flex items-center gap-1 text-[11px] font-semibold text-primary"><i className="ph-bold ph-file-arrow-up" />Submitted v{e.v}</p>}
          {(changes || approved) && <p className={`flex items-center gap-1 text-[11px] font-semibold ${changes ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}><i className={`ph-bold ${changes ? 'ph-arrow-counter-clockwise' : 'ph-seal-check'}`} />{changes ? 'Changes requested' : 'Approved'}</p>}
          {e.rating ? <Stars value={e.rating} /> : null}
          {e.body && <p className={e.rating || changes || approved || mine ? 'mt-1' : ''}>{e.body}</p>}
          {e.attachment && (e.attachment.fileName || e.attachment.url) && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><i className={`ph-bold ${e.attachment.kind === 'link' ? 'ph-link' : 'ph-file-text'}`} /><span className="truncate">{e.attachment.fileName ?? e.attachment.url}</span></p>}
        </div>
      </div>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={`ph-fill ph-star text-xs ${i <= value ? 'text-amber-500' : 'text-muted-foreground/30'}`} />)}<span className="ml-1 text-[11px] font-semibold">{value}.0</span></span>;
}

// Client context: order history, service mix, prior staff, and the account note.
function ClientCard({ c }: { c: ClientSummary }) {
  const top = c.byService[0]?.count ?? 1;
  return (
    <div className="kcard">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-buildings text-primary" /> Client <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">{c.company}</span></p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        {c.tier && <span className="rounded-md bg-muted px-2 py-0.5 font-semibold capitalize">{c.tier} tier</span>}
        {c.since && <span className="text-muted-foreground">client since {c.since}</span>}
        {c.tags.map((t) => <span key={t} className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">{t}</span>)}
      </div>
      <div className="mb-3 flex items-baseline gap-1.5">
        <span className="display text-2xl font-bold leading-none">{c.orders}</span>
        <span className="text-xs text-muted-foreground">orders placed{c.topService && <> · mostly <b className="text-foreground">{c.topService}</b></>}</span>
      </div>
      {c.byService.length > 0 && (
        <div className="mb-3 space-y-1">
          {c.byService.map((s) => (
            <div key={s.service} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground">{s.service}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(s.count / top) * 100}%` }} /></div>
              <span className="w-5 text-right tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mb-1 text-xs text-muted-foreground">Previously handled by</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {c.staff.length > 0 ? c.staff.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary/15 text-[8px] font-bold text-primary">{ini(s)}</span>{s}
          </span>
        )) : <span className="text-xs text-muted-foreground">No prior staff on record.</span>}
      </div>
      {c.note && <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"><i className="ph-bold ph-note-pencil mr-1 text-muted-foreground" />{c.note}</p>}
    </div>
  );
}

// Manager context: the ops lead who reviews this work — profile, note, and a chat box.
function ManagerPanel({ m, seed }: { m: ManagerInfo; seed: StaffMessage[] }) {
  const [msgs, setMsgs] = useState<StaffMessage[]>(seed);
  const [draft, setDraft] = useState('');
  const first = m.name.split(' ')[0];
  function send() {
    const body = draft.trim();
    if (!body) return;
    setMsgs((x) => [...x, { who: 'You', body, internal: true, at: 'now' }]);
    setDraft('');
  }
  return (
    <div className="kcard flex flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{ini(m.name)}</span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{m.name} <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">{m.rank}</span></p>
          <p className="text-xs text-muted-foreground">{m.title} · reviews your work</p>
        </div>
      </div>
      {m.skills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {m.skills.map((s) => { const meta = SKILL_META[s]; return meta ? (
            <span key={s} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${meta.color}1a`, color: meta.color }}><i className={`ph-bold ${meta.icon}`} />{meta.label}</span>
          ) : null; })}
        </div>
      )}
      {m.note && <p className="mb-3 rounded-lg border-l-2 border-primary bg-primary/5 px-2.5 py-1.5 text-xs"><i className="ph-bold ph-quotes mr-1 text-primary" />{m.note}</p>}
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Chat with {first}</p>
      <div className="mb-2 max-h-40 space-y-2 overflow-y-auto">
        {msgs.length === 0 ? <p className="text-xs text-muted-foreground">No messages yet — say hi.</p> : msgs.map((x, i) => (
          <div key={i} className={`flex ${x.who === 'You' ? 'justify-end' : ''}`}>
            <span className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${x.who === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{x.body} <span className="opacity-60">· {x.at}</span></span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={`Message ${first}…`} aria-label={`Message ${first}`} className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary" />
        <button onClick={send} aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"><i className="ph-bold ph-paper-plane-tilt" /></button>
      </div>
    </div>
  );
}

// Render a brief value by field type: URLs as links, keyword/anchor fields as chips,
// multi-topic fields as a list, everything else as plain text.
function BriefValue({ label, value }: { label: string; value: string }) {
  if (/^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{value}</a>;
  }
  if (/keyword|anchor/i.test(label)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.split(/[,;]/).map((k) => k.trim()).filter(Boolean).map((k) => (
          <span key={k} className="rounded-md bg-muted px-2 py-0.5 text-xs">{k}</span>
        ))}
      </span>
    );
  }
  if (/topic|page/i.test(label) && /[;]/.test(value)) {
    return (
      <ul className="space-y-0.5">
        {value.split(';').map((t) => t.trim()).filter(Boolean).map((t) => (
          <li key={t} className="flex gap-1.5"><span className="text-muted-foreground">•</span>{t}</li>
        ))}
      </ul>
    );
  }
  return <span className="whitespace-pre-wrap">{value}</span>;
}

function NavBtn({ href, icon, label }: { href: string | null; icon: string; label: string }) {
  if (!href) return <span className="grid h-9 w-9 place-items-center rounded-lg border border-border opacity-30"><i className={`ph-bold ${icon}`} /></span>;
  return <Link href={href} aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className={`ph-bold ${icon}`} /></Link>;
}
