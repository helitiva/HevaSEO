'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { DeliverableSubmit } from '@/components/staff/DeliverableSubmit';
import { MessageThread } from '@/components/shared/MessageThread';
import { nextStaffActions } from '@/lib/staff';
import type { OrderStatus, StaffTask, StaffDeliverable, StaffMessage } from '@/data/staffMock';

interface Props {
  task: StaffTask; deliverables: StaffDeliverable[]; messages: StaffMessage[];
  days: number | null; prevId: string | null; nextId: string | null;
}

export function TaskDetailClient({ task, deliverables, messages, days, prevId, nextId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(task.status);
  const [toast, setToast] = useState<string | null>(null);
  const actions = nextStaffActions(status);

  // Keyboard nav through the visible queue (parity with admin power-ups).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'k' || e.key === '[') && prevId) router.push(`/staff/tasks/${prevId}`);
      if ((e.key === 'j' || e.key === ']') && nextId) router.push(`/staff/tasks/${nextId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevId, nextId, router]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }
  function transition(to: OrderStatus, label: string) { setStatus(to); flash(`${task.code} → ${label}`); }
  function submit(note: string) { setStatus('internal_review'); flash(`Submitted for review — ${note.slice(0, 40)}${note.length > 40 ? '…' : ''}`); }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/staff/tasks/${task.id}`);
    flash('Link copied');
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <NavBtn href={prevId ? `/staff/tasks/${prevId}` : null} icon="ph-caret-left" label="Previous task" />
        <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
        <h1 className="display text-xl font-bold">{task.service} · {task.pkg}</h1>
        <StatusBadge status={status} />
        <PriorityBadge priority={task.priority} />
        <span className="ml-auto flex items-center gap-2">
          <SlaChip daysToDue={days} />
          <button onClick={copyLink} aria-label="Copy share link" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent"><i className="ph-bold ph-link" /></button>
          <NavBtn href={nextId ? `/staff/tasks/${nextId}` : null} icon="ph-caret-right" label="Next task" />
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{task.customer} · <i className="ph-bold ph-eye-slash align-middle" /> pricing hidden from staff</p>

      {actions.length > 0 && (
        <div className="kcard mb-4 flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <button key={a.to} onClick={() => transition(a.to, a.label)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:opacity-90 ${a.primary ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
              <i className={`ph-bold ${a.icon}`} /> {a.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground"><kbd className="rounded border border-border bg-muted px-1">j</kbd>/<kbd className="rounded border border-border bg-muted px-1">k</kbd> to move</span>
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
            <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">Acceptance checklist</p>
            <ul className="space-y-1 text-sm">
              {task.qa.map((c, i) => (
                <li key={c} className="flex items-center gap-2">
                  <i className={`ph-bold ${i < 2 ? 'ph-check-square text-emerald-500' : 'ph-square text-muted-foreground'}`} /> {c}
                </li>
              ))}
            </ul>
            {task.note && <p className="mt-3 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400"><i className="ph-bold ph-note" /> {task.note}</p>}
          </div>

          <DeliverableSubmit history={deliverables} onSubmit={submit} />
        </div>

        <div className="flex flex-col gap-4">
          <MessageThread initial={messages} />
          <div className="kcard">
            <p className="mb-2 text-sm font-semibold">Activity</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li><i className="ph-bold ph-paper-plane-tilt" /> You · created {task.created}</li>
              {status === 'changes_requested' && <li><i className="ph-bold ph-arrow-counter-clockwise text-amber-500" /> Admin requested changes</li>}
              {status === 'internal_review' && <li><i className="ph-bold ph-eye text-primary" /> Sent to internal review</li>}
            </ul>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>
      )}
    </section>
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
