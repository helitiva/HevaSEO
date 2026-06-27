import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { money } from '@/data/adminMock';
import { archivedTask, liveTaskIdForCode, serviceMeta } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';
import { taskTimeline } from '@/lib/staff';

// A long, friendly date — "Jun 22, 2026". UTC-pinned so the day never drifts by timezone.
function fmt(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function HistoryTaskPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const task = archivedTask(decodeURIComponent(code), await currentStaffId());
  if (!task) notFound();

  const meta = serviceMeta(task.service);
  const tl = taskTimeline(task);
  const liveId = liveTaskIdForCode(task.code);

  const steps = [
    { key: 'started', label: 'Started', date: tl.started, icon: 'ph-flag', tone: 'text-muted-foreground' },
    { key: 'deadline', label: 'Deadline', date: tl.deadline, icon: 'ph-calendar-blank', tone: tl.metDeadline ? 'text-muted-foreground' : 'text-amber-500' },
    { key: 'completed', label: 'Delivered', date: tl.completed, icon: 'ph-check-circle', tone: tl.metDeadline ? 'text-emerald-500' : 'text-amber-500' },
  ];

  return (
    <section>
      <Link href="/staff/performance" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <i className="ph-bold ph-arrow-left" aria-hidden /> Back to my standing
      </Link>

      <PageHeader
        title={task.code}
        subtitle={`${meta.label} · ${task.pkg} · ${task.customer}`}
        actions={
          liveId ? (
            <Link href={`/staff/tasks/${liveId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <i className="ph-bold ph-arrow-square-out" aria-hidden /> Open full task
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">Archived task</span>
          )
        }
      />

      {/* status chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
          <i className={`ph-fill ${meta.icon}`} aria-hidden /> {meta.label}
        </span>
        <span className={`pill ${tl.metDeadline ? 'pill-good' : 'pill-warn'}`}>{tl.metDeadline ? 'On time' : 'Late'}</span>
        <span className={`pill ${task.revisions === 0 ? 'pill-good' : 'pill-warn'}`}>{task.revisions === 0 ? 'First pass' : `${task.revisions} revision${task.revisions === 1 ? '' : 's'}`}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-600">
          {task.rating !== null ? <>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star text-xs ${n <= task.rating! ? '' : 'opacity-25'}`} aria-hidden />)} {task.rating}.0</> : 'Not rated'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-600">
          <i className="ph-bold ph-wallet" aria-hidden /> {money(task.commission)} commission
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Timeline */}
        <div className="kcard lg:col-span-2">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-calendar-dots text-primary" aria-hidden /> Timeline</p>
          <ol className="relative ml-2 space-y-5 border-l border-border pl-6">
            {steps.map((st) => (
              <li key={st.key} className="relative">
                <span className={`absolute -left-[1.65rem] grid h-6 w-6 place-items-center rounded-full border border-border bg-card ${st.tone}`}>
                  <i className={`ph-bold ${st.icon} text-sm`} aria-hidden />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{st.label}</p>
                <p className="text-sm font-medium">{fmt(st.date)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-sm">
            <Stat label="Turnaround" value={`${task.days} days`} icon="ph-timer" />
            <Stat label="Submissions" value={`v1 → v${task.versions}`} icon="ph-stack" />
            <Stat label="Delivered vs deadline" value={tl.metDeadline ? 'On / early' : 'Overdue'} icon="ph-clock" tone={tl.metDeadline ? 'text-emerald-500' : 'text-amber-500'} />
          </div>
        </div>

        {/* Details + review */}
        <div className="space-y-3">
          <div className="kcard">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-info text-primary" aria-hidden /> Details</p>
            <dl className="space-y-2 text-sm">
              <Row label="Service" value={meta.label} />
              <Row label="Package" value={task.pkg} />
              <Row label="Customer" value={task.customer} />
              <Row label="Rating" value={task.rating !== null ? `${task.rating} / 5` : '—'} />
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                <dt className="text-muted-foreground">Commission earned</dt>
                <dd className="font-semibold text-emerald-600">{money(task.commission)}</dd>
              </div>
            </dl>
          </div>

          <div className="kcard">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><i className="ph-bold ph-chat-circle-text text-primary" aria-hidden /> Reviewer note</p>
            {task.reviewNote ? (
              <p className="text-sm text-muted-foreground">“{task.reviewNote}”</p>
            ) : (
              <p className="text-sm text-muted-foreground">Approved with no change requests.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><i className={`ph-bold ${icon}`} aria-hidden /> {label}</p>
      <p className={`text-sm font-semibold ${tone ?? ''}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
