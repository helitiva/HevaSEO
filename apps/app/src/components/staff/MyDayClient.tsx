'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { DeliverableSubmit } from '@/components/staff/DeliverableSubmit';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { deliverablesFor } from '@/data/staffMock';
import { primaryActionFor, applyAction, undoAction, deriveKpis, type MyDayTask, type MyDayState } from '@/lib/myDay';

interface Props { greeting: string; capacity: number; everHadTasks: boolean; initialFocus: MyDayTask[]; }

const VERB_TONE: Record<string, string> = { Submitted: 'text-emerald-500', Started: 'text-primary', Resumed: 'text-amber-500' };

export function MyDayClient({ greeting, capacity, everHadTasks, initialFocus }: Props) {
  const router = useRouter();
  const [state, setState] = useState<MyDayState>({ focus: initialFocus, log: [] });
  const [sel, setSel] = useState(0);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; entryId: string } | null>(null);
  const idc = useRef(0);
  const makeId = () => `c${idc.current++}`;
  const kpis = deriveKpis(state);

  const subtitle =
    kpis.overdue > 0 ? `${kpis.overdue} overdue — clear ${kpis.overdue === 1 ? 'it' : 'these'} first`
      : kpis.dueToday > 0 ? `${kpis.dueToday} due today`
        : kpis.load > 0 ? `${kpis.load} task${kpis.load === 1 ? '' : 's'} need you`
          : 'Nothing needs you right now';

  function flash(text: string, entryId: string) {
    setToast({ text, entryId });
    setTimeout(() => setToast((c) => (c?.entryId === entryId ? null : c)), 5000);
  }

  function act(id: string) {
    const task = state.focus.find((x) => x.id === id);
    if (!task) return;
    const action = primaryActionFor(task.status);
    if (!action) return;
    if (action.to === 'internal_review') { setSubmitId(id); return; } // Submit → slide-over
    const next = applyAction(state, id, now(), makeId);
    setState(next);
    flash(`${task.code} · ${verbPast(action.label)}`, next.log[0].id);
  }

  function confirmSubmit() {
    if (!submitId) return;
    const task = state.focus.find((x) => x.id === submitId);
    const next = applyAction(state, submitId, now(), makeId);
    setState(next);
    setSubmitId(null);
    if (task) flash(`${task.code} · sent to review`, next.log[0].id);
  }

  function undo(entryId: string) { setState((s) => undoAction(s, entryId)); setToast(null); }

  // Keyboard: j/k move, enter open, space = run the selected row's primary action.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (submitId || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const max = state.focus.length - 1;
      if (e.key === 'j') { e.preventDefault(); setSel((i) => Math.min(i + 1, max)); }
      else if (e.key === 'k') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && state.focus[sel]) router.push(`/staff/tasks/${state.focus[sel].id}`);
      else if (e.key === ' ' && state.focus[sel]) { e.preventDefault(); act(state.focus[sel].id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, sel, submitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitTask = submitId ? state.focus.find((x) => x.id === submitId) : null;

  return (
    <section>
      <div className="mb-3">
        <h1 className="display text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="kcard mb-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <i className="ph-bold ph-target text-primary" aria-hidden /> Focus today
            {state.focus.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{state.focus.length}</span>}
          </p>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            <kbd className="rounded border border-border bg-muted px-1">j</kbd>/<kbd className="rounded border border-border bg-muted px-1">k</kbd> move · <kbd className="rounded border border-border bg-muted px-1">space</kbd> act
          </span>
        </div>

        {state.focus.length === 0 ? (
          <div>
            {kpis.cleared > 0 && <p className="mb-3 text-center text-sm font-semibold text-emerald-500">You cleared {kpis.cleared} today 🎉</p>}
            <EmptyState kind={emptyKindFor(everHadTasks || kpis.cleared > 0)} />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {state.focus.map((task, i) => {
              const action = primaryActionFor(task.status);
              const overdue = (task.days ?? 0) < 0;
              return (
                <li key={task.id} className={`-mx-2 rounded-lg px-2 ${overdue ? 'bg-destructive/5' : ''} ${i === sel ? 'ring-2 ring-primary/50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                    <SlaChip daysToDue={task.days} />
                    <Link href={`/staff/tasks/${task.id}`} className="font-medium hover:underline">{task.code}</Link>
                    <span className="text-sm text-muted-foreground">{task.service} · {task.pkg}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {action && (
                        <button onClick={() => act(task.id)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-90 ${action.primary ? 'bg-primary text-primary-foreground' : 'border border-border'}`}>
                          <i className={`ph-bold ${action.icon}`} aria-hidden /> {shortLabel(action.label)}
                        </button>
                      )}
                      <button onClick={() => copyLink(task.id, () => flash(`${task.code} · link copied`, makeId()))} aria-label="Copy link"
                        className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent"><i className="ph-bold ph-link" aria-hidden /></button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {state.log.length > 0 && (
        <div className="mb-3 rounded-2xl bg-muted/40 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground"><i className="ph-bold ph-check-circle mr-1 text-emerald-500" aria-hidden /> Cleared today · {state.log.length}</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {state.log.map((e) => (
              <li key={e.id}><span className={VERB_TONE[e.verb] ?? ''}>{e.verb}</span> · {e.code} · {e.at}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="My load" value={`${kpis.load}/${capacity}`} icon="ph-gauge" tone={kpis.load >= capacity ? 'warn' : undefined} />
        <Stat label="Overdue" value={String(kpis.overdue)} icon="ph-warning" tone={kpis.overdue ? 'bad' : undefined} />
        <Stat label="Due today" value={String(kpis.dueToday)} icon="ph-calendar-check" tone={kpis.dueToday ? 'warn' : undefined} />
        <Stat label="Cleared" value={String(kpis.cleared)} icon="ph-check-circle" tone={kpis.cleared ? 'good' : undefined} />
      </div>

      <SlideOver open={!!submitId} onClose={() => setSubmitId(null)} title={submitTask ? `Submit ${submitTask.code}` : 'Submit'}>
        {submitTask && <DeliverableSubmit history={deliverablesFor(submitTask.id)} onSubmit={confirmSubmit} />}
      </SlideOver>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {toast.text}
          <button onClick={() => undo(toast.entryId)} className="font-semibold text-amber-400 hover:underline">Undo</button>
        </div>
      )}
    </section>
  );
}

function now() { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function shortLabel(label: string) { return label === 'Submit for review' ? 'Submit' : label; }
function verbPast(label: string) { return label === 'Start' ? 'started' : label === 'Resume' ? 'resumed' : 'submitted'; }
function copyLink(id: string, done: () => void) {
  navigator.clipboard?.writeText(`${window.location.origin}/staff/tasks/${id}`).then(done, done);
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'bad' | 'warn' | 'good' }) {
  const color = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-500' : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
        <i className={`ph-bold ${icon} ${color}`} aria-hidden />
      </div>
      <p className="display mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
