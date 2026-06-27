import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { PriorityBadge } from '@/components/shared/StatBadge';
import { SlaChip } from '@/components/staff/SlaChip';
import { EmptyState, emptyKindFor } from '@/components/staff/EmptyState';
import { myTasks, BOARD_COLUMNS, type StaffTask } from '@/data/staffMock';
import { currentStaffId } from '@/lib/currentStaff';
import { daysToDue } from '@/lib/staff';

export default async function MyTasksPage() {
  const board = myTasks(await currentStaffId());
  if (board.length === 0) {
    return (
      <section>
        <PageHeader title="My Tasks" subtitle="Everything assigned to you" />
        <EmptyState kind={emptyKindFor(false)} />
      </section>
    );
  }
  return (
    <section>
      <PageHeader title="My Tasks" subtitle={`${board.length} tasks across ${BOARD_COLUMNS.length} stages`} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {BOARD_COLUMNS.map((col) => {
          const tasks = board.filter((t) => t.status === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{col.label}</p>
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">{tasks.length}</span>
              </div>
              {tasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Nothing here</p>
              ) : (
                tasks.map((t) => <TaskCard key={t.id} task={t} />)
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: StaffTask }) {
  return (
    <Link href={`/staff/tasks/${task.id}`} className="kcard kcard-anim block transition hover:border-primary/50">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{task.code}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{task.service} · {task.pkg}</p>
      <div className="mt-2 flex items-center justify-between">
        <SlaChip daysToDue={daysToDue(task.deadline)} />
        <span className="text-xs text-muted-foreground">{task.customer}</span>
      </div>
    </Link>
  );
}
